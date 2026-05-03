/**
 * Preset categories merged with user-defined { name, color } (localStorage).
 * Loads after category-accent.js and extends financeCategoryAccent for custom colors.
 */
(function (global) {
  var STORAGE_KEY = "pf-user-categories-v1";
  var CAT_MAX_LEN = 40;
  var DEFAULT_USER_COLOR = "#277C78";

  var PRESET_CATEGORIES = [
    "Entertainment",
    "Bills",
    "Groceries",
    "Dining Out",
    "Transportation",
    "Personal Care",
    "Education",
    "Lifestyle",
    "Shopping",
    "General",
  ];

  function normalizeCategoryName(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function sanitizeHex(raw) {
    if (raw == null || raw === "") return null;
    var t = String(raw).trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
    if (/^[0-9A-Fa-f]{6}$/.test(t)) return "#" + t;
    return null;
  }

  function normalizeStoredEntry(item) {
    if (typeof item === "string") {
      var ns = normalizeCategoryName(item);
      if (!ns) return null;
      return { name: ns, color: DEFAULT_USER_COLOR };
    }
    if (item && typeof item === "object" && typeof item.name === "string") {
      var nn = normalizeCategoryName(item.name);
      if (!nn) return null;
      return {
        name: nn,
        color: sanitizeHex(item.color) || DEFAULT_USER_COLOR,
      };
    }
    return null;
  }

  function loadUserCategories() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      var out = [];
      var needSave = false;
      for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "string") needSave = true;
        if (
          arr[i] &&
          typeof arr[i] === "object" &&
          !sanitizeHex(arr[i].color)
        ) {
          needSave = true;
        }
        var e = normalizeStoredEntry(arr[i]);
        if (e) out.push(e);
      }
      if (needSave) saveUserCategories(out);
      return out;
    } catch (err) {
      return [];
    }
  }

  function saveUserCategories(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function presetKeySet() {
    var set = {};
    for (var i = 0; i < PRESET_CATEGORIES.length; i++) {
      set[PRESET_CATEGORIES[i].toLowerCase()] = true;
    }
    return set;
  }

  function getMergedCategoryList() {
    var presets = presetKeySet();
    var user = loadUserCategories();
    var seen = {};
    var out = [];

    function add(name) {
      var n = normalizeCategoryName(name);
      if (!n || n.length > CAT_MAX_LEN) return;
      var key = n.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(n);
    }

    for (var i = 0; i < PRESET_CATEGORIES.length; i++) {
      add(PRESET_CATEGORIES[i]);
    }
    for (var j = 0; j < user.length; j++) {
      var u = user[j].name;
      if (!u || presets[u.toLowerCase()]) continue;
      add(u);
    }

    out.sort(function (a, b) {
      return a.localeCompare(b);
    });
    return out;
  }

  /**
   * @returns {{ name: string, color: string }[]}
   */
  function getUserCategoryEntries() {
    var presets = presetKeySet();
    var user = loadUserCategories();
    var out = [];
    var seen = {};
    for (var i = 0; i < user.length; i++) {
      var e = user[i];
      if (!e || !e.name) continue;
      var n = normalizeCategoryName(e.name);
      if (!n || presets[n.toLowerCase()]) continue;
      var k = n.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      out.push({
        name: n,
        color: sanitizeHex(e.color) || DEFAULT_USER_COLOR,
      });
    }
    out.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    return out;
  }

  function getUserCategoriesOnly() {
    var entries = getUserCategoryEntries();
    var names = [];
    for (var i = 0; i < entries.length; i++) {
      names.push(entries[i].name);
    }
    return names;
  }

  function userColorForCategory(category) {
    var n = normalizeCategoryName(category);
    if (!n) return null;
    var user = loadUserCategories();
    for (var i = 0; i < user.length; i++) {
      var e = user[i];
      if (!e || !e.name) continue;
      if (normalizeCategoryName(e.name).toLowerCase() === n.toLowerCase()) {
        return sanitizeHex(e.color) || DEFAULT_USER_COLOR;
      }
    }
    return null;
  }

  /**
   * @returns {{ ok: boolean, reason?: string }}
   */
  function addUserCategory(rawName, rawColor) {
    var n = normalizeCategoryName(rawName);
    if (!n || n.length > CAT_MAX_LEN) return { ok: false, reason: "empty" };
    var presets = presetKeySet();
    if (presets[n.toLowerCase()]) return { ok: false, reason: "preset" };
    var col = sanitizeHex(rawColor) || DEFAULT_USER_COLOR;
    var user = loadUserCategories().slice();
    for (var i = 0; i < user.length; i++) {
      if (
        normalizeCategoryName(user[i].name).toLowerCase() === n.toLowerCase()
      ) {
        return { ok: false, reason: "duplicate" };
      }
    }
    user.push({ name: n, color: col });
    saveUserCategories(user);
    return { ok: true };
  }

  function setUserCategoryColor(rawName, rawColor) {
    var n = normalizeCategoryName(rawName);
    var col = sanitizeHex(rawColor);
    if (!n || !col) return false;
    var user = loadUserCategories().slice();
    var ok = false;
    for (var i = 0; i < user.length; i++) {
      if (
        normalizeCategoryName(user[i].name).toLowerCase() === n.toLowerCase()
      ) {
        user[i].color = col;
        ok = true;
        break;
      }
    }
    if (ok) saveUserCategories(user);
    return ok;
  }

  function removeUserCategory(name) {
    var target = normalizeCategoryName(name).toLowerCase();
    var user = loadUserCategories().filter(function (c) {
      return normalizeCategoryName(c.name).toLowerCase() !== target;
    });
    saveUserCategories(user);
  }

  /**
   * @param {HTMLSelectElement|null} selectEl
   * @param {{ includeEmpty?: boolean, emptyLabel?: string, selectedValue?: string|null }} opts
   */
  function fillCategorySelect(selectEl, opts) {
    if (!selectEl) return;
    var o = opts || {};
    var selected =
      o.selectedValue !== undefined && o.selectedValue !== null
        ? o.selectedValue
        : null;
    var list = getMergedCategoryList();
    selectEl.innerHTML = "";
    if (o.includeEmpty) {
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = o.emptyLabel || "All Transactions";
      selectEl.appendChild(opt0);
    }
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement("option");
      opt.value = list[i];
      opt.textContent = list[i];
      selectEl.appendChild(opt);
    }
    if (selected !== null && selected !== undefined) {
      if (selected === "") {
        selectEl.value = "";
      } else {
        var sv = String(selected);
        selectEl.value = sv;
        if (selectEl.value !== sv) {
          var optNew = document.createElement("option");
          optNew.value = sv;
          optNew.textContent = sv;
          selectEl.appendChild(optNew);
          selectEl.value = sv;
        }
      }
    }
  }

  var presetFinanceCategoryAccent =
    typeof global.financeCategoryAccent === "function"
      ? global.financeCategoryAccent
      : function () {
          return DEFAULT_USER_COLOR;
        };

  function financeCategoryAccentMerged(category) {
    var uc = userColorForCategory(category);
    if (uc) return uc;
    return presetFinanceCategoryAccent(category);
  }

  global.financeCategoryAccent = financeCategoryAccentMerged;

  global.financePresetCategories = PRESET_CATEGORIES;
  global.financeDefaultUserCategoryColor = DEFAULT_USER_COLOR;
  global.financeGetMergedCategoryList = getMergedCategoryList;
  global.financeGetUserCategoryEntries = getUserCategoryEntries;
  global.financeGetUserCategoriesOnly = getUserCategoriesOnly;
  global.financeAddUserCategory = addUserCategory;
  global.financeSetUserCategoryColor = setUserCategoryColor;
  global.financeRemoveUserCategory = removeUserCategory;
  global.financeFillCategorySelect = fillCategorySelect;
  global.financeNormalizeCategoryName = normalizeCategoryName;
  global.financeSanitizeCategoryColor = sanitizeHex;
})(typeof window !== "undefined" ? window : this);
