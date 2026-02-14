const STORAGE_KEY = "secretdb_app_v1";

const state = {
  data: loadState(),
  selectedDbId: null,
  selectedSectionId: null,
  unlockedSectionId: null,
};

const dbForm = document.getElementById("db-form");
const dbNameInput = document.getElementById("db-name");
const dbList = document.getElementById("db-list");

const sectionForm = document.getElementById("section-form");
const sectionNameInput = document.getElementById("section-name");
const sectionKeyInput = document.getElementById("section-key");
const sectionList = document.getElementById("section-list");
const selectedDbName = document.getElementById("selected-db-name");

const unlockForm = document.getElementById("unlock-form");
const unlockKeyInput = document.getElementById("unlock-key");
const sectionLockText = document.getElementById("section-lock");

const entryForm = document.getElementById("entry-form");
const entryTitleInput = document.getElementById("entry-title");
const entryContentInput = document.getElementById("entry-content");
const entryList = document.getElementById("entry-list");

const template = document.getElementById("item-template");

dbForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = dbNameInput.value.trim();
  if (!name) return;

  const db = {
    id: crypto.randomUUID(),
    name,
    sections: [],
  };

  state.data.databases.push(db);
  state.selectedDbId = db.id;
  state.selectedSectionId = null;
  state.unlockedSectionId = null;
  dbForm.reset();
  persist();
  render();
});

sectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const db = getSelectedDb();
  if (!db) return;

  const name = sectionNameInput.value.trim();
  const key = sectionKeyInput.value.trim();
  if (!name || !key) return;

  db.sections.push({
    id: crypto.randomUUID(),
    name,
    accessKey: key,
    entries: [],
  });

  sectionForm.reset();
  persist();
  render();
});

unlockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const section = getSelectedSection();
  if (!section) return;

  if (unlockKeyInput.value.trim() === section.accessKey) {
    state.unlockedSectionId = section.id;
    sectionLockText.textContent = "Раздел открыт. Можно работать с данными.";
    sectionLockText.className = "selected-mark notice-ok";
    renderEntries();
    entryForm.classList.remove("hidden");
  } else {
    state.unlockedSectionId = null;
    entryForm.classList.add("hidden");
    sectionLockText.textContent = "Неверный ключ доступа.";
    sectionLockText.className = "selected-mark notice-bad";
    renderEntries();
  }

  unlockForm.reset();
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
});

function render() {
  renderDatabases();
  renderSections();
  renderEntries();
}

function renderDatabases() {
  dbList.innerHTML = "";

  state.data.databases.forEach((db) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const selectBtn = node.querySelector(".item-select");
    const deleteBtn = node.querySelector(".item-delete");

    selectBtn.textContent = `🗄 ${db.name}`;
    if (db.id === state.selectedDbId) selectBtn.classList.add("active");

    selectBtn.addEventListener("click", () => {
      state.selectedDbId = db.id;
      state.selectedSectionId = null;
      state.unlockedSectionId = null;
      render();
    });

    deleteBtn.addEventListener("click", () => {
      state.data.databases = state.data.databases.filter((x) => x.id !== db.id);
      if (state.selectedDbId === db.id) {
        state.selectedDbId = null;
        state.selectedSectionId = null;
        state.unlockedSectionId = null;
      }
      persist();
      render();
    });

    dbList.appendChild(node);
  });
}

function renderSections() {
  sectionList.innerHTML = "";
  const db = getSelectedDb();

  if (!db) {
    selectedDbName.textContent = "База не выбрана";
    return;
  }

  selectedDbName.textContent = `Выбрана база: ${db.name}`;

  db.sections.forEach((section) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const selectBtn = node.querySelector(".item-select");
    const deleteBtn = node.querySelector(".item-delete");

    selectBtn.textContent = `📁 ${section.name}`;
    if (section.id === state.selectedSectionId) selectBtn.classList.add("active");

    selectBtn.addEventListener("click", () => {
      state.selectedSectionId = section.id;
      state.unlockedSectionId = null;
      entryForm.classList.add("hidden");
      sectionLockText.textContent = "Откройте раздел по ключу";
      sectionLockText.className = "selected-mark";
      render();
    });

    deleteBtn.addEventListener("click", () => {
      db.sections = db.sections.filter((x) => x.id !== section.id);
      if (state.selectedSectionId === section.id) {
        state.selectedSectionId = null;
        state.unlockedSectionId = null;
      }
      persist();
      render();
    });

    sectionList.appendChild(node);
  });
}

function renderEntries() {
  entryList.innerHTML = "";
  const section = getSelectedSection();

  if (!section) {
    sectionLockText.textContent = "Выберите раздел, затем откройте его ключом";
    sectionLockText.className = "selected-mark";
    entryForm.classList.add("hidden");
    return;
  }

  if (state.unlockedSectionId !== section.id) {
    entryForm.classList.add("hidden");
    return;
  }

  section.entries
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((entry) => {
      const li = document.createElement("li");
      li.className = "entry";
      li.innerHTML = `<h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.content)}</p>`;
      entryList.appendChild(li);
    });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { databases: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.databases)) return { databases: [] };
    return parsed;
  } catch {
    return { databases: [] };
  }
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

render();
