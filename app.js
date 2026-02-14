const STORAGE_KEY = "secretdb_app_v2";

const state = {
  data: loadState(),
  selectedDbId: null,
  selectedSectionId: null,
  unlockedSectionId: null,
  search: "",
  lockCountdown: null,
  lockTickTimer: null,
};

const $ = (id) => document.getElementById(id);

const dbForm = $("db-form");
const dbNameInput = $("db-name");
const dbDeleteKeyInput = $("db-delete-key");
const dbList = $("db-list");
const dbCount = $("db-count");

const sectionForm = $("section-form");
const sectionNameInput = $("section-name");
const sectionKeyInput = $("section-key");
const sectionList = $("section-list");
const sectionCount = $("section-count");
const selectedDbName = $("selected-db-name");

const unlockForm = $("unlock-form");
const unlockKeyInput = $("unlock-key");
const sectionLockText = $("section-lock");

const entryForm = $("entry-form");
const entryTitleInput = $("entry-title");
const entryContentInput = $("entry-content");
const entryList = $("entry-list");
const entryTools = $("entry-tools");
const searchInput = $("search-input");
const entryCount = $("entry-count");
const clearSearchBtn = $("clear-search-btn");
const relockBtn = $("relock-btn");
const wipeSectionBtn = $("wipe-section-btn");

const lockSettings = $("lock-settings");
const autoLockEnabled = $("auto-lock-enabled");
const autoLockSeconds = $("auto-lock-seconds");
const lockCountdown = $("lock-countdown");

const hudDbs = $("hud-dbs");
const hudSections = $("hud-sections");
const hudProtected = $("hud-protected");
const hudEntries = $("hud-entries");
const hudStatus = $("hud-status");

const importInput = $("import-input");
const template = $("item-template");

bindPasswordToggle("toggle-db-key", dbDeleteKeyInput);
bindPasswordToggle("toggle-section-key", sectionKeyInput);
bindPasswordToggle("toggle-unlock-key", unlockKeyInput);

importInput.addEventListener("change", importJson);
searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  renderEntries();
  markActivity();
});
clearSearchBtn.addEventListener("click", () => {
  state.search = "";
  searchInput.value = "";
  renderEntries();
  markActivity();
});
autoLockEnabled.addEventListener("change", () => markActivity());
autoLockSeconds.addEventListener("input", () => markActivity());

relockBtn.addEventListener("click", () => {
  const section = getSelectedSection();
  if (!section || !section.accessKey) return;
  state.unlockedSectionId = null;
  sectionLockText.textContent = "Раздел снова заблокирован.";
  sectionLockText.className = "selected-mark";
  renderEntries();
  updateHud();
});

wipeSectionBtn.addEventListener("click", () => {
  const section = getSelectedSection();
  if (!section) return;

  if (section.accessKey) {
    const entered = window.prompt(`Введите ключ для очистки раздела "${section.name}"`) || "";
    if (entered.trim() !== section.accessKey) {
      window.alert("Неверный ключ. Очистка отменена.");
      return;
    }
  }

  if (!window.confirm(`Удалить все записи из раздела "${section.name}"?`)) return;
  section.entries = [];
  persist();
  renderEntries();
  renderSections();
  updateHud();
});

dbForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = dbNameInput.value.trim();
  const deleteKey = dbDeleteKeyInput.value.trim();
  if (!name || !deleteKey) return;

  const db = { id: crypto.randomUUID(), name, deleteKey, sections: [] };
  state.data.databases.push(db);
  state.selectedDbId = db.id;
  state.selectedSectionId = null;
  state.unlockedSectionId = null;
  dbForm.reset();
  persist();
  render();
  updateHud();
});

sectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const db = getSelectedDb();
  if (!db) return;

  const name = sectionNameInput.value.trim();
  const key = sectionKeyInput.value.trim();
  if (!name) return;

  db.sections.push({ id: crypto.randomUUID(), name, accessKey: key, entries: [] });
  sectionForm.reset();
  persist();
  render();
  updateHud();
});

unlockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const section = getSelectedSection();
  if (!section) return;

  if (unlockKeyInput.value.trim() === section.accessKey) {
    state.unlockedSectionId = section.id;
    sectionLockText.textContent = "Раздел открыт. Можно работать с данными.";
    sectionLockText.className = "selected-mark notice-ok";
    startLockTimer();
  } else {
    state.unlockedSectionId = null;
    sectionLockText.textContent = "Неверный ключ доступа.";
    sectionLockText.className = "selected-mark notice-bad";
  }

  unlockForm.reset();
  renderEntries();
  updateHud();
});

entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const section = getSelectedSection();
  if (!section || state.unlockedSectionId !== section.id) return;

  const title = entryTitleInput.value.trim();
  const content = entryContentInput.value.trim();
  if (!title || !content) return;

  section.entries.push({
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: new Date().toISOString(),
  });

  entryForm.reset();
  persist();
  renderEntries();
  renderSections();
  updateHud();
  markActivity();
});

