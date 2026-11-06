let isPreview = true;

let currentLevel = 1;
let previewTimer;
let previewTicker;
let matchTimer;

function clearGameTimers() {
  clearTimeout(previewTimer);
  clearInterval(previewTicker);
  clearTimeout(matchTimer);
}

function updateProgress() {
  document.getElementById("pairCount").textContent = `${found} / ${pairs}`;
  document.getElementById("progressFill").style.width = `${found / pairs * 100}%`;
  document.getElementById("pairProgress").setAttribute("aria-valuenow", found);
}

const levels = {
  1: { pairs: 6, cols: 4, rods: 1 },
  2: { pairs: 6, cols: 4, rods: 2 },
  3: { pairs: 6, cols: 4, rods: 3 }
};

// ПАТТЕРНЫ АБАКУСА
const patterns = {
  0: ["blue","white","white","blue","blue","blue","blue"],

  1: ["blue","white","red","white","blue","blue","blue"],

  2: ["blue","white","red","red","white","blue","blue"],

  3: ["blue","white","red","red","red","white","blue"],

  4: ["blue","white","red","red","red","red","white"],

  5: ["white","red","white","blue","blue","blue","blue"],

  6: ["white","red","red","white","blue","blue","blue"],

  7: ["white","red","red","red","white","blue","blue"],

  8: ["white","red","red","red","red","white","blue"],

  9: ["white","red","red","red","red","red","white"],

};

// РАЗБИВАЕМ ЧИСЛО НА ЦИФРЫ (РАЗРЯДЫ)
function splitDigits(value, rods) {
  return String(value)
    .padStart(rods, "0")
    .split("")
    .map(Number);
}

// РЕНДЕР АБАКУСА
function renderAbacus(value) {

  const rods = levels[currentLevel].rods;
  const digits = splitDigits(value, rods);

  return `
    <div class="abacus">

      ${renderRods(rods)}

      <div class="divider"></div>

      ${digits.map((digit, rodIndex) => {
        const colors = patterns[digit];

        let left = (100 / (rods + 1)) * (rodIndex + 1);

        return `
          <div class="rod-group" style="left:${left}%">

            <div class="bead ${colors[0]}" style="top:5%"></div>
            <div class="bead ${colors[1]}" style="top:17.5%"></div>
            <div class="bead ${colors[2]}" style="top:31.6667%"></div>
            <div class="bead ${colors[3]}" style="top:44.1667%"></div>
            <div class="bead ${colors[4]}" style="top:56.6667%"></div>
            <div class="bead ${colors[5]}" style="top:69.1667%"></div>
            <div class="bead ${colors[6]}" style="top:81.6667%"></div>

          </div>
        `;
      }).join("")}

    </div>
  `;
}

function renderRods(count) {
  let html = "";

  for (let i = 0; i < count; i++) {
    let left = (100 / (count + 1)) * (i + 1);

    html += `<div class="rod" style="left:${left}%"></div>`;
  }

  return html;
}

// ИГРА (1 УРОВЕНЬ)
let pairs = 6;
let cols = 4;

let cards = [];
let first = null;
let second = null;
let lock = false;
let found = 0;
let moves = 0;
let roundFinished = false;

// СТАРТ
document.addEventListener("DOMContentLoaded", () => {
  updateLevelTitle();
  renderSavedProgress();
});

function updateLevelTitle() {
  document.getElementById("levelTitle").innerText =
    "Уровень " + currentLevel;
  document.querySelectorAll(".level-dots > span").forEach((dot, index) => {
    dot.classList.toggle("active", index + 1 === currentLevel);
  });
  document.querySelector(".level-dots").setAttribute("aria-label", `Уровень ${currentLevel} из 3`);
}

// ВЫБОР УРОВНЯ
function selectLevel(level) {
  currentLevel = level;

   // показываем игру только если она ещё скрыта
  document.getElementById("menu").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";

  updateLevelTitle();
  startGame();
}

function restart() {
  startGame();
}

function updateButtons() {
  if (currentLevel === 1) {
    document.getElementById("back").innerText = "← Меню"; // меняем текст
    document.getElementById("back").style.display = "inline-block"; // показываем кнопку
  } else {
    document.getElementById("back").innerText = "← Назад"; // обычный текст
  }
  document.getElementById("next").style.display = (currentLevel === 3) ? "none" : "inline-block";// скрываем кнопку "Вперёд" на последнем уровне
}


function showMenu() {
  clearGameTimers();
  isPreview = true;
  reset();
  document.getElementById("menu").style.display = "block";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("game").innerHTML = "";
  renderSavedProgress();
}

function changeLevel(step) {
  if (currentLevel === 1 && step === -1) {
    showMenu();
    return;
  }

  let newLevel = currentLevel + step;
  if (newLevel < 1 || newLevel > 3) return; // защита от выхода за пределы уровней
  selectLevel(newLevel); // меняем уровень
}

