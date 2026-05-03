(function () {
  var MONTH_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  var CATEGORY_OPTIONS = [
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

  var THEME_PRESETS = [
    { label: "Green", hex: "#277C78" },
    { label: "Yellow", hex: "#F2CDAC" },
    { label: "Cyan", hex: "#82C9D7" },
    { label: "Navy", hex: "#25294D" },
    { label: "Red", hex: "#C94736" },
    { label: "Purple", hex: "#826CB0" },
    { label: "Turquoise", hex: "#67C7C9" },
    { label: "Brown", hex: "#93674E" },
    { label: "Magenta", hex: "#D946B8" },
    { label: "Blue", hex: "#3F82B2" },
    { label: "Navy Grey", hex: "#626070" },
    { label: "Army Green", hex: "#6B7F59" },
    { label: "Pink", hex: "#F472B6" },
    { label: "Gold", hex: "#EAB308" },
    { label: "Orange", hex: "#EA580C" },
  ];

  var currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  var dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  function parseISO(iso) {
    return new Date(iso);
  }

  function addCalendarMonths(year, monthIndex, delta) {
    var d = new Date(Date.UTC(year, monthIndex + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }

  function spentInMonth(transactions, category, year, monthIndex) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) continue;
      if (t.category !== category) continue;
      if (t.amount >= 0) continue;
      sum += Math.abs(t.amount);
    }
    return sum;
  }

  function totalExpenseInMonth(transactions, year, monthIndex) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) continue;
      if (t.amount >= 0) continue;
      sum += Math.abs(t.amount);
    }
    return sum;
  }

  function latestForCategoryInMonth(
    transactions,
    category,
    year,
    monthIndex,
    n
  ) {
    var filtered = transactions.filter(function (t) {
      if (t.category !== category) return false;
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) {
        return false;
      }
      if (t.amount >= 0) return false;
      return true;
    });
    filtered.sort(function (a, b) {
      return parseISO(b.date) - parseISO(a.date);
    });
    return filtered.slice(0, n);
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function buildConicGradient(spents, themes) {
    var total = 0;
    var n = spents.length;
    for (var i = 0; i < n; i++) total += spents[i];
    if (total <= 0) {
      var empty = cssVar("--color-donut-empty", "#e0dedc");
      return "conic-gradient(from -90deg, " + empty + " 0deg 360deg)";
    }
    var gapDeg = n > 1 ? 2.25 : 0;
    var totalGaps = gapDeg * n;
    var avail = Math.max(360 - totalGaps, 1);
    var track = cssVar("--color-donut-track", "transparent");

    var angle = 0;
    var parts = [];
    for (var j = 0; j < n; j++) {
      var seg = (spents[j] / total) * avail;
      var start = angle;
      angle += seg;
      parts.push(themes[j] + " " + start + "deg " + angle + "deg");
      if (gapDeg > 0) {
        var g0 = angle;
        angle += gapDeg;
        parts.push(track + " " + g0 + "deg " + angle + "deg");
      }
    }
    return "conic-gradient(from -90deg, " + parts.join(", ") + ")";
  }

  /** Same keys as transactions.js / overview.js — budgets reflect saved tx edits. */
  var TX_DELETED_KEY = "pf-tx-deleted-ids";
  var TX_OVERRIDES_KEY = "pf-tx-overrides";
  var TX_ADDED_KEY = "pf-tx-user-added";
  var PF_BUDGETS_STORAGE_KEY = "pf-budgets-app-state-v1";

  function txOvLoadDeletedIds() {
    try {
      var raw = localStorage.getItem(TX_DELETED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function txOvLoadOverrides() {
    try {
      var raw = localStorage.getItem(TX_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function txOvLoadAdded() {
    try {
      var raw = localStorage.getItem(TX_ADDED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function txOvApplyOverrides(tx, ov) {
    if (!ov) return tx;
    return {
      avatar: tx.avatar,
      name: ov.name !== undefined ? ov.name : tx.name,
      category: ov.category !== undefined ? ov.category : tx.category,
      date: ov.date !== undefined ? ov.date : tx.date,
      amount: ov.amount !== undefined ? ov.amount : tx.amount,
      recurring:
        ov.recurring !== undefined ? !!ov.recurring : !!tx.recurring,
      __txId: tx.__txId,
    };
  }

  function rebuildMainTransactionsFromStorage(jsonTransactions) {
    var deleted = txOvLoadDeletedIds();
    var overrides = txOvLoadOverrides();
    var added = txOvLoadAdded();

    var jsonPart = (jsonTransactions || [])
      .map(function (t, i) {
        var id = "tx-b-" + i;
        if (deleted.has(id)) return null;
        var tx = {
          avatar: t.avatar,
          name: t.name,
          category: t.category,
          date: t.date,
          amount: t.amount,
          recurring: !!t.recurring,
          __txId: id,
        };
        return txOvApplyOverrides(tx, overrides[id]);
      })
      .filter(Boolean);

    var addedPart = added.map(function (t) {
      return txOvApplyOverrides(t, overrides[t.__txId]);
    });

    return addedPart.concat(jsonPart);
  }

  function normalizeBudgetRow(b) {
    return {
      category: String(b && b.category !== undefined ? b.category : "General"),
      maximum: Number.isFinite(Number(b && b.maximum)) ? Number(b.maximum) : 0,
      theme: typeof (b && b.theme) === "string" ? b.theme : "#277C78",
    };
  }

  function loadBudgetsAppStateFromStorage(jsonBudgets) {
    try {
      var raw = localStorage.getItem(PF_BUDGETS_STORAGE_KEY);
      if (!raw) {
        return (jsonBudgets || []).slice().map(normalizeBudgetRow);
      }
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.budgets)) {
        return (jsonBudgets || []).slice().map(normalizeBudgetRow);
      }
      return o.budgets.map(normalizeBudgetRow);
    } catch (e) {
      return (jsonBudgets || []).slice().map(normalizeBudgetRow);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".budgets-page");
    if (!main) return;

    var donutEl = document.getElementById("budgets-page-donut");
    var centerSpent = document.getElementById("budgets-page-center-spent");
    var centerLimit = document.getElementById("budgets-page-center-limit");
    var legendEl = document.getElementById("budgets-page-legend");
    var cardsRoot = document.getElementById("budgets-cards-root");

    var budgetMonthYear = document.getElementById("budget-month-year");
    var budgetYearPanel = document.getElementById("budget-month-year-panel");
    var budgetMonthStrip = document.getElementById("budget-month-strip");

    var MONTH_STRIP_SLOTS = 7;
    var MONTH_STRIP_CENTER = 3;

    var addBtn = document.getElementById("budget-add-open");
    var addDialog = document.getElementById("budget-add-dialog");
    var addForm = document.getElementById("budget-add-form");
    var modalClose = document.getElementById("budget-modal-close");
    var catSelect = document.getElementById("budget-add-category");
    var maxInput = document.getElementById("budget-add-max");
    var themeSelect = document.getElementById("budget-add-theme");
    var themeSwatch = document.getElementById("budget-theme-swatch");
    var catBanner = document.getElementById("budget-modal-category-banner");
    var catErr = document.getElementById("budget-add-category-err");
    var maxErr = document.getElementById("budget-add-max-err");

    var deleteDialog = document.getElementById("budget-delete-dialog");
    var deleteClose = document.getElementById("budget-delete-close");
    var deleteYes = document.getElementById("budget-delete-yes");
    var deleteNo = document.getElementById("budget-delete-no");
    var deleteTitle = document.getElementById("budget-delete-title");
    var deleteLede = document.getElementById("budget-delete-lede");

    var editDialog = document.getElementById("budget-edit-dialog");
    var editForm = document.getElementById("budget-edit-form");
    var editClose = document.getElementById("budget-edit-close");
    var editCategory = document.getElementById("budget-edit-category");
    var editMax = document.getElementById("budget-edit-max");
    var editTheme = document.getElementById("budget-edit-theme");
    var editThemeSwatch = document.getElementById("budget-edit-theme-swatch");
    var editMaxErr = document.getElementById("budget-edit-max-err");

    var transactions = [];
    var budgetsState = [];
    var pendingDeleteIndex = null;
    var pendingEditIndex = null;

    var viewYear = new Date().getFullYear();
    var viewMonth = new Date().getMonth();

    function saveBudgetsAppState() {
      try {
        localStorage.setItem(
          PF_BUDGETS_STORAGE_KEY,
          JSON.stringify({ budgets: budgetsState })
        );
      } catch (e) {}
    }

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    function sumBudgetMaximums() {
      var s = 0;
      for (var i = 0; i < budgetsState.length; i++) {
        s += budgetsState[i].maximum;
      }
      return s;
    }

    function updateMonthCard(btn, y, m, isActive) {
      if (!btn) return;
      var cap = sumBudgetMaximums();
      var exp = totalExpenseInMonth(transactions, y, m);
      btn.classList.toggle("budgets-month-card--active", isActive);
      btn.classList.toggle("budgets-month-card--empty", cap <= 0);

      var label = btn.querySelector(".budgets-month-card__label");
      if (label) label.textContent = MONTH_SHORT[m];

      var ariaBase = monthAriaFmt.format(new Date(Date.UTC(y, m, 1)));
      btn.setAttribute(
        "aria-label",
        isActive
          ? ariaBase + ", selected"
          : "Show budgets for " + ariaBase
      );
      if (isActive) {
        btn.setAttribute("aria-current", "date");
      } else {
        btn.removeAttribute("aria-current");
      }

      var barA = btn.querySelector(".budgets-month-card__bar--solid");
      var barB = btn.querySelector(".budgets-month-card__bar--soft");
      if (cap <= 0) {
        if (barA) barA.style.removeProperty("height");
        if (barB) barB.style.removeProperty("height");
        return;
      }
      var pct = Math.min(exp / cap, 1);
      var hSolid = Math.max(pct * 100, 3);
      var hSoft = Math.max((1 - pct) * 100, 3);
      if (barA) barA.style.height = hSolid + "%";
      if (barB) barB.style.height = hSoft + "%";
    }

    function renderMonthNav() {
      if (!budgetMonthYear || !budgetMonthStrip) return;

      var buttons = budgetMonthStrip.querySelectorAll(".budgets-month-card");
      if (buttons.length !== MONTH_STRIP_SLOTS) return;

      budgetMonthYear.textContent = String(viewYear);

      for (var slot = 0; slot < MONTH_STRIP_SLOTS; slot++) {
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(viewYear, viewMonth, offset);
        updateMonthCard(buttons[slot], t.y, t.m, offset === 0);
      }
    }

    function closeAllBudgetMenus() {
      var wraps = document.querySelectorAll(".budget-card__menu-wrap");
      for (var w = 0; w < wraps.length; w++) {
        wraps[w].classList.remove("is-open");
        var dd = wraps[w].querySelector(".budget-card__dropdown");
        if (dd) dd.hidden = true;
        var mBtn = wraps[w].querySelector(".budget-card__menu");
        if (mBtn) mBtn.setAttribute("aria-expanded", "false");
      }
    }

    function closeDeleteDialog() {
      pendingDeleteIndex = null;
      if (deleteDialog && typeof deleteDialog.close === "function") {
        deleteDialog.close();
      }
    }

    function openDeleteConfirm(index) {
      var b = budgetsState[index];
      if (!b || !deleteDialog) return;
      pendingDeleteIndex = index;
      if (deleteTitle) deleteTitle.textContent = "Delete '" + b.category + "'";
      if (deleteLede) {
        deleteLede.textContent =
          "Are you sure you want to delete this budget? This action cannot be reversed, and all the data inside it will be removed forever.";
      }
      deleteDialog.showModal();
    }

    function confirmDeleteBudget() {
      if (pendingDeleteIndex === null) return;
      var idx = pendingDeleteIndex;
      closeDeleteDialog();
      if (idx >= 0 && idx < budgetsState.length) {
        budgetsState.splice(idx, 1);
        renderAll();
      }
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest(".budget-card__menu-wrap")) return;
      closeAllBudgetMenus();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeAllBudgetMenus();
    });

    function hideErr(el) {
      if (!el) return;
      el.hidden = true;
      el.textContent = "";
    }

    function showErr(el, msg) {
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
    }

    function syncThemeSwatch() {
      if (!themeSelect || !themeSwatch) return;
      var opt = themeSelect.options[themeSelect.selectedIndex];
      var hex = opt ? opt.value : "#C94736";
      themeSwatch.style.backgroundColor = hex;
    }

    function fillThemeSelect() {
      if (!themeSelect) return;
      themeSelect.innerHTML = "";
      for (var i = 0; i < THEME_PRESETS.length; i++) {
        var p = THEME_PRESETS[i];
        var opt = document.createElement("option");
        opt.value = p.hex;
        opt.textContent = p.label;
        themeSelect.appendChild(opt);
      }
      var redIdx = 0;
      for (var ri = 0; ri < THEME_PRESETS.length; ri++) {
        if (THEME_PRESETS[ri].label === "Red") {
          redIdx = ri;
          break;
        }
      }
      themeSelect.selectedIndex = redIdx;
      syncThemeSwatch();
    }

    function findThemePresetIndex(hex) {
      if (!hex) return -1;
      var h = String(hex).toLowerCase().trim();
      for (var i = 0; i < THEME_PRESETS.length; i++) {
        if (THEME_PRESETS[i].hex.toLowerCase() === h) return i;
      }
      return -1;
    }

    function populateThemeDropdown(selectEl) {
      if (!selectEl) return;
      selectEl.innerHTML = "";
      for (var i = 0; i < THEME_PRESETS.length; i++) {
        var p = THEME_PRESETS[i];
        var opt = document.createElement("option");
        opt.value = p.hex;
        opt.textContent = p.label;
        selectEl.appendChild(opt);
      }
    }

    function syncEditThemeSwatch() {
      if (!editTheme || !editThemeSwatch) return;
      var opt = editTheme.options[editTheme.selectedIndex];
      var hex = opt ? opt.value : "#277C78";
      editThemeSwatch.style.backgroundColor = hex;
    }

    function isCategoryUsedByOtherBudget(category, editIndex) {
      for (var k = 0; k < budgetsState.length; k++) {
        if (k === editIndex) continue;
        if (budgetsState[k].category === category) return true;
      }
      return false;
    }

    function fillEditCategorySelect(editIndex) {
      if (!editCategory || editIndex < 0 || editIndex >= budgetsState.length)
        return;
      var current = budgetsState[editIndex].category;
      editCategory.innerHTML = "";
      for (var j = 0; j < CATEGORY_OPTIONS.length; j++) {
        var cat = CATEGORY_OPTIONS[j];
        if (isCategoryUsedByOtherBudget(cat, editIndex) && cat !== current) {
          continue;
        }
        var opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        editCategory.appendChild(opt);
      }
      for (var s = 0; s < editCategory.options.length; s++) {
        if (editCategory.options[s].value === current) {
          editCategory.selectedIndex = s;
          break;
        }
      }
    }

    function openEditModal(index) {
      var b = budgetsState[index];
      if (!b || !editDialog || typeof editDialog.showModal !== "function") return;
      pendingEditIndex = index;
      hideErr(editMaxErr);
      if (editMax) editMax.removeAttribute("aria-invalid");

      fillEditCategorySelect(index);

      populateThemeDropdown(editTheme);
      var ti = findThemePresetIndex(b.theme);
      if (ti >= 0 && editTheme) {
        editTheme.selectedIndex = ti;
      } else if (editTheme) {
        var custom = document.createElement("option");
        custom.value = b.theme;
        custom.textContent = "Custom";
        editTheme.appendChild(custom);
        editTheme.selectedIndex = editTheme.options.length - 1;
      }

      if (editMax) editMax.value = String(b.maximum);

      syncEditThemeSwatch();
      editDialog.showModal();
      requestAnimationFrame(function () {
        if (editMax) {
          editMax.focus();
          editMax.select();
        }
      });
    }

    function closeEditModal() {
      pendingEditIndex = null;
      if (editDialog && typeof editDialog.close === "function") {
        editDialog.close();
      }
    }

    function refreshCategorySelect() {
      if (!catSelect) return;
      var used = {};
      for (var i = 0; i < budgetsState.length; i++) {
        used[budgetsState[i].category] = true;
      }
      catSelect.innerHTML = "";
      for (var j = 0; j < CATEGORY_OPTIONS.length; j++) {
        var cat = CATEGORY_OPTIONS[j];
        if (used[cat]) continue;
        var opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
      }
      if (catBanner) {
        var empty = catSelect.options.length === 0;
        catBanner.hidden = !empty;
        catSelect.disabled = empty;
      }
    }

    function openAddModal() {
      if (!addDialog || typeof addDialog.showModal !== "function") return;
      refreshCategorySelect();
      fillThemeSelect();
      if (maxInput) maxInput.value = "";
      hideErr(catErr);
      hideErr(maxErr);
      if (catSelect && catSelect.options.length > 0) catSelect.selectedIndex = 0;
      syncThemeSwatch();
      addDialog.showModal();
      requestAnimationFrame(function () {
        if (maxInput && !maxInput.disabled) maxInput.focus();
      });
    }

    function closeAddModal() {
      if (addDialog && typeof addDialog.close === "function") {
        addDialog.close();
      }
    }

    function renderDonutAndLegend() {
      var spents = [];
      var themes = [];
      var budgetLimit = 0;
      for (var bi = 0; bi < budgetsState.length; bi++) {
        var b = budgetsState[bi];
        themes.push(b.theme);
        spents.push(
          spentInMonth(transactions, b.category, viewYear, viewMonth)
        );
        budgetLimit += b.maximum;
      }
      var totalSpentBudget = 0;
      for (var si = 0; si < spents.length; si++) {
        totalSpentBudget += spents[si];
      }

      if (donutEl) {
        donutEl.style.background = buildConicGradient(spents, themes);
      }
      if (centerSpent) centerSpent.textContent = currency.format(totalSpentBudget);
      if (centerLimit) {
        centerLimit.textContent =
          "of " + currency.format(budgetLimit) + " limit";
      }

      if (legendEl) {
        legendEl.innerHTML = "";
        for (var li = 0; li < budgetsState.length; li++) {
          var row = document.createElement("div");
          row.className = "budgets-legend__row";

          var sw = document.createElement("span");
          sw.className = "budgets-legend__swatch";
          sw.style.backgroundColor = budgetsState[li].theme;
          sw.setAttribute("aria-hidden", "true");

          var lbl = document.createElement("span");
          lbl.className = "budgets-legend__label";
          lbl.textContent = budgetsState[li].category;

          var val = document.createElement("span");
          val.className = "budgets-legend__value";
          val.textContent =
            currency.format(spents[li]) +
            " of " +
            currency.format(budgetsState[li].maximum);

          row.appendChild(sw);
          row.appendChild(lbl);
          row.appendChild(val);
          legendEl.appendChild(row);
        }
      }
    }

    function renderCards() {
      if (!cardsRoot) return;
      cardsRoot.innerHTML = "";

      if (budgetsState.length === 0) {
        var empty = document.createElement("p");
        empty.className = "budgets-empty";
        empty.textContent = "No budgets yet. Add a budget to track spending by category.";
        cardsRoot.appendChild(empty);
        return;
      }

      for (var i = 0; i < budgetsState.length; i++) {
        var b = budgetsState[i];
        var spent = spentInMonth(
          transactions,
          b.category,
          viewYear,
          viewMonth
        );
        var remaining = b.maximum - spent;
        var pct = b.maximum > 0 ? Math.min((spent / b.maximum) * 100, 100) : 0;
        var latest = latestForCategoryInMonth(
          transactions,
          b.category,
          viewYear,
          viewMonth,
          3
        );

        var article = document.createElement("article");
        article.className = "budget-card";

        var header = document.createElement("header");
        header.className = "budget-card__header";

        var dot = document.createElement("span");
        dot.className = "budget-card__dot";
        dot.style.backgroundColor = b.theme;
        dot.setAttribute("aria-hidden", "true");

        var title = document.createElement("h3");
        title.className = "budget-card__title";
        title.textContent = b.category;

        var menuWrap = document.createElement("div");
        menuWrap.className = "budget-card__menu-wrap";

        var menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "budget-card__menu";
        menuBtn.setAttribute("aria-label", b.category + " budget options");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.setAttribute("aria-haspopup", "true");

        var menuImg = document.createElement("img");
        menuImg.src = "./assets/images/icon-ellipsis.svg";
        menuImg.alt = "";
        menuImg.width = 21;
        menuImg.height = 17;
        menuBtn.appendChild(menuImg);

        var dropdown = document.createElement("div");
        dropdown.className = "budget-card__dropdown";
        dropdown.setAttribute("role", "menu");
        dropdown.setAttribute("aria-label", b.category + " budget actions");
        dropdown.hidden = true;
        dropdown.id = "budget-dd-" + i;

        var editItem = document.createElement("button");
        editItem.type = "button";
        editItem.className = "budget-card__dropdown-item";
        editItem.setAttribute("role", "menuitem");
        editItem.textContent = "Edit Budget";

        var sep = document.createElement("div");
        sep.className = "budget-card__dropdown-sep";
        sep.setAttribute("role", "separator");

        var delItem = document.createElement("button");
        delItem.type = "button";
        delItem.className =
          "budget-card__dropdown-item budget-card__dropdown-item--danger";
        delItem.setAttribute("role", "menuitem");
        delItem.textContent = "Delete Budget";

        dropdown.appendChild(editItem);
        dropdown.appendChild(sep);
        dropdown.appendChild(delItem);

        menuBtn.setAttribute("aria-controls", dropdown.id);

        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(dropdown);

        (function (idx, wrap, btn, dd, ed, delb) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var wasOpen = !dd.hidden;
            closeAllBudgetMenus();
            if (!wasOpen) {
              dd.hidden = false;
              wrap.classList.add("is-open");
              btn.setAttribute("aria-expanded", "true");
            }
          });
          ed.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllBudgetMenus();
            openEditModal(idx);
          });
          delb.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllBudgetMenus();
            openDeleteConfirm(idx);
          });
        })(i, menuWrap, menuBtn, dropdown, editItem, delItem);

        header.appendChild(dot);
        header.appendChild(title);
        header.appendChild(menuWrap);

        var maxP = document.createElement("p");
        maxP.className = "budget-card__max";
        maxP.textContent = "Maximum of " + currency.format(b.maximum);

        var progress = document.createElement("div");
        progress.className = "budget-card__progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", String(b.maximum));
        progress.setAttribute("aria-valuenow", String(Math.min(spent, b.maximum)));
        var fill = document.createElement("span");
        fill.className = "budget-card__progress-fill";
        fill.style.width = pct + "%";
        fill.style.backgroundColor = b.theme;
        progress.appendChild(fill);

        var stats = document.createElement("div");
        stats.className = "budget-card__stats";

        var statSpent = document.createElement("div");
        statSpent.className = "budget-card__stat budget-card__stat--spent";
        var accSpent = document.createElement("span");
        accSpent.className = "budget-card__stat-accent";
        accSpent.style.backgroundColor = b.theme;
        var innerSpent = document.createElement("div");
        innerSpent.className = "budget-card__stat-inner";
        var valSpent = document.createElement("span");
        valSpent.className = "budget-card__stat-value";
        valSpent.textContent = currency.format(spent);
        var labSpent = document.createElement("span");
        labSpent.className = "budget-card__stat-label";
        labSpent.textContent = "Spent";
        innerSpent.appendChild(valSpent);
        innerSpent.appendChild(labSpent);
        statSpent.appendChild(accSpent);
        statSpent.appendChild(innerSpent);

        var divider = document.createElement("div");
        divider.className = "budget-card__stats-divider";
        divider.setAttribute("aria-hidden", "true");

        var statRem = document.createElement("div");
        statRem.className = "budget-card__stat budget-card__stat--remaining";
        var accRem = document.createElement("span");
        accRem.className = "budget-card__stat-accent";
        var innerRem = document.createElement("div");
        innerRem.className = "budget-card__stat-inner";
        var valRem = document.createElement("span");
        valRem.className = "budget-card__stat-value";
        valRem.textContent = currency.format(remaining);
        var labRem = document.createElement("span");
        labRem.className = "budget-card__stat-label";
        labRem.textContent = "Remaining";
        innerRem.appendChild(valRem);
        innerRem.appendChild(labRem);
        statRem.appendChild(accRem);
        statRem.appendChild(innerRem);

        stats.appendChild(statSpent);
        stats.appendChild(divider);
        stats.appendChild(statRem);

        var latestWrap = document.createElement("div");
        latestWrap.className = "budget-card__latest";

        var latestHead = document.createElement("div");
        latestHead.className =
          "budget-card__latest-header budget-card__latest-header--link-only";
        var seeAll = document.createElement("a");
        seeAll.className = "budget-card__latest-link";
        seeAll.href =
          "./transactions.html?category=" + encodeURIComponent(b.category);
        seeAll.textContent = "See All";
        var chev = document.createElement("img");
        chev.className = "budget-card__latest-link-icon";
        chev.src = "./assets/images/icon-caret-right.svg";
        chev.alt = "";
        chev.width = 6;
        chev.height = 11;
        seeAll.appendChild(chev);
        latestHead.appendChild(seeAll);

        var list = document.createElement("ul");
        list.className = "budget-card__tx-list";
        list.setAttribute(
          "aria-label",
          "Spending in " +
            monthAriaFmt.format(new Date(Date.UTC(viewYear, viewMonth, 1)))
        );

        for (var ti = 0; ti < latest.length; ti++) {
          var tx = latest[ti];
          var li = document.createElement("li");
          li.className = "budget-card__tx-item";

          var slot = document.createElement("div");
          slot.className = "budget-card__tx-avatar-slot";
          var avatarUrl = tx.avatar && String(tx.avatar).trim();
          if (!avatarUrl) {
            var fb0 = document.createElement("span");
            fb0.className = "budget-card__tx-fallback";
            if (typeof financeStyleCategoryFallback === "function") {
              financeStyleCategoryFallback(fb0, tx.category);
            }
            fb0.textContent = initials(tx.name);
            slot.appendChild(fb0);
          } else {
            var img = document.createElement("img");
            img.className = "budget-card__tx-avatar";
            img.alt = "";
            img.src = avatarUrl;
            img.loading = "lazy";
            (function (imgEl, cell, nm, cat) {
              imgEl.addEventListener("error", function () {
                imgEl.remove();
                var fb = document.createElement("span");
                fb.className = "budget-card__tx-fallback";
                if (typeof financeStyleCategoryFallback === "function") {
                  financeStyleCategoryFallback(fb, cat);
                }
                fb.textContent = initials(nm);
                cell.appendChild(fb);
              });
            })(img, slot, tx.name, tx.category);
            slot.appendChild(img);
          }

          var nmEl = document.createElement("p");
          nmEl.className = "budget-card__tx-name";
          nmEl.textContent = tx.name;

          var meta = document.createElement("div");
          meta.className = "budget-card__tx-meta";
          var am = document.createElement("p");
          am.className = "budget-card__tx-amount";
          am.textContent =
            (tx.amount >= 0 ? "+" : "-") +
            currency.format(Math.abs(tx.amount));
          var dt = document.createElement("p");
          dt.className = "budget-card__tx-date";
          dt.textContent = dateFmt.format(parseISO(tx.date));
          meta.appendChild(am);
          meta.appendChild(dt);

          li.appendChild(slot);
          li.appendChild(nmEl);
          li.appendChild(meta);
          list.appendChild(li);
        }

        latestWrap.appendChild(latestHead);
        latestWrap.appendChild(list);

        article.appendChild(header);
        article.appendChild(maxP);
        article.appendChild(progress);
        article.appendChild(stats);
        article.appendChild(latestWrap);

        cardsRoot.appendChild(article);
      }
    }

    function renderAll() {
      renderMonthNav();
      renderDonutAndLegend();
      renderCards();
      saveBudgetsAppState();
    }

    if (budgetMonthStrip) {
      budgetMonthStrip.addEventListener("click", function (e) {
        var btn = e.target.closest(".budgets-month-card");
        if (!btn || !budgetMonthStrip.contains(btn)) return;
        var buttons = budgetMonthStrip.querySelectorAll(".budgets-month-card");
        var slot = -1;
        for (var i = 0; i < buttons.length; i++) {
          if (buttons[i] === btn) {
            slot = i;
            break;
          }
        }
        if (slot < 0) return;
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(viewYear, viewMonth, offset);
        viewYear = t.y;
        viewMonth = t.m;
        renderAll();
      });
    }

    if (typeof initBudgetYearPicker === "function") {
      initBudgetYearPicker({
        button: budgetMonthYear,
        panel: budgetYearPanel,
        getYear: function () {
          return viewYear;
        },
        setYear: function (y) {
          viewYear = y;
        },
        onCommit: function () {
          renderAll();
        },
      });
    }

    if (themeSelect) {
      themeSelect.addEventListener("change", syncThemeSwatch);
    }

    if (editTheme) {
      editTheme.addEventListener("change", syncEditThemeSwatch);
    }

    if (editClose && editDialog) {
      editClose.addEventListener("click", closeEditModal);
    }

    if (editDialog) {
      editDialog.addEventListener("click", function (e) {
        if (e.target === editDialog) closeEditModal();
      });
    }

    if (editForm && editDialog) {
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(editMaxErr);
        if (pendingEditIndex === null) return;
        var idx = pendingEditIndex;
        var raw = editMax ? editMax.value.trim() : "";
        var maxNum = raw === "" ? NaN : Number(raw);
        if (!Number.isFinite(maxNum) || maxNum <= 0) {
          showErr(editMaxErr, "Enter a maximum spend greater than zero.");
          if (editMax) editMax.setAttribute("aria-invalid", "true");
          return;
        }
        if (editMax) editMax.removeAttribute("aria-invalid");

        var row = budgetsState[idx];
        if (!row) {
          closeEditModal();
          return;
        }
        row.maximum = maxNum;
        row.theme = editTheme ? editTheme.value : row.theme;
        if (editCategory) {
          row.category = editCategory.value;
        }
        closeEditModal();
        renderAll();
      });
    }

    if (addBtn && addDialog) {
      addBtn.addEventListener("click", openAddModal);
    }

    if (modalClose && addDialog) {
      modalClose.addEventListener("click", closeAddModal);
    }

    if (addDialog) {
      addDialog.addEventListener("click", function (e) {
        if (e.target === addDialog) closeAddModal();
      });
    }

    if (deleteYes) {
      deleteYes.addEventListener("click", confirmDeleteBudget);
    }
    if (deleteNo) {
      deleteNo.addEventListener("click", closeDeleteDialog);
    }
    if (deleteClose && deleteDialog) {
      deleteClose.addEventListener("click", closeDeleteDialog);
    }
    if (deleteDialog) {
      deleteDialog.addEventListener("click", function (e) {
        if (e.target === deleteDialog) closeDeleteDialog();
      });
    }

    if (addForm && addDialog) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(catErr);
        hideErr(maxErr);
        if (!catSelect || catSelect.disabled || catSelect.options.length === 0) {
          showErr(catErr, "No categories available to budget.");
          return;
        }
        var raw = maxInput ? maxInput.value.trim() : "";
        var maxNum = raw === "" ? NaN : Number(raw);
        if (!Number.isFinite(maxNum) || maxNum <= 0) {
          showErr(maxErr, "Enter a maximum spend greater than zero.");
          if (maxInput) maxInput.setAttribute("aria-invalid", "true");
          return;
        }
        if (maxInput) maxInput.removeAttribute("aria-invalid");

        var themeHex = themeSelect ? themeSelect.value : "#277C78";
        budgetsState.push({
          category: catSelect.value,
          maximum: maxNum,
          theme: themeHex,
        });
        renderAll();
        closeAddModal();
      });
    }

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        transactions = rebuildMainTransactionsFromStorage(
          data.transactions || []
        );
        budgetsState = loadBudgetsAppStateFromStorage(data.budgets || []);
        renderAll();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        var err = document.createElement("p");
        err.className = "budgets-error";
        err.setAttribute("role", "alert");
        err.textContent =
          "Could not load finance data. Serve this folder over HTTP so data.json can be fetched.";
        main.insertBefore(err, main.firstChild);
      });
  });
})();