function render() {
  renderDatabases();
  renderSections();
  renderEntries();
}

function renderDatabases() {
  dbList.innerHTML = "";
  dbCount.textContent = String(state.data.databases.length);

  state.data.databases.forEach((db) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const selectBtn = node.querySelector(".item-select");
    const deleteBtn = node.querySelector(".item-delete");

    selectBtn.textContent = `🗄 ${db.name} · ${db.sections.length} раздел(ов)`;
    if (db.id === state.selectedDbId) selectBtn.classList.add("active");

    selectBtn.addEventListener("click", () => {
      state.selectedDbId = db.id;
      state.selectedSectionId = null;
      state.unlockedSectionId = null;
      state.search = "";
      searchInput.value = "";
      stopLockTimer();
      render();
      updateHud();
    });

    deleteBtn.addEventListener("click", () => {
      const entered = window.prompt(`Введите ключ удаления для базы "${db.name}"`) || "";
      if (entered.trim() !== (db.deleteKey || "")) {
        window.alert("Неверный ключ удаления. База не удалена.");
        return;
      }

      state.data.databases = state.data.databases.filter((x) => x.id !== db.id);
      if (state.selectedDbId === db.id) {
        state.selectedDbId = null;
        state.selectedSectionId = null;
        state.unlockedSectionId = null;
        state.search = "";
        searchInput.value = "";
        stopLockTimer();
      }
      persist();
      render();
      updateHud();
    });

    dbList.appendChild(node);
  });
}

function renderSections() {
  sectionList.innerHTML = "";
  const db = getSelectedDb();

  if (!db) {
    selectedDbName.textContent = "База не выбрана";
    sectionCount.textContent = "0";
    return;
  }

  selectedDbName.textContent = `Выбрана база: ${db.name}`;
  sectionCount.textContent = String(db.sections.length);

  db.sections
    .slice()
    .sort((a, b) => Number(Boolean(b.accessKey)) - Number(Boolean(a.accessKey)))
    .forEach((section) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const selectBtn = node.querySelector(".item-select");
      const deleteBtn = node.querySelector(".item-delete");

      const lockMark = section.accessKey ? "🔒" : "🔓";
      selectBtn.textContent = `${lockMark} ${section.name} · ${section.entries.length} записей`;
      if (section.id === state.selectedSectionId) selectBtn.classList.add("active");

      selectBtn.addEventListener("click", () => {
        state.selectedSectionId = section.id;
        state.search = "";
        searchInput.value = "";
        state.unlockedSectionId = section.accessKey ? null : section.id;
        if (section.accessKey) stopLockTimer();
        else lockCountdown.textContent = "∞";
        render();
        updateHud();
      });

      deleteBtn.addEventListener("click", () => {
        db.sections = db.sections.filter((x) => x.id !== section.id);
        if (state.selectedSectionId === section.id) {
          state.selectedSectionId = null;
          state.unlockedSectionId = null;
          stopLockTimer();
        }
        persist();
        render();
        updateHud();
      });

      sectionList.appendChild(node);
    });
}

function renderEntries() {
  entryList.innerHTML = "";
  const section = getSelectedSection();

  if (!section) {
    sectionLockText.textContent = "Выберите раздел.";
    sectionLockText.className = "selected-mark";
    unlockForm.classList.add("hidden");
    entryForm.classList.add("hidden");
    entryTools.classList.add("hidden");
    lockSettings.classList.add("hidden");
    entryCount.textContent = "0";
    lockCountdown.textContent = "∞";
    return;
  }

  if (!section.accessKey) {
    state.unlockedSectionId = section.id;
    sectionLockText.textContent = "Раздел без ключа — доступ открыт.";
    sectionLockText.className = "selected-mark notice-ok";
    unlockForm.classList.add("hidden");
    lockSettings.classList.add("hidden");
    lockCountdown.textContent = "∞";
  } else {
    unlockForm.classList.remove("hidden");
    lockSettings.classList.remove("hidden");
    if (state.unlockedSectionId !== section.id) {
      sectionLockText.textContent = "Введите ключ доступа к разделу.";
      sectionLockText.className = "selected-mark";
      entryForm.classList.add("hidden");
      entryTools.classList.add("hidden");
      entryCount.textContent = "0";
      return;
    }
  }

  entryForm.classList.remove("hidden");
  entryTools.classList.remove("hidden");

  const items = section.entries
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((entry) => {
      if (!state.search) return true;
      const merged = `${entry.title} ${entry.content}`.toLowerCase();
      return merged.includes(state.search);
    });

  entryCount.textContent = String(items.length);

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "entry";
    li.innerHTML = `<p>${state.search ? "По вашему запросу ничего не найдено." : "Раздел пуст. Добавьте первую запись."}</p>`;
    entryList.appendChild(li);
    return;
  }

  items.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "entry";
    const date = new Date(entry.createdAt).toLocaleString("ru-RU");
    li.innerHTML = `
      <h4>${escapeHtml(entry.title)}</h4>
      <p>${escapeHtml(entry.content)}</p>
      <div class="entry-meta">${date}</div>
    `;
    entryList.appendChild(li);
  });
}