// СОЗДАНИЕ КАРТОЧЕК
function startGame() {
  clearGameTimers();

  const config = levels[currentLevel];

  pairs = config.pairs;
  cols = config.cols;

  isPreview = true;
  found = 0;
  moves = 0;
  roundFinished = false;
  document.getElementById("moveCount").textContent = moves;
  document.getElementById("game").hidden = false;
  first = null;
  second = null;
  lock = false;
  updateProgress();

  document.getElementById("result").innerHTML = "";
  document.getElementById("restart").style.display = "none";
  document.getElementById("resultContainer").style.display = "none";

  // ГЕНЕРАЦИЯ БЕЗ ПОВТОРОВ

  const digits = levels[currentLevel].rods;
  const numbersSet = new Set();

  // защита от бесконечного цикла (важно!)
  let safety = 0;

  while (numbersSet.size < pairs && safety < 1000) {

    let num = "";

    for (let i = 0; i < digits; i++) {

      if (i === 0) {
        num += Math.floor(Math.random() * 9) + 1; // первая НЕ 0
      } else {
        num += Math.floor(Math.random() * 10);
      }

    }

    numbersSet.add(Number(num));

    safety++;
  }

  const numbers = Array.from(numbersSet);

  // КАРТОЧКИ
  cards = [];

  numbers.forEach(n => {
    cards.push({ value: n, type: "num" });
    cards.push({ value: n, type: "abacus" });
  });

  cards = shuffle(cards);

  updateButtons();

  renderBoard();
  startPreview();
}

// ПОЛЕ
function renderBoard() {
  const game = document.getElementById("game");
  game.innerHTML = "";

  cards.forEach((card, index) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "card";
    el.setAttribute("aria-label", `Карточка ${index + 1}`);
    el.setAttribute("aria-pressed", "false");
    el.dataset.value = card.value;
    el.dataset.type = card.type;

    let content = "";

    if (card.type === "num") {
      content = `<div class="num">${card.value}</div>`;
    } else {
      content = renderAbacus(card.value);
    }

    el.innerHTML = `
      <div class="inner">
        <div class="face front">${index + 1}</div>
        <div class="face back">${content}</div>
      </div>
    `;

    el.onclick = () => clickCard(el);

    game.appendChild(el);
  });
}

// КЛИК НА КАРТОЧКУ
function clickCard(el) {
  if (isPreview || lock || roundFinished || el.disabled) return;

  if (el.classList.contains("flipped")) return;

  el.classList.add("flipped");
  el.setAttribute("aria-pressed", "true");
  el.setAttribute("aria-label", el.dataset.type === "num" ? `Число ${el.dataset.value}` : `Абакус: ${el.dataset.value}`);

  if (!first) {
    first = el;
    return;
  }

  second = el;
  lock = true;
  moves++;
  document.getElementById("moveCount").textContent = moves;

  const match =
    first.dataset.value === second.dataset.value &&
    first.dataset.type !== second.dataset.type;

  if (match) {
    matchTimer = setTimeout(() => {
        first.style.opacity = "0";
        second.style.opacity = "0";

        first.style.pointerEvents = "none";
        second.style.pointerEvents = "none";
        first.disabled = true;
        second.disabled = true;

      reset();
      found++;
      updateProgress();

      if (found === pairs) {
        showWin();
      }
    }, 400);
  } else {
    matchTimer = setTimeout(() => {
      first.classList.remove("flipped");
      second.classList.remove("flipped");
      [first, second].forEach(card => {
        card.setAttribute("aria-pressed", "false");
        card.setAttribute("aria-label", `Карточка ${Array.from(card.parentNode.children).indexOf(card) + 1}`);
      });
      reset();
    }, 700);
  }
}

function reset() {
  first = null;
  second = null;
  lock = false;
}

// SHUFFLE
function shuffle(arr) {
  let a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

// ПРЕВЬЮ
function startPreview() {
  const allCards = document.querySelectorAll(".card");
  const count = document.getElementById("previewCount");
  document.getElementById("phaseText").textContent = "Запоминай карточки";
  count.hidden = false;
  count.textContent = "5 с";
  let remaining = 5;
  previewTicker = setInterval(() => {
    remaining--;
    count.textContent = `${remaining} с`;
  }, 1000);

  // ОТКРЫВАЕМ ВСЕ
  allCards.forEach(card => {
    card.classList.add("flipped");
    card.setAttribute("aria-pressed", "true");
    card.setAttribute("aria-label", card.dataset.type === "num" ? `Число ${card.dataset.value}` : `Абакус: ${card.dataset.value}`);
  });

  // ЖДЁМ 5 СЕК
  previewTimer = setTimeout(() => {
    clearInterval(previewTicker);
    count.hidden = true;
    document.getElementById("phaseText").textContent = "Найди число и его абакус";
    allCards.forEach((card, index) => {
      card.classList.remove("flipped");
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("aria-label", `Карточка ${index + 1}`);
    });

    // РАЗРЕШАЕМ ИГРУ
    isPreview = false;

  }, 5000);
}

// ПОБЕДА
function showWin() {
  if (roundFinished) return;
  roundFinished = true;
  const outcome = progressStore.recordWin(currentLevel, moves);
  renderSavedProgress();
  const container = document.getElementById("resultContainer");

  document.getElementById("result").innerHTML =
    "Молодец!<br>Все пары найдены!";
  document.getElementById("phaseText").textContent = "Все 6 пар найдены!";
  document.getElementById("roundResult").textContent = `6 пар за ${moves} ${moveWord(moves)}${outcome.newRecord ? " · Личный рекорд!" : " · Отличная работа!"}`;
  const rewards = document.getElementById("newAchievements");
  rewards.innerHTML = "";
  outcome.achievements.forEach(achievement => {
    const badge = document.createElement("span");
    badge.className = "reward-badge";
    badge.textContent = `${achievement.icon} Новая награда: ${achievement.title}`;
    rewards.appendChild(badge);
  });
  document.getElementById("resultSaveNotice").textContent = progressStore.isPersistent()
    ? "Результат сохранён в этом браузере."
    : "Результат доступен до закрытия или обновления страницы: хранилище браузера недоступно.";
  document.getElementById("game").hidden = true;

  container.style.display = "block";

  document.getElementById("restart").style.display = "inline-block";
}
