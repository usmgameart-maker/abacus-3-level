// Только итоги завершённых партий. Незавершённая игра не меняет статистику.
const progressStore = (() => {
  const key = "think-grow.abacus.progress.v1";
  const achievementList = [
    { id: "first", icon: "✦", title: "Первая победа", description: "Найди все пары в одной партии." },
    { id: "perfect", icon: "◎", title: "Без ошибок", description: "Заверши партию ровно за 6 ходов." },
    { id: "explorer", icon: "✳", title: "Все три уровня", description: "Победи на каждом из трёх уровней." }
  ];
  const empty = () => ({ version: 1, levels: Object.fromEntries([1, 2, 3].map(level => [level, { wins: 0, bestMoves: null }])) });
  let data = empty();
  let persistent = true;

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.version === 1) {
        for (const level of [1, 2, 3]) {
          const item = saved.levels?.[level];
          if (Number.isSafeInteger(item?.wins) && item.wins > 0 &&
              Number.isSafeInteger(item.bestMoves) && item.bestMoves >= 6) {
            data.levels[level] = { wins: item.wins, bestMoves: item.bestMoves };
          }
        }
      }
    }
  } catch {
    // Повреждённая запись или запрет хранилища не мешают играть.
    data = empty();
  }

  try {
    localStorage.setItem(`${key}.check`, "1");
    localStorage.removeItem(`${key}.check`);
  } catch {
    persistent = false;
  }

  function unlocked() {
    const results = Object.values(data.levels);
    return {
      first: results.some(level => level.wins > 0),
      perfect: results.some(level => level.bestMoves === 6),
      explorer: results.every(level => level.wins > 0)
    };
  }

  return {
    achievements: achievementList,
    snapshot: () => JSON.parse(JSON.stringify(data)),
    isPersistent: () => persistent,
    unlocked,
    recordWin(level, moves) {
      if (![1, 2, 3].includes(level) || !Number.isSafeInteger(moves) || moves < 6) {
        throw new Error("Некорректный результат партии");
      }
      const before = unlocked();
      const result = data.levels[level];
      const newRecord = result.bestMoves === null || moves < result.bestMoves;
      result.wins++;
      if (newRecord) result.bestMoves = moves;
      try {
        localStorage.setItem(key, JSON.stringify(data));
        persistent = true;
      } catch {
        persistent = false;
      }
      const after = unlocked();
      return { newRecord, achievements: achievementList.filter(item => !before[item.id] && after[item.id]) };
    }
  };
})();

function renderSavedProgress() {
  const data = progressStore.snapshot();
  const unlocked = progressStore.unlocked();
  const totalWins = Object.values(data.levels).reduce((sum, level) => sum + level.wins, 0);
  document.getElementById("totalWins").textContent = totalWins;
  document.getElementById("achievementCount").textContent = `${Object.values(unlocked).filter(Boolean).length} / 3`;
  document.getElementById("saveNotice").textContent = progressStore.isPersistent()
    ? "Результаты сохраняются в этом браузере."
    : "Хранилище браузера недоступно. Результаты останутся только до закрытия или обновления страницы.";

  for (const level of [1, 2, 3]) {
    const result = data.levels[level];
    const label = document.getElementById(`levelRecord${level}`);
    label.textContent = result.wins ? `✓ Пройдено · рекорд: ${result.bestMoves} ${moveWord(result.bestMoves)}` : "Пока без побед — всё впереди!";
    label.classList.toggle("has-record", result.wins > 0);
  }

  const list = document.getElementById("achievements");
  list.innerHTML = "";
  for (const achievement of progressStore.achievements) {
    const item = document.createElement("li");
    item.className = `achievement${unlocked[achievement.id] ? " is-unlocked" : ""}`;
    const icon = document.createElement("span");
    icon.className = "achievement-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = achievement.icon;
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = achievement.title;
    const description = document.createElement("p");
    description.textContent = achievement.description;
    const status = document.createElement("span");
    status.className = "achievement-status";
    status.textContent = unlocked[achievement.id] ? "✓ Получено" : "Впереди";
    copy.appendChild(title);
    copy.appendChild(description);
    copy.appendChild(status);
    item.appendChild(icon);
    item.appendChild(copy);
    list.appendChild(item);
  }
}

function moveWord(count) {
  if (count % 100 >= 11 && count % 100 <= 14) return "ходов";
  if (count % 10 === 1) return "ход";
  if (count % 10 >= 2 && count % 10 <= 4) return "хода";
  return "ходов";
}