function updateHud() {
  const dbs = state.data.databases;
  const allSections = dbs.flatMap((db) => db.sections);
  const protectedCount = allSections.filter((s) => Boolean(s.accessKey)).length;
  const totalEntries = allSections.reduce((acc, s) => acc + s.entries.length, 0);

  hudDbs.textContent = String(dbs.length);
  hudSections.textContent = String(allSections.length);
  hudEntries.textContent = String(totalEntries);
  hudProtected.textContent = allSections.length
    ? `${Math.round((protectedCount / allSections.length) * 100)}%`
    : "0%";

  const section = getSelectedSection();
  if (!section) {
    hudStatus.textContent = "Ожидание выбора раздела";
    hudStatus.className = "selected-mark";
    return;
  }

  if (!section.accessKey) {
    hudStatus.textContent = "Текущий раздел открыт (без ключа).";
    hudStatus.className = "selected-mark notice-ok";
    return;
  }

  if (state.unlockedSectionId === section.id) {
    hudStatus.textContent = `Раздел открыт. Авто-лок: ${lockCountdown.textContent}s`;
    hudStatus.className = "selected-mark notice-ok";
  } else {
    hudStatus.textContent = "Раздел заблокирован.";
    hudStatus.className = "selected-mark";
  }
}

function startLockTimer() {
  stopLockTimer();
  const seconds = clampNumber(Number(autoLockSeconds.value), 10, 600, 60);
  state.lockCountdown = seconds;
  lockCountdown.textContent = String(seconds);

  state.lockTickTimer = window.setInterval(() => {
    const section = getSelectedSection();
    if (!section || !section.accessKey || state.unlockedSectionId !== section.id) {
      stopLockTimer();
      return;
    }

    if (!autoLockEnabled.checked) {
      lockCountdown.textContent = "∞";
      return;
    }

    state.lockCountdown -= 1;
    lockCountdown.textContent = String(Math.max(state.lockCountdown, 0));

    if (state.lockCountdown <= 0) {
      state.unlockedSectionId = null;
      sectionLockText.textContent = "Авто-блокировка: время доступа истекло.";
      sectionLockText.className = "selected-mark notice-bad";
      stopLockTimer();
      renderEntries();
      updateHud();
    }
  }, 1000);
}

function markActivity() {
  const section = getSelectedSection();
  if (!section || !section.accessKey || state.unlockedSectionId !== section.id) return;
  if (!autoLockEnabled.checked) {
    lockCountdown.textContent = "∞";
    updateHud();
    return;
  }
  startLockTimer();
  updateHud();
}

function stopLockTimer() {
  if (state.lockTickTimer) {
    window.clearInterval(state.lockTickTimer);
    state.lockTickTimer = null;
  }
  state.lockCountdown = null;
}

async function importJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = sanitizeData(JSON.parse(text));
    state.data = parsed;
    state.selectedDbId = null;
    state.selectedSectionId = null;
    state.unlockedSectionId = null;
    state.search = "";
    searchInput.value = "";
    stopLockTimer();
    persist();
    render();
    updateHud();
  } catch {
    window.alert("Не удалось импортировать JSON.");
  } finally {
    importInput.value = "";
  }
}

function bindPasswordToggle(buttonId, input) {
  $(buttonId).addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("secretdb_app_v1");
    if (!raw) return { databases: [] };
    return sanitizeData(JSON.parse(raw));
  } catch {
    return { databases: [] };
  }
}

function sanitizeData(data) {
  if (!data || !Array.isArray(data.databases)) return { databases: [] };

  return {
    databases: data.databases.map((db) => ({
      id: typeof db.id === "string" ? db.id : crypto.randomUUID(),
      name: typeof db.name === "string" ? db.name : "Без названия",
      deleteKey: typeof db.deleteKey === "string" ? db.deleteKey : "",
      sections: Array.isArray(db.sections)
        ? db.sections.map((section) => ({
            id: typeof section.id === "string" ? section.id : crypto.randomUUID(),
            name: typeof section.name === "string" ? section.name : "Раздел",
            accessKey: typeof section.accessKey === "string" ? section.accessKey : "",
            entries: Array.isArray(section.entries)
              ? section.entries.map((entry) => ({
                  id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
                  title: typeof entry.title === "string" ? entry.title : "Без заголовка",
                  content: typeof entry.content === "string" ? entry.content : "",
                  createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
                }))
              : [],
          }))
        : [],
    })),
  };
}

function clampNumber(value, min, max, fallback) {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function getSelectedDb() {
  return state.data.databases.find((db) => db.id === state.selectedDbId) || null;
}

function getSelectedSection() {
  const db = getSelectedDb();
  if (!db) return null;
  return db.sections.find((section) => section.id === state.selectedSectionId) || null;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("click", markActivity);
document.addEventListener("keydown", markActivity);

render();
updateHud();
