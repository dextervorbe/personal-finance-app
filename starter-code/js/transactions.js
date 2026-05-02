(function () {
  var PAGE_SIZE = 10;
  var NAME_MAX = 30;

  var CATEGORY_VALUES = [
    "",
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

  var currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  var dateFmt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
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

  function sumBudgetMaximums(budgets) {
    var s = 0;
    for (var i = 0; i < budgets.length; i++) {
      s += budgets[i].maximum;
    }
    return s;
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

  function filterByCalendarMonth(rows, year, monthIndex) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var d = parseISO(rows[i].date);
      if (d.getUTCFullYear() === year && d.getUTCMonth() === monthIndex) {
        out.push(rows[i]);
      }
    }
    return out;
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }

  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

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

  var MONTH_STRIP_SLOTS = 7;
  var MONTH_STRIP_CENTER = 3;

  function ordinalSuffix(day) {
    var d = Number(day);
    if (d >= 11 && d <= 13) return String(d) + "th";
    switch (d % 10) {
      case 1:
        return String(d) + "st";
      case 2:
        return String(d) + "nd";
      case 3:
        return String(d) + "rd";
      default:
        return String(d) + "th";
    }
  }

  function formatOrdinalDateDisplay(dateStr) {
    var parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var d = Number(parts[2]);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      m < 0 ||
      m > 11
    ) {
      return "";
    }
    return MONTH_NAMES[m] + " " + ordinalSuffix(d) + ", " + y;
  }

  function dateInputToISO(dateStr) {
    var parts = dateStr.split("-");
    if (parts.length !== 3) return new Date().toISOString();
    return new Date(
      Date.UTC(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        12,
        0,
        0,
      ),
    ).toISOString();
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  var TX_DELETED_KEY = "pf-tx-deleted-ids";
  var TX_OVERRIDES_KEY = "pf-tx-overrides";
  var TX_ADDED_KEY = "pf-tx-user-added";

  function loadDeletedIds() {
    try {
      var raw = localStorage.getItem(TX_DELETED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveDeletedIds(set) {
    try {
      localStorage.setItem(TX_DELETED_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function loadOverrides() {
    try {
      var raw = localStorage.getItem(TX_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(obj) {
    try {
      localStorage.setItem(TX_OVERRIDES_KEY, JSON.stringify(obj));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function loadAddedTransactions() {
    try {
      var raw = localStorage.getItem(TX_ADDED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveAddedTransactions(arr) {
    try {
      localStorage.setItem(TX_ADDED_KEY, JSON.stringify(arr));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function newUserTxId() {
    return (
      "tx-u-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 10)
    );
  }

  function applyTxOverrides(tx, ov) {
    if (!ov) return tx;
    return {
      avatar: tx.avatar,
      name: ov.name !== undefined ? ov.name : tx.name,
      category: ov.category !== undefined ? ov.category : tx.category,
      date: ov.date !== undefined ? ov.date : tx.date,
      amount: ov.amount !== undefined ? ov.amount : tx.amount,
      recurring: !!tx.recurring,
      __txId: tx.__txId,
    };
  }

  function isoToDateInputValue(iso) {
    var d = parseISO(iso);
    return (
      d.getUTCFullYear() +
      "-" +
      pad2(d.getUTCMonth() + 1) +
      "-" +
      pad2(d.getUTCDate())
    );
  }

  function rebuildTransactionsFromStorage(jsonTransactions) {
    var deleted = loadDeletedIds();
    var overrides = loadOverrides();
    var added = loadAddedTransactions();

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
        return applyTxOverrides(tx, overrides[id]);
      })
      .filter(Boolean);

    var addedPart = added.map(function (t) {
      return applyTxOverrides(t, overrides[t.__txId]);
    });

    return addedPart.concat(jsonPart);
  }

  function todayDateInputValue() {
    var now = new Date();
    return (
      now.getFullYear() +
      "-" +
      pad2(now.getMonth() + 1) +
      "-" +
      pad2(now.getDate())
    );
  }

  function toYMD(y, monthIndex0, day) {
    return y + "-" + pad2(monthIndex0 + 1) + "-" + pad2(day);
  }

  function formatCalendarAriaLabel(y, monthIndex0, day) {
    return MONTH_NAMES[monthIndex0] + " " + day + ", " + y;
  }

  function normalizeQueryCategory(raw) {
    if (!raw) return null;
    var decoded = decodeURIComponent(raw.trim());
    for (var i = 1; i < CATEGORY_VALUES.length; i++) {
      if (CATEGORY_VALUES[i] === decoded) return CATEGORY_VALUES[i];
    }
    return null;
  }

  function filterBySearch(rows, q) {
    if (!q) return rows;
    var lower = q.trim().toLowerCase();
    if (!lower) return rows;
    return rows.filter(function (t) {
      return t.name.toLowerCase().indexOf(lower) !== -1;
    });
  }

  function filterByCategory(rows, category) {
    if (!category) return rows;
    return rows.filter(function (t) {
      return t.category === category;
    });
  }

  function monthKeyUTC(iso) {
    var d = parseISO(iso);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1);
  }

  function formatMonthDividerHeading(iso) {
    var d = parseISO(iso);
    return MONTH_NAMES[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  /** Sum of outflows (negative amounts) per calendar month (UTC) for filtered rows */
  function computeMonthExpenseTotals(rows) {
    var totals = {};
    for (var i = 0; i < rows.length; i++) {
      var t = rows[i];
      var key = monthKeyUTC(t.date);
      if (!totals[key]) totals[key] = 0;
      if (t.amount < 0) totals[key] += Math.abs(t.amount);
    }
    return totals;
  }

  function renderMonthDivider(tbody, isoDate, monthTotalsMap) {
    var key = monthKeyUTC(isoDate);
    var total = monthTotalsMap[key] !== undefined ? monthTotalsMap[key] : 0;
    var tr = document.createElement("tr");
    tr.className = "tx-month-divider-row";
    var td = document.createElement("td");
    td.colSpan = 4;
    td.className = "tx-month-divider-cell";

    var wrap = document.createElement("div");
    wrap.className = "tx-month-divider";
    wrap.setAttribute(
      "aria-label",
      formatMonthDividerHeading(isoDate) +
        ", " +
        currency.format(total) +
        " total spend",
    );

    var monthEl = document.createElement("span");
    monthEl.className = "tx-month-divider__month";
    monthEl.textContent = formatMonthDividerHeading(isoDate);

    var totalEl = document.createElement("span");
    totalEl.className = "tx-month-divider__total";
    totalEl.textContent = currency.format(total) + " total spend";

    wrap.appendChild(monthEl);
    wrap.appendChild(totalEl);
    td.appendChild(wrap);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function sortRows(rows, mode) {
    var copy = rows.slice();
    switch (mode) {
      case "oldest":
        copy.sort(function (a, b) {
          return parseISO(a.date) - parseISO(b.date);
        });
        break;
      case "az":
        copy.sort(function (a, b) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        break;
      case "za":
        copy.sort(function (a, b) {
          return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
        });
        break;
      case "highest":
        copy.sort(function (a, b) {
          return Math.abs(b.amount) - Math.abs(a.amount);
        });
        break;
      case "lowest":
        copy.sort(function (a, b) {
          return Math.abs(a.amount) - Math.abs(b.amount);
        });
        break;
      case "latest":
      default:
        copy.sort(function (a, b) {
          return parseISO(b.date) - parseISO(a.date);
        });
        break;
    }
    return copy;
  }

  function renderRow(tbody, t) {
    var tr = document.createElement("tr");
    tr.className = "tx-table-row--interactive";
    tr.setAttribute("tabindex", "0");
    tr.dataset.txId = t.__txId || "";
    tr.setAttribute(
      "aria-label",
      "Edit transaction: " + (t.name || "Transaction")
    );

    var tdName = document.createElement("td");
    var cellName = document.createElement("div");
    cellName.className = "tx-cell-name";

    var slot = document.createElement("div");
    slot.className = "tx-avatar-slot";

    var img = document.createElement("img");
    img.className = "tx-avatar";
    img.alt = "";
    img.src = t.avatar;
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.remove();
      var fb = document.createElement("span");
      fb.className = "tx-avatar-fallback";
      fb.textContent = initials(t.name);
      slot.appendChild(fb);
    });

    slot.appendChild(img);

    var nameSpan = document.createElement("span");
    nameSpan.className = "tx-name-text";
    nameSpan.textContent = t.name;

    cellName.appendChild(slot);
    cellName.appendChild(nameSpan);
    tdName.appendChild(cellName);

    var tdCat = document.createElement("td");
    tdCat.className = "tx-category-cell";
    tdCat.textContent = t.category;

    var tdDate = document.createElement("td");
    tdDate.className = "tx-date-cell";
    tdDate.textContent = dateFmt.format(parseISO(t.date));

    var tdAmt = document.createElement("td");
    var isCredit = t.amount >= 0;
    tdAmt.className =
      "tx-amount-cell " +
      (isCredit ? "tx-amount-cell--credit" : "tx-amount-cell--debit");
    tdAmt.textContent =
      (isCredit ? "+" : "-") + currency.format(Math.abs(t.amount));

    tr.appendChild(tdName);
    tr.appendChild(tdCat);
    tr.appendChild(tdDate);
    tr.appendChild(tdAmt);

    tbody.appendChild(tr);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".transactions-page");
    if (!main) return;

    var tbody = document.getElementById("transactions-tbody");
    var emptyEl = document.getElementById("transactions-empty");
    var searchEl = document.getElementById("tx-search");
    var sortEl = document.getElementById("tx-sort");
    var catEl = document.getElementById("tx-category");
    var prevBtn = document.getElementById("tx-prev");
    var nextBtn = document.getElementById("tx-next");
    var pagesEl = document.getElementById("tx-pages");
    var pagNav = document.getElementById("tx-pagination");

    var addOpenBtn = document.getElementById("tx-add-open");
    var addDialog = document.getElementById("tx-add-dialog");
    var addForm = document.getElementById("tx-add-form");
    var modalCloseBtn = document.getElementById("tx-modal-close");
    var addName = document.getElementById("tx-add-name");
    var addNameCount = document.getElementById("tx-add-name-count");
    var addNameErr = document.getElementById("tx-add-name-err");
    var addDate = document.getElementById("tx-add-date");
    var addDateDisplay = document.getElementById("tx-add-date-display");
    var addDateErr = document.getElementById("tx-add-date-err");
    var addAmount = document.getElementById("tx-add-amount");
    var addAmountErr = document.getElementById("tx-add-amount-err");
    var addRecurring = document.getElementById("tx-add-recurring");

    var dateWrap = document.querySelector(".tx-modal-field-date-wrap");
    var txDateTrigger = document.getElementById("tx-date-trigger");
    var txDateCalendar = document.getElementById("tx-date-calendar");
    var txCalTitle = document.getElementById("tx-cal-title");
    var txCalGrid = document.getElementById("tx-cal-grid");
    var txCalPrev = document.getElementById("tx-cal-prev");
    var txCalNext = document.getElementById("tx-cal-next");

    var calendarOpen = false;
    var viewYear = new Date().getFullYear();
    var viewMonth = new Date().getMonth();

    var allTransactions = [];
    var jsonTransactionsCache = [];
    var budgetsData = [];
    var currentPage = 1;
    var pendingDeleteTxId = null;

    var txMonthYear = document.getElementById("tx-month-year");
    var txYearPanel = document.getElementById("tx-month-year-panel");
    var txMonthStrip = document.getElementById("tx-month-strip");
    var monthNavYear = new Date().getFullYear();
    var monthNavMonth = new Date().getMonth();

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    var editDialog = document.getElementById("tx-edit-dialog");
    var editCloseBtn = document.getElementById("tx-edit-close");
    var editForm = document.getElementById("tx-edit-form");
    var editId = document.getElementById("tx-edit-id");
    var editName = document.getElementById("tx-edit-name");
    var editCategory = document.getElementById("tx-edit-category");
    var editDate = document.getElementById("tx-edit-date");
    var editAmount = document.getElementById("tx-edit-amount");
    var editNameErr = document.getElementById("tx-edit-name-err");
    var editDateErr = document.getElementById("tx-edit-date-err");
    var editAmountErr = document.getElementById("tx-edit-amount-err");
    var editRemoveBtn = document.getElementById("tx-edit-remove");

    var deleteDialog = document.getElementById("tx-delete-dialog");
    var deleteCloseBtn = document.getElementById("tx-delete-close");
    var deleteYesBtn = document.getElementById("tx-delete-yes");
    var deleteNoBtn = document.getElementById("tx-delete-no");
    var deleteTitleEl = document.getElementById("tx-delete-title");
    var deleteLedeEl = document.getElementById("tx-delete-lede");

    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalizeQueryCategory(params.get("category"));
    if (fromUrl) catEl.value = fromUrl;

    function rebuildAllFromCache() {
      allTransactions = rebuildTransactionsFromStorage(jsonTransactionsCache);
    }

    function findTxById(id) {
      for (var fi = 0; fi < allTransactions.length; fi++) {
        if (allTransactions[fi].__txId === id) return allTransactions[fi];
      }
      return null;
    }

    function clearEditErrors() {
      if (editNameErr) {
        editNameErr.hidden = true;
        editNameErr.textContent = "";
      }
      if (editDateErr) {
        editDateErr.hidden = true;
        editDateErr.textContent = "";
      }
      if (editAmountErr) {
        editAmountErr.hidden = true;
        editAmountErr.textContent = "";
      }
      if (editName) editName.removeAttribute("aria-invalid");
      if (editDate) editDate.removeAttribute("aria-invalid");
      if (editAmount) editAmount.removeAttribute("aria-invalid");
    }

    function closeEditModal() {
      if (editDialog && typeof editDialog.close === "function") {
        editDialog.close();
      }
    }

    function openEditModal(tx) {
      if (!editDialog || typeof editDialog.showModal !== "function") return;
      clearEditErrors();
      if (editId) editId.value = tx.__txId || "";
      if (editName) editName.value = tx.name || "";
      if (editCategory) editCategory.value = tx.category || "General";
      if (editDate) editDate.value = isoToDateInputValue(tx.date);
      if (editAmount) editAmount.value = String(tx.amount);
      editDialog.showModal();
      requestAnimationFrame(function () {
        if (editName) editName.focus();
      });
    }

    function closeDeleteModal() {
      if (deleteDialog && typeof deleteDialog.close === "function") {
        deleteDialog.close();
      }
    }

    function openDeleteConfirm(txId, displayName) {
      if (!deleteDialog || typeof deleteDialog.showModal !== "function") return;
      pendingDeleteTxId = txId;
      if (deleteTitleEl) {
        deleteTitleEl.textContent = "Delete '" + displayName + "'";
      }
      if (deleteLedeEl) {
        deleteLedeEl.textContent =
          "Are you sure you want to delete this transaction? This action cannot be reversed, and all the data inside it will be removed forever.";
      }
      closeEditModal();
      deleteDialog.showModal();
    }

    function confirmDeleteTransaction() {
      if (!pendingDeleteTxId) return;
      var id = pendingDeleteTxId;
      var ovs = loadOverrides();
      delete ovs[id];
      saveOverrides(ovs);

      if (id.indexOf("tx-u-") === 0) {
        saveAddedTransactions(
          loadAddedTransactions().filter(function (t) {
            return t.__txId !== id;
          })
        );
      } else {
        var del = loadDeletedIds();
        del.add(id);
        saveDeletedIds(del);
      }

      if (deleteDialog && typeof deleteDialog.close === "function") {
        deleteDialog.close();
      }
      rebuildAllFromCache();
      applyFilters();
    }

    function updateMonthCard(btn, y, m, isActive) {
      if (!btn) return;
      var cap = sumBudgetMaximums(budgetsData);
      var exp = totalExpenseInMonth(allTransactions, y, m);
      btn.classList.toggle("budgets-month-card--active", isActive);
      btn.classList.toggle("budgets-month-card--empty", cap <= 0);

      var label = btn.querySelector(".budgets-month-card__label");
      if (label) label.textContent = MONTH_SHORT[m];

      var ariaBase = monthAriaFmt.format(new Date(Date.UTC(y, m, 1)));
      btn.setAttribute(
        "aria-label",
        isActive
          ? ariaBase + ", selected"
          : "Show transactions for " + ariaBase
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
      if (!txMonthYear || !txMonthStrip) return;

      var buttons = txMonthStrip.querySelectorAll(".budgets-month-card");
      if (buttons.length !== MONTH_STRIP_SLOTS) return;

      txMonthYear.textContent = String(monthNavYear);

      for (var slot = 0; slot < MONTH_STRIP_SLOTS; slot++) {
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(monthNavYear, monthNavMonth, offset);
        updateMonthCard(buttons[slot], t.y, t.m, offset === 0);
      }
    }

    function applyFilters() {
      var q = searchEl.value;
      var sortMode = sortEl.value;
      var cat = catEl.value;

      var rows = filterByCategory(allTransactions, cat);
      rows = filterBySearch(rows, q);
      rows = filterByCalendarMonth(rows, monthNavYear, monthNavMonth);
      rows = sortRows(rows, sortMode);

      var total = rows.length;
      var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      tbody.innerHTML = "";
      if (total === 0) {
        emptyEl.hidden = false;
        emptyEl.removeAttribute("aria-hidden");
      } else {
        emptyEl.hidden = true;
        emptyEl.setAttribute("aria-hidden", "true");
        var start = (currentPage - 1) * PAGE_SIZE;
        var slice = rows.slice(start, start + PAGE_SIZE);
        var monthTotalsMap = computeMonthExpenseTotals(rows);
        var useMonthDividers =
          sortMode === "latest" || sortMode === "oldest";
        var prevMonthKey = null;
        for (var i = 0; i < slice.length; i++) {
          var tx = slice[i];
          if (useMonthDividers) {
            var mk = monthKeyUTC(tx.date);
            if (mk !== prevMonthKey) {
              renderMonthDivider(tbody, tx.date, monthTotalsMap);
              prevMonthKey = mk;
            }
          }
          renderRow(tbody, tx);
        }
      }

      pagNav.hidden = total === 0;

      renderPagination(totalPages, total);
      renderMonthNav();
    }

    function renderPagination(totalPages, totalCount) {
      pagesEl.innerHTML = "";

      prevBtn.disabled = currentPage <= 1 || totalCount === 0;
      nextBtn.disabled = currentPage >= totalPages || totalCount === 0;

      for (var p = 1; p <= totalPages; p++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pagination-page-btn";
        btn.textContent = String(p);
        btn.setAttribute("aria-label", "Page " + p);
        if (p === currentPage) btn.setAttribute("aria-current", "page");
        (function (pageNum) {
          btn.addEventListener("click", function () {
            currentPage = pageNum;
            applyFilters();
          });
        })(p);
        pagesEl.appendChild(btn);
      }
    }

    searchEl.addEventListener("input", function () {
      currentPage = 1;
      applyFilters();
    });

    sortEl.addEventListener("change", function () {
      currentPage = 1;
      applyFilters();
    });

    catEl.addEventListener("change", function () {
      currentPage = 1;
      var v = catEl.value;
      var url = new URL(window.location.href);
      if (v) url.searchParams.set("category", v);
      else url.searchParams.delete("category");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      applyFilters();
    });

    prevBtn.addEventListener("click", function () {
      if (currentPage > 1) {
        currentPage--;
        applyFilters();
      }
    });

    nextBtn.addEventListener("click", function () {
      currentPage++;
      applyFilters();
    });

    if (txMonthStrip) {
      txMonthStrip.addEventListener("click", function (e) {
        var btn = e.target.closest(".budgets-month-card");
        if (!btn || !txMonthStrip.contains(btn)) return;
        var buttons = txMonthStrip.querySelectorAll(".budgets-month-card");
        var slot = -1;
        for (var i = 0; i < buttons.length; i++) {
          if (buttons[i] === btn) {
            slot = i;
            break;
          }
        }
        if (slot < 0) return;
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(monthNavYear, monthNavMonth, offset);
        monthNavYear = t.y;
        monthNavMonth = t.m;
        currentPage = 1;
        applyFilters();
      });
    }

    if (typeof initBudgetYearPicker === "function") {
      initBudgetYearPicker({
        button: txMonthYear,
        panel: txYearPanel,
        getYear: function () {
          return monthNavYear;
        },
        setYear: function (y) {
          monthNavYear = y;
        },
        onCommit: function () {
          currentPage = 1;
          applyFilters();
        },
      });
    }

    function hideErr(el) {
      el.hidden = true;
      el.textContent = "";
    }

    function showErr(el, msg) {
      el.hidden = false;
      el.textContent = msg;
    }

    function clearAddFormErrors() {
      hideErr(addNameErr);
      hideErr(addDateErr);
      hideErr(addAmountErr);
      addName.removeAttribute("aria-invalid");
      addAmount.removeAttribute("aria-invalid");
      addDate.removeAttribute("aria-invalid");
    }

    function updateNameCounter() {
      var left = NAME_MAX - addName.value.length;
      addNameCount.textContent =
        left + " of " + NAME_MAX + " characters left";
    }

    function updateDateOrdinalDisplay() {
      addDateDisplay.textContent = formatOrdinalDateDisplay(addDate.value);
    }

    function syncViewFromHiddenDate() {
      var v = addDate.value;
      if (!v) {
        var nowEmpty = new Date();
        viewYear = nowEmpty.getFullYear();
        viewMonth = nowEmpty.getMonth();
        return;
      }
      var p = v.split("-");
      if (p.length !== 3) return;
      var y = Number(p[0]);
      var m = Number(p[1]) - 1;
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11)
        return;
      viewYear = y;
      viewMonth = m;
    }

    function renderCalendar() {
      if (!txCalTitle || !txCalGrid) return;
      txCalTitle.textContent = MONTH_NAMES[viewMonth] + " " + viewYear;
      txCalGrid.innerHTML = "";

      var sel = addDate.value;
      var dim = new Date(viewYear, viewMonth + 1, 0).getDate();
      var prevDim = new Date(viewYear, viewMonth, 0).getDate();
      var startPad = new Date(viewYear, viewMonth, 1).getDay();
      var nCells = Math.ceil((startPad + dim) / 7) * 7;

      for (var i = 0; i < nCells; i++) {
        var dayNum = i - startPad + 1;
        var mIdx = viewMonth;
        var y = viewYear;
        var displayDay;
        var isOutside = false;

        if (dayNum < 1) {
          isOutside = true;
          mIdx = viewMonth === 0 ? 11 : viewMonth - 1;
          y = viewMonth === 0 ? viewYear - 1 : viewYear;
          displayDay = prevDim + dayNum;
        } else if (dayNum > dim) {
          isOutside = true;
          mIdx = viewMonth === 11 ? 0 : viewMonth + 1;
          y = viewMonth === 11 ? viewYear + 1 : viewYear;
          displayDay = dayNum - dim;
        } else {
          displayDay = dayNum;
        }

        var cellYmd = toYMD(y, mIdx, displayDay);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tx-cal__day";
        if (isOutside) btn.classList.add("tx-cal__day--outside");
        if (cellYmd === sel) {
          btn.classList.add("tx-cal__day--selected");
          btn.setAttribute("aria-current", "date");
        }
        btn.textContent = String(displayDay);
        btn.setAttribute(
          "aria-label",
          formatCalendarAriaLabel(y, mIdx, displayDay),
        );

        (function (ymd, vy, vm) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            addDate.value = ymd;
            updateDateOrdinalDisplay();
            viewYear = vy;
            viewMonth = vm;
            closeCalendar();
          });
        })(cellYmd, y, mIdx);

        txCalGrid.appendChild(btn);
      }
    }

    function docCloseCal(e) {
      if (!calendarOpen || !dateWrap) return;
      if (!dateWrap.contains(e.target)) closeCalendar();
    }

    function closeCalendar() {
      if (!calendarOpen) return;
      calendarOpen = false;
      if (txDateCalendar) txDateCalendar.hidden = true;
      if (txDateTrigger)
        txDateTrigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", docCloseCal);
    }

    function openCalendar() {
      syncViewFromHiddenDate();
      renderCalendar();
      if (txDateCalendar) txDateCalendar.hidden = false;
      if (txDateTrigger) txDateTrigger.setAttribute("aria-expanded", "true");
      calendarOpen = true;
      setTimeout(function () {
        document.addEventListener("mousedown", docCloseCal);
      }, 0);
    }

    function openAddModal() {
      if (!addDialog || typeof addDialog.showModal !== "function") return;
      closeCalendar();
      addForm.reset();
      addDate.value = todayDateInputValue();
      syncViewFromHiddenDate();
      updateDateOrdinalDisplay();
      updateNameCounter();
      clearAddFormErrors();
      addDialog.showModal();
      requestAnimationFrame(function () {
        addName.focus();
      });
    }

    function closeAddModal() {
      if (addDialog && typeof addDialog.close === "function") {
        addDialog.close();
      }
    }

    if (addOpenBtn && addDialog) {
      addOpenBtn.addEventListener("click", openAddModal);
    }

    if (modalCloseBtn && addDialog) {
      modalCloseBtn.addEventListener("click", closeAddModal);
    }

    if (addDialog) {
      addDialog.addEventListener("click", function (e) {
        if (e.target === addDialog) closeAddModal();
      });
      addDialog.addEventListener("cancel", function (e) {
        if (calendarOpen) {
          e.preventDefault();
          closeCalendar();
        }
      });
      addDialog.addEventListener("close", function () {
        closeCalendar();
      });
    }

    if (txDateTrigger && txDateCalendar) {
      txDateTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        if (calendarOpen) closeCalendar();
        else openCalendar();
      });
    }

    if (txCalPrev) {
      txCalPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        if (viewMonth === 0) {
          viewMonth = 11;
          viewYear--;
        } else {
          viewMonth--;
        }
        renderCalendar();
      });
    }

    if (txCalNext) {
      txCalNext.addEventListener("click", function (e) {
        e.stopPropagation();
        if (viewMonth === 11) {
          viewMonth = 0;
          viewYear++;
        } else {
          viewMonth++;
        }
        renderCalendar();
      });
    }

    if (addName && addNameCount) {
      addName.addEventListener("input", updateNameCounter);
    }

    if (addForm && addDialog) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        clearAddFormErrors();

        var nameVal = addName.value.trim();
        var ok = true;

        if (!nameVal) {
          showErr(addNameErr, "Enter a name.");
          addName.setAttribute("aria-invalid", "true");
          ok = false;
        } else if (nameVal.length > NAME_MAX) {
          showErr(addNameErr, "Name must be " + NAME_MAX + " characters or fewer.");
          addName.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (!addDate.value) {
          showErr(addDateErr, "Choose a transaction date.");
          addDate.setAttribute("aria-invalid", "true");
          ok = false;
        }

        var amtRaw = addAmount.value.trim();
        var amtNum = amtRaw === "" ? NaN : Number(amtRaw);
        if (amtRaw === "" || !Number.isFinite(amtNum)) {
          showErr(addAmountErr, "Enter a valid amount.");
          addAmount.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (!ok) return;

        var cat = document.getElementById("tx-add-category").value;
        var newTx = {
          __txId: newUserTxId(),
          avatar: "./assets/images/avatars/__new__.jpg",
          name: nameVal,
          category: cat,
          date: dateInputToISO(addDate.value),
          amount: amtNum,
          recurring: addRecurring.checked,
        };
        var addedList = loadAddedTransactions();
        addedList.unshift(newTx);
        saveAddedTransactions(addedList);
        rebuildAllFromCache();

        currentPage = 1;
        applyFilters();
        closeAddModal();
      });
    }

    if (tbody) {
      tbody.addEventListener("click", function (e) {
        var tr = e.target.closest("tr.tx-table-row--interactive");
        if (!tr || !tbody.contains(tr)) return;
        var tid = tr.dataset.txId;
        if (!tid) return;
        var txRow = findTxById(tid);
        if (txRow) openEditModal(txRow);
      });

      tbody.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var tr = e.target.closest("tr.tx-table-row--interactive");
        if (!tr || !tbody.contains(tr)) return;
        if (e.key === " ") e.preventDefault();
        var tid = tr.dataset.txId;
        if (!tid) return;
        var txRow = findTxById(tid);
        if (txRow) openEditModal(txRow);
      });
    }

    if (editCloseBtn) {
      editCloseBtn.addEventListener("click", closeEditModal);
    }
    if (editDialog) {
      editDialog.addEventListener("click", function (e) {
        if (e.target === editDialog) closeEditModal();
      });
    }

    if (editForm && editDialog) {
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        clearEditErrors();
        var tid = editId ? editId.value : "";
        if (!tid) return;

        var nameVal = editName ? editName.value.trim() : "";
        var ok = true;
        if (!nameVal) {
          if (editNameErr) {
            editNameErr.textContent = "Enter a name.";
            editNameErr.hidden = false;
          }
          if (editName) editName.setAttribute("aria-invalid", "true");
          ok = false;
        } else if (nameVal.length > NAME_MAX) {
          if (editNameErr) {
            editNameErr.textContent =
              "Name must be " + NAME_MAX + " characters or fewer.";
            editNameErr.hidden = false;
          }
          if (editName) editName.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (!editDate || !editDate.value) {
          if (editDateErr) {
            editDateErr.textContent = "Choose a transaction date.";
            editDateErr.hidden = false;
          }
          if (editDate) editDate.setAttribute("aria-invalid", "true");
          ok = false;
        }

        var amtRaw = editAmount ? editAmount.value.trim() : "";
        var amtNum = amtRaw === "" ? NaN : Number(amtRaw);
        if (amtRaw === "" || !Number.isFinite(amtNum)) {
          if (editAmountErr) {
            editAmountErr.textContent = "Enter a valid amount.";
            editAmountErr.hidden = false;
          }
          if (editAmount) editAmount.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (!ok) return;

        var catVal = editCategory ? editCategory.value : "General";
        var isoDate = dateInputToISO(editDate.value);

        var ov = loadOverrides();
        ov[tid] = {
          name: nameVal,
          category: catVal,
          date: isoDate,
          amount: amtNum,
        };
        saveOverrides(ov);
        rebuildAllFromCache();
        applyFilters();
        closeEditModal();
      });
    }

    if (editRemoveBtn) {
      editRemoveBtn.addEventListener("click", function () {
        var tid = editId ? editId.value : "";
        if (!tid) return;
        var txRow = findTxById(tid);
        var label = txRow ? txRow.name : "";
        openDeleteConfirm(tid, label || "Transaction");
      });
    }

    if (deleteYesBtn) {
      deleteYesBtn.addEventListener("click", confirmDeleteTransaction);
    }
    if (deleteNoBtn) {
      deleteNoBtn.addEventListener("click", closeDeleteModal);
    }
    if (deleteCloseBtn) {
      deleteCloseBtn.addEventListener("click", closeDeleteModal);
    }
    if (deleteDialog) {
      deleteDialog.addEventListener("click", function (e) {
        if (e.target === deleteDialog) closeDeleteModal();
      });
      deleteDialog.addEventListener("close", function () {
        pendingDeleteTxId = null;
      });
    }

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        jsonTransactionsCache = data.transactions || [];
        budgetsData = data.budgets || [];
        rebuildAllFromCache();
        applyFilters();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        tbody.innerHTML = "";
        emptyEl.hidden = true;
        var err = document.createElement("p");
        err.className = "transactions-error";
        err.setAttribute("role", "alert");
        err.textContent =
          "Could not load finance data. Serve this folder over HTTP so data.json can be fetched.";
        main.querySelector(".transactions-panel").prepend(err);
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pagesEl.innerHTML = "";
        pagNav.hidden = true;
      });
  });
})();
