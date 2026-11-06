const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const storageKey = 'think-grow.abacus.progress.v1';

class Element {
  constructor() {
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.classes = new Set();
    this.classList = {
      add: value => this.classes.add(value),
      remove: value => this.classes.delete(value),
      contains: value => this.classes.has(value),
      toggle: (value, on) => on ? this.classes.add(value) : this.classes.delete(value)
    };
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  appendChild(child) { child.parentNode = this; this.children.push(child); }
}

function setup(storage = new Map(), blocked = false) {
  const ids = Object.fromEntries([...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const dots = [new Element(), new Element(), new Element()];
  const timers = new Map();
  const listeners = [];
  let now = 0;
  let seq = 0;
  const context = {
    document: {
      getElementById: id => { assert(ids[id], `Missing DOM id: ${id}`); return ids[id]; },
      createElement: () => new Element(),
      addEventListener: (_, fn) => listeners.push(fn),
      querySelector: () => new Element(),
      querySelectorAll: selector => selector === '.card' ? ids.game.children : dots
    },
    localStorage: {
      getItem: key => { if (blocked) throw Error('Blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw Error('Blocked'); storage.set(key, value); },
      removeItem: key => { if (blocked) throw Error('Blocked'); storage.delete(key); }
    },
    setTimeout: (fn, delay) => { timers.set(++seq, { fn, at: now + delay }); return seq; },
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => { timers.set(++seq, { fn, at: now + delay, interval: delay }); return seq; },
    clearInterval: id => timers.delete(id)
  };
  vm.createContext(context);
  for (const file of ['progress.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'assets', file), 'utf8'), context);
  }
  listeners.forEach(fn => fn());
  const run = code => vm.runInContext(code, context);
  function tick(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(id);
      timer.fn();
    }
    now = end;
  }
  function click(...elements) {
    for (const element of elements) { context.target = element; run('clickCard(target)'); }
  }
  function start(level) { run(`selectLevel(${level})`); tick(5000); }
  function win(level, errors = 0) {
    start(level);
    const board = ids.game.children;
    for (let i = 0; i < errors; i++) {
      click(board[0], board.find(card => card.dataset.value !== board[0].dataset.value));
      tick(700);
    }
    for (const value of new Set(board.map(card => card.dataset.value))) {
      click(...board.filter(card => card.dataset.value === value));
      tick(400);
    }
  }
  return { ids, timers, run, tick, click, start, win, storage };
}

test('all levels preserve preview, unique numbers, matching and win rules', () => {
  const game = setup();
  assert.equal(game.timers.size, 0);
  for (const level of [1, 2, 3]) {
    game.run(`selectLevel(${level})`);
    assert.equal(game.ids.game.children.length, 12);
    assert.equal(game.run('new Set(cards.map(card => card.value)).size'), 6);
    assert(game.run('cards.every(card => String(card.value).length === currentLevel)'));
    game.click(game.ids.game.children[0]);
    assert.equal(game.run('moves'), 0);
    game.tick(4999);
    assert.equal(game.run('isPreview'), true);
    game.tick(1);
    assert.equal(game.run('isPreview'), false);
    game.win(level);
    assert.equal(game.run('found'), 6);
    assert.equal(game.ids.progressFill.style.width, '100%');
    assert.equal(game.ids.game.hidden, true);
  }
});

test('completed turns count; preview and repeated selection do not count', () => {
  const game = setup();
  game.start(1);
  const first = game.ids.game.children[0];
  game.click(first, first);
  assert.equal(game.run('moves'), 0);
  game.click(game.ids.game.children.find(card => card.dataset.value !== first.dataset.value));
  assert.equal(game.run('moves'), 1);
  game.tick(700);
  assert.equal(game.run('found'), 0);
  assert.equal(game.storage.has(storageKey), false);
});

test('achievements unlock once, records improve and victories restore after reload', () => {
  const game = setup();
  game.win(1, 1);
  assert.equal(game.ids.newAchievements.children.length, 1);
  assert.equal(game.run('progressStore.unlocked().perfect'), false);
  game.win(1);
  assert.equal(game.ids.newAchievements.children.length, 1);
  assert.equal(game.run('progressStore.unlocked().perfect'), true);
  game.win(2, 2);
  assert.equal(game.ids.newAchievements.children.length, 0);
  game.win(3);
  assert.equal(game.ids.newAchievements.children.length, 1);
  assert.equal(game.run('progressStore.unlocked().explorer'), true);
  game.win(1, 3);
  assert.equal(game.ids.newAchievements.children.length, 0);
  assert.equal(game.run('progressStore.snapshot().levels[1].bestMoves'), 6);
  assert.equal(game.run('progressStore.snapshot().levels[1].wins'), 3);
  game.run('showWin()');
  assert.equal(game.run('progressStore.snapshot().levels[1].wins'), 3);
  const reloaded = setup(game.storage);
  assert.equal(reloaded.ids.totalWins.textContent, 5);
  assert.equal(reloaded.ids.achievementCount.textContent, '3 / 3');
  assert.equal(reloaded.ids.achievements.children.length, 3);
  assert.equal(reloaded.run('progressStore.snapshot().levels[2].bestMoves'), 8);
});

test('restart and leaving a partial round do not award victories', () => {
  const game = setup();
  game.start(2);
  const board = game.ids.game.children;
  game.click(...board.filter(card => card.dataset.value === board[0].dataset.value));
  game.tick(400);
  game.run('startGame(); showMenu()');
  assert.equal(game.storage.has(storageKey), false);
  assert.equal(game.timers.size, 0);
  assert.equal(game.ids.totalWins.textContent, 0);
});

test('old preview and match callbacks cannot change a new round', () => {
  const game = setup();
  game.run('selectLevel(1)'); game.tick(3000);
  game.run('selectLevel(2)'); game.tick(2000);
  assert.equal(game.run('isPreview'), true);
  game.tick(3000);
  const board = game.ids.game.children;
  game.click(...board.filter(card => card.dataset.value === board[0].dataset.value));
  game.run('selectLevel(3)'); game.tick(400);
  assert.equal(game.run('found'), 0);
  assert.equal(game.run('moves'), 0);
  assert.equal(game.storage.has(storageKey), false);
});

test('blocked storage keeps the game and achievements working in memory', () => {
  const game = setup(new Map(), true);
  game.win(1);
  assert.equal(game.run('progressStore.isPersistent()'), false);
  assert.equal(game.ids.totalWins.textContent, 1);
  assert.equal(game.ids.achievementCount.textContent, '2 / 3');
  assert.match(game.ids.resultSaveNotice.textContent, /недоступно/);
});

test('corrupt, incompatible and invalid saves safely fall back to empty results', () => {
  for (const saved of ['{broken', 'null', '{"version":99}', '{"version":1,"levels":{"1":{"wins":-1,"bestMoves":6},"2":{"wins":3,"bestMoves":5}}}']) {
    const game = setup(new Map([[storageKey, saved]]));
    assert.equal(game.ids.totalWins.textContent, 0);
    game.win(1);
    assert.equal(JSON.parse(game.storage.get(storageKey)).levels[1].wins, 1);
  }
});

test('Russian turn labels handle singular, plural and teen endings', () => {
  const game = setup();
  for (const [number, word] of [[1, 'ход'], [2, 'хода'], [6, 'ходов'], [11, 'ходов'], [21, 'ход'], [24, 'хода'], [112, 'ходов']]) {
    assert.equal(game.run(`moveWord(${number})`), word);
  }
});
