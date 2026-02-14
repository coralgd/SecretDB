const STORAGE_KEY = "secretdb_app_v3";
const SESSION_KEY = "secretdb_session_v1";

const state = {
  data: loadState(),
  currentUserId: localStorage.getItem(SESSION_KEY),
  selectedDbId: null,
  selectedSectionId: null,
  unlockedSectionId: null,
  search: "",
};

const $ = (id) => document.getElementById(id);
const byId = (arr, id) => arr.find((x) => x.id === id) || null;

const loginForm = $("login-form");
const registerForm = $("register-form");
const logoutBtn = $("logout-btn");
const sessionBox = $("session-box");
const sessionText = $("session-text");
const currentUserChip = $("current-user-chip");

const authPanel = $("auth-panel");
const workspace = $("workspace");
const moderatorPanel = $("moderator-panel");
const moderatedAccount = $("moderated-account");
const grantDbBtn = $("grant-db-btn");
const revokeDbBtn = $("revoke-db-btn");
const grantSectionBtn = $("grant-section-btn");
const revokeSectionBtn = $("revoke-section-btn");
const modHint = $("mod-hint");

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
const clearSearchBtn = $("clear-search-btn");
const entryCount = $("entry-count");

const importInput = $("import-input");
const template = $("item-template");

loginForm.addEventListener("submit", onLogin);
registerForm.addEventListener("submit", onRegister);
logoutBtn.addEventListener("click", onLogout);
importInput.addEventListener("change", importJson);

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  renderEntries();
});
clearSearchBtn.addEventListener("click", () => {
  state.search = "";
  searchInput.value = "";
  renderEntries();
});

grantDbBtn.addEventListener("click", () => setDbAccess(true));
revokeDbBtn.addEventListener("click", () => setDbAccess(false));
grantSectionBtn.addEventListener("click", () => setSectionAccess(true));
revokeSectionBtn.addEventListener("click", () => setSectionAccess(false));

// Data operations

dbForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = currentUser();
  if (!isModerator(user)) return;

  const name = dbNameInput.value.trim();
  const deleteKey = dbDeleteKeyInput.value.trim();
  if (!name || !deleteKey) return;

  const db = {
    id: crypto.randomUUID(),
    name,
    deleteKey,
    allowedAccounts: [user.id],
    sections: [],
  };

  state.data.databases.push(db);
  state.selectedDbId = db.id;
  state.selectedSectionId = null;
  state.unlockedSectionId = null;
  dbForm.reset();
  persist();
  renderAll();
});

sectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = currentUser();
  if (!isModerator(user)) return;

  const db = getSelectedDbRaw();
  if (!db) return;

  const name = sectionNameInput.value.trim();
  const key = sectionKeyInput.value.trim();
  if (!name) return;

  db.sections.push({
    id: crypto.randomUUID(),
    name,
    accessKey: key,
    allowedAccounts: [user.id],
    entries: [],
  });

  sectionForm.reset();
  persist();
  renderAll();
});

unlockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const section = getSelectedSectionVisible();
  if (!section) return;

  if (unlockKeyInput.value.trim() === section.accessKey) {
    state.unlockedSectionId = section.id;
    sectionLockText.textContent = "Раздел открыт.";
    sectionLockText.className = "selected-mark notice-ok";
  } else {
    state.unlockedSectionId = null;
    sectionLockText.textContent = "Неверный ключ.";
    sectionLockText.className = "selected-mark notice-bad";
  }
  unlockForm.reset();
  renderEntries();
});

entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const section = getSelectedSectionVisible();
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
});

function onLogin(e) {
  e.preventDefault();
  const name = $("login-name").value.trim();
  const pass = $("login-pass").value.trim();

  const user = state.data.accounts.find((a) => a.username === name && a.password === pass) || null;
  if (!user) {
    window.alert("Неверный логин или пароль.");
    return;
  }

  state.currentUserId = user.id;
  localStorage.setItem(SESSION_KEY, user.id);
  loginForm.reset();
  state.selectedDbId = null;
  state.selectedSectionId = null;
  state.unlockedSectionId = null;
  renderAll();
}

function onRegister(e) {
  e.preventDefault();
  const name = $("register-name").value.trim();
  const pass = $("register-pass").value.trim();

  if (!name || !pass) return;
  if (state.data.accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())) {
    window.alert("Такой логин уже существует.");
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    username: name,
    password: pass,
    role: "user",
  };

  state.data.accounts.push(user);
  persist();
  registerForm.reset();
  window.alert("Аккаунт создан. Теперь войдите.");
  renderModeratorPanel();
}

function onLogout() {
  state.currentUserId = null;
  localStorage.removeItem(SESSION_KEY);
  state.selectedDbId = null;
  state.selectedSectionId = null;
  state.unlockedSectionId = null;
  renderAll();
}

function setDbAccess(grant) {
  const mod = currentUser();
  if (!isModerator(mod)) return;

  const db = getSelectedDbRaw();
  const accountId = moderatedAccount.value;
  if (!db || !accountId) {
    modHint.textContent = "Сначала выберите аккаунт и БД.";
    return;
  }

  db.allowedAccounts = uniqueIds(db.allowedAccounts || []);
  if (grant) db.allowedAccounts.push(accountId);
  else db.allowedAccounts = db.allowedAccounts.filter((id) => id !== accountId);
  db.allowedAccounts = uniqueIds(db.allowedAccounts);

  persist();
  modHint.textContent = grant ? "Доступ к БД выдан." : "Доступ к БД снят.";
  renderAll();
}

function setSectionAccess(grant) {
  const mod = currentUser();
  if (!isModerator(mod)) return;

  const section = getSelectedSectionRaw();
  const accountId = moderatedAccount.value;
  if (!section || !accountId) {
    modHint.textContent = "Сначала выберите аккаунт и раздел.";
    return;
  }

  section.allowedAccounts = uniqueIds(section.allowedAccounts || []);
  if (grant) section.allowedAccounts.push(accountId);
  else section.allowedAccounts = section.allowedAccounts.filter((id) => id !== accountId);
  section.allowedAccounts = uniqueIds(section.allowedAccounts);

  persist();
  modHint.textContent = grant ? "Доступ к разделу выдан." : "Доступ к разделу снят.";
  renderAll();
}

function renderAll() {
  renderAuth();
  renderModeratorPanel();
  renderWorkspaceVisibility();
  renderDatabases();
  renderSections();
  renderEntries();
}

function renderAuth() {
  const user = currentUser();
  if (!user) {
    currentUserChip.textContent = "Не выполнен вход";
    sessionBox.classList.add("hidden");
    return;
  }

  currentUserChip.textContent = `Вы вошли как: ${user.username} (${user.role})`;
  sessionBox.classList.remove("hidden");
  sessionText.textContent = "Управление доступом доступно модератору.";
}

function renderModeratorPanel() {
  const user = currentUser();
  const show = isModerator(user);
  moderatorPanel.classList.toggle("hidden", !show);

  if (!show) return;

  const accounts = state.data.accounts.filter((a) => a.id !== user.id);
  moderatedAccount.innerHTML = "";
  accounts.forEach((a) => {
    const option = document.createElement("option");
    option.value = a.id;
    option.textContent = `${a.username} (${a.role})`;
    moderatedAccount.appendChild(option);
  });
}

function renderWorkspaceVisibility() {
  const logged = Boolean(currentUser());
  workspace.classList.toggle("hidden", !logged);

  const mod = isModerator(currentUser());
  dbForm.classList.toggle("hidden", !mod);
  sectionForm.classList.toggle("hidden", !mod);
}

function renderDatabases() {
  dbList.innerHTML = "";
  const user = currentUser();
  if (!user) {
    dbCount.textContent = "0";
    return;
  }

  const dbs = visibleDatabasesFor(user);
  dbCount.textContent = String(dbs.length);

  dbs.forEach((db) => {
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
      renderAll();
    });

    deleteBtn.classList.toggle("hidden", !isModerator(user));
    deleteBtn.addEventListener("click", () => {
      if (!isModerator(user)) return;
      const entered = window.prompt(`Введите ключ удаления для базы "${db.name}"`) || "";
      if (entered.trim() !== (db.deleteKey || "")) {
        window.alert("Неверный ключ удаления.");
        return;
      }

      state.data.databases = state.data.databases.filter((x) => x.id !== db.id);
      if (state.selectedDbId === db.id) {
        state.selectedDbId = null;
        state.selectedSectionId = null;
        state.unlockedSectionId = null;
      }
      persist();
      renderAll();
    });

    dbList.appendChild(node);
  });
}

function renderSections() {
  sectionList.innerHTML = "";
  const db = getSelectedDbVisible();
  if (!db) {
    selectedDbName.textContent = "База не выбрана или недоступна";
    sectionCount.textContent = "0";
    return;
  }

  selectedDbName.textContent = `Выбрана база: ${db.name}`;
  const user = currentUser();
  const sections = visibleSectionsFor(db, user);
  sectionCount.textContent = String(sections.length);

  sections.forEach((section) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const selectBtn = node.querySelector(".item-select");
    const deleteBtn = node.querySelector(".item-delete");

    const lockMark = section.accessKey ? "🔒" : "🔓";
    selectBtn.textContent = `${lockMark} ${section.name} · ${section.entries.length} записей`;
    if (section.id === state.selectedSectionId) selectBtn.classList.add("active");

    selectBtn.addEventListener("click", () => {
      state.selectedSectionId = section.id;
      state.unlockedSectionId = section.accessKey ? null : section.id;
      state.search = "";
      searchInput.value = "";
      renderEntries();
    });

    deleteBtn.classList.toggle("hidden", !isModerator(user));
    deleteBtn.addEventListener("click", () => {
      if (!isModerator(user)) return;
      db.sections = db.sections.filter((x) => x.id !== section.id);
      if (state.selectedSectionId === section.id) {
        state.selectedSectionId = null;
        state.unlockedSectionId = null;
      }
      persist();
      renderAll();
    });

    sectionList.appendChild(node);
  });
}

function renderEntries() {
  entryList.innerHTML = "";
  const section = getSelectedSectionVisible();

  if (!section) {
    sectionLockText.textContent = "Выберите раздел.";
    sectionLockText.className = "selected-mark";
    unlockForm.classList.add("hidden");
    entryForm.classList.add("hidden");
    entryTools.classList.add("hidden");
    entryCount.textContent = "0";
    return;
  }

  if (!section.accessKey) {
    state.unlockedSectionId = section.id;
    sectionLockText.textContent = "Раздел без ключа — доступ открыт.";
    sectionLockText.className = "selected-mark notice-ok";
    unlockForm.classList.add("hidden");
  } else {
    unlockForm.classList.remove("hidden");
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
    li.innerHTML = `<p>${state.search ? "Ничего не найдено." : "Раздел пуст."}</p>`;
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

// Access helpers

function visibleDatabasesFor(user) {
  if (!user) return [];
  if (isModerator(user)) return state.data.databases;
  return state.data.databases.filter((db) => (db.allowedAccounts || []).includes(user.id));
}

function visibleSectionsFor(db, user) {
  if (!db || !user) return [];
  if (isModerator(user)) return db.sections;
  return db.sections.filter((s) => (s.allowedAccounts || []).includes(user.id));
}

function getSelectedDbRaw() {
  return byId(state.data.databases, state.selectedDbId);
}

function getSelectedDbVisible() {
  const user = currentUser();
  const db = getSelectedDbRaw();
  if (!user || !db) return null;
  return visibleDatabasesFor(user).find((x) => x.id === db.id) || null;
}

function getSelectedSectionRaw() {
  const db = getSelectedDbRaw();
  if (!db) return null;
  return byId(db.sections, state.selectedSectionId);
}

function getSelectedSectionVisible() {
  const user = currentUser();
  const db = getSelectedDbVisible();
  if (!db || !user) return null;
  return visibleSectionsFor(db, user).find((s) => s.id === state.selectedSectionId) || null;
}

function isModerator(user) {
  return Boolean(user && user.role === "moderator");
}

function currentUser() {
  return byId(state.data.accounts, state.currentUserId);
}

function uniqueIds(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// Storage

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
    persist();
    renderAll();
  } catch {
    window.alert("Не удалось импортировать JSON.");
  } finally {
    importInput.value = "";
  }
}

function bindPasswordToggle(buttonId, input) {
  const btn = $(buttonId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("secretdb_app_v2") || localStorage.getItem("secretdb_app_v1");
    const base = raw ? JSON.parse(raw) : {};
    return sanitizeData(base);
  } catch {
    return sanitizeData({});
  }
}

function sanitizeData(data) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const normalizedAccounts = accounts.map((a) => ({
    id: typeof a.id === "string" ? a.id : crypto.randomUUID(),
    username: typeof a.username === "string" ? a.username : "user",
    password: typeof a.password === "string" ? a.password : "1234",
    role: a.role === "moderator" ? "moderator" : "user",
  }));

  if (!normalizedAccounts.some((a) => a.role === "moderator")) {
    normalizedAccounts.unshift({
      id: crypto.randomUUID(),
      username: "admin",
      password: "admin123",
      role: "moderator",
    });
  }

  const defaultModId = normalizedAccounts.find((a) => a.role === "moderator").id;

  const rawDbs = Array.isArray(data.databases) ? data.databases : [];
  const databases = rawDbs.map((db) => ({
    id: typeof db.id === "string" ? db.id : crypto.randomUUID(),
    name: typeof db.name === "string" ? db.name : "Без названия",
    deleteKey: typeof db.deleteKey === "string" ? db.deleteKey : "delete",
    allowedAccounts: uniqueIds(Array.isArray(db.allowedAccounts) ? db.allowedAccounts : [defaultModId]),
    sections: Array.isArray(db.sections)
      ? db.sections.map((section) => ({
          id: typeof section.id === "string" ? section.id : crypto.randomUUID(),
          name: typeof section.name === "string" ? section.name : "Раздел",
          accessKey: typeof section.accessKey === "string" ? section.accessKey : "",
          allowedAccounts: uniqueIds(Array.isArray(section.allowedAccounts) ? section.allowedAccounts : [defaultModId]),
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
  }));

  return { accounts: normalizedAccounts, databases };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderAll();
