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

  var MONTH_STRIP_SLOTS = 7;
  var MONTH_STRIP_CENTER = 3;

  var CATEGORY_ACCENT = {
    Entertainment: "#C94736",
    Bills: "#277C78",
    Groceries: "#82C9D7",
    "Dining Out": "#3F82B2",
    Transportation: "#F2CDAC",
    "Personal Care": "#67C7C9",
    Education: "#D946B8",
    Lifestyle: "#826CB0",
    Shopping: "#626070",
    General: "#6B7F59",
  };

  var currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  function parseISO(iso) {
    return new Date(iso);
  }

  function addCalendarMonths(year, monthIndex, delta) {
    var d = new Date(Date.UTC(year, monthIndex + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
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

  function sumBudgetMaximums(budgets) {
    var s = 0;
    for (var i = 0; i < budgets.length; i++) {
      s += budgets[i].maximum;
    }
    return s;
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }

  function latestTransactionDate(transactions) {
    if (!transactions || transactions.length === 0) return new Date();
    var latest = parseISO(transactions[0].date);
    for (var i = 1; i < transactions.length; i++) {
      var d = parseISO(transactions[i].date);
      if (d > latest) latest = d;
    }
    return latest;
  }

  function uniqueRecurringLatest(transactions) {
    var map = new Map();
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (!t.recurring) continue;
      var prev = map.get(t.name);
      if (!prev || parseISO(t.date) > parseISO(prev.date)) {
        map.set(t.name, t);
      }
    }
    return Array.from(map.values());
  }

  function paidRecurringInMonth(transactions, year, monthIndex) {
    var out = [];
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (!t.recurring) continue;
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) continue;
      out.push(t);
    }
    return out;
  }

  var STORAGE_KEY = "pf-recurring-paid-overrides";
  var REMOVED_KEY = "pf-recurring-removed-bills";

  function yearMonthKey(y, m0) {
    return y + "-" + String(m0 + 1).padStart(2, "0");
  }

  function loadPaidOverrides() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function savePaidOverrides(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function setManualPaidForMonth(y, m0, name, paid) {
    var all = loadPaidOverrides();
    var k = yearMonthKey(y, m0);
    if (!all[k]) all[k] = {};
    if (paid) {
      all[k][name] = true;
    } else {
      delete all[k][name];
      if (Object.keys(all[k]).length === 0) delete all[k];
    }
    savePaidOverrides(all);
  }

  function stripManualPaidForName(name) {
    var all = loadPaidOverrides();
    var changed = false;
    for (var k in all) {
      if (all[k] && all[k][name]) {
        delete all[k][name];
        changed = true;
        if (Object.keys(all[k]).length === 0) delete all[k];
      }
    }
    if (changed) savePaidOverrides(all);
  }

  function loadRemovedBillNames() {
    try {
      var raw = localStorage.getItem(REMOVED_KEY);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveRemovedBillNames(set) {
    try {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* quota / private mode */
    }
  }

  var BILL_PROPS_KEY = "pf-recurring-bill-props";

  function loadBillProps() {
    try {
      var raw = localStorage.getItem(BILL_PROPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveBillProps(all) {
    try {
      localStorage.setItem(BILL_PROPS_KEY, JSON.stringify(all));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function stripBillPropsForName(name) {
    var all = loadBillProps();
    if (!all[name]) return;
    delete all[name];
    saveBillProps(all);
  }

  function effectiveDisplayName(template) {
    var p = loadBillProps()[template.name];
    if (p && p.displayName && String(p.displayName).trim()) {
      return String(p.displayName).trim();
    }
    return template.name;
  }

  function effectiveAmount(template) {
    var p = loadBillProps()[template.name];
    if (
      p &&
      typeof p.amount === "number" &&
      !isNaN(p.amount) &&
      p.amount >= 0
    ) {
      return p.amount;
    }
    return Math.abs(template.amount);
  }

  function effectiveDueDay(template) {
    var p = loadBillProps()[template.name];
    if (
      p &&
      typeof p.dueDay === "number" &&
      p.dueDay >= 1 &&
      p.dueDay <= 31
    ) {
      return p.dueDay;
    }
    return parseISO(template.date).getUTCDate();
  }

  function dayOrdinalFromDay(day) {
    var j = day % 10;
    var k = day % 100;
    if (j === 1 && k !== 11) return day + "st";
    if (j === 2 && k !== 12) return day + "nd";
    if (j === 3 && k !== 13) return day + "rd";
    return day + "th";
  }

  function persistBillProps(canonicalName, template, fields) {
    var all = loadBillProps();
    var entry = {};
    var baseAmount = Math.abs(template.amount);
    var baseDay = parseISO(template.date).getUTCDate();

    var dn = String(fields.displayName || "").trim();
    if (dn && dn !== canonicalName) {
      entry.displayName = dn;
    }

    var am = fields.amount;
    if (typeof am === "number" && !isNaN(am) && am >= 0) {
      if (Math.abs(am - baseAmount) >= 0.005) {
        entry.amount = am;
      }
    }

    var dd = fields.dueDay;
    if (typeof dd === "number" && !isNaN(dd) && dd >= 1 && dd <= 31) {
      if (dd !== baseDay) {
        entry.dueDay = dd;
      }
    }

    if (Object.keys(entry).length === 0) {
      delete all[canonicalName];
    } else {
      all[canonicalName] = entry;
    }
    saveBillProps(all);
  }

  function addRemovedBillName(name) {
    var s = loadRemovedBillNames();
    s.add(name);
    saveRemovedBillNames(s);
    stripManualPaidForName(name);
    stripBillPropsForName(name);
  }

  function recurringTemplatesVisible(transactions, removedSet) {
    return uniqueRecurringLatest(transactions).filter(function (v) {
      return !removedSet.has(v.name);
    });
  }

  function hasRecurringPaymentTx(transactions, name, y, m0) {
    var paid = paidRecurringInMonth(transactions, y, m0);
    for (var i = 0; i < paid.length; i++) {
      if (paid[i].name === name) return true;
    }
    return false;
  }

  function unpaidTemplatesForPaidSet(transactions, paidSet, removedSet) {
    var templates = recurringTemplatesVisible(transactions, removedSet);
    return templates.filter(function (v) {
      return !paidSet.has(v.name);
    });
  }

  function addUTCDays(date, days) {
    var d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  function dueSoonStats(
    transactions,
    referenceDate,
    year,
    monthIndex,
    paidSet,
    removedSet
  ) {
    var unpaid = unpaidTemplatesForPaidSet(transactions, paidSet, removedSet);
    var start = addUTCDays(referenceDate, 1);
    start.setUTCHours(0, 0, 0, 0);
    var end = addUTCDays(referenceDate, 5);
    end.setUTCHours(23, 59, 59, 999);

    var count = 0;
    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      var v = unpaid[i];
      var dueDay = effectiveDueDay(v);
      var amt = effectiveAmount(v);
      var due = new Date(Date.UTC(year, monthIndex, dueDay));
      if (due >= start && due <= end) {
        count += 1;
        sum += amt;
      }
    }
    return { count: count, sum: sum };
  }

  function categoryAccent(cat) {
    return CATEGORY_ACCENT[cat] || "#277C78";
  }

  function formatSummaryLine(count, sum) {
    return count + " (" + currency.format(sum) + ")";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".recurring-page");
    if (!main) return;

    var recurringMonthYear = document.getElementById("recurring-month-year");
    var recurringMonthStrip = document.getElementById("recurring-month-strip");

    var totalEl = document.getElementById("recurring-total-bills");
    var paidEl = document.getElementById("recurring-summary-paid");
    var upcomingEl = document.getElementById("recurring-summary-upcoming");
    var dueEl = document.getElementById("recurring-summary-due");
    var tbody = document.getElementById("recurring-tbody");
    var searchInput = document.getElementById("recurring-search");
    var sortSelect = document.getElementById("recurring-sort");

    var billDialog = document.getElementById("recurring-bill-dialog");
    var billDialogClose = document.getElementById("recurring-bill-dialog-close");
    var billForm = document.getElementById("recurring-bill-form");
    var billCanonical = document.getElementById("recurring-bill-canonical");
    var billDisplayName = document.getElementById("recurring-bill-display-name");
    var billAmount = document.getElementById("recurring-bill-amount");
    var billDueDay = document.getElementById("recurring-bill-dueday");
    var billNameErr = document.getElementById("recurring-bill-name-err");
    var billAmountErr = document.getElementById("recurring-bill-amount-err");
    var billDueErr = document.getElementById("recurring-bill-dueday-err");
    var billDialogTitle = document.getElementById("recurring-bill-dialog-title");
    var billPeriodLabel = document.getElementById("recurring-bill-period-label");
    var billPaidAction = document.getElementById("recurring-bill-paid-action");
    var billRemoveBtn = document.getElementById("recurring-bill-remove");

    var recurringDeleteDialog = document.getElementById("recurring-delete-dialog");
    var recurringDeleteClose = document.getElementById("recurring-delete-close");
    var recurringDeleteYes = document.getElementById("recurring-delete-yes");
    var recurringDeleteNo = document.getElementById("recurring-delete-no");
    var recurringDeleteTitle = document.getElementById("recurring-delete-title");
    var recurringDeleteLede = document.getElementById("recurring-delete-lede");
    var pendingDeleteCanonical = null;

    var viewYear = 2024;
    var viewMonth = 7;

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    var allTransactions = [];
    var budgetsData = [];
    var templateRows = [];
    var paidNameSet = new Set();
    var removedNameSet = new Set();
    var modalTemplateRef = null;

    function computePaidNames(transactions) {
      var visibleNames = new Set();
      var vis = recurringTemplatesVisible(transactions, removedNameSet);
      for (var vi = 0; vi < vis.length; vi++) {
        visibleNames.add(vis[vi].name);
      }
      var set = new Set();
      var paid = paidRecurringInMonth(transactions, viewYear, viewMonth);
      for (var i = 0; i < paid.length; i++) {
        var nm = paid[i].name;
        if (visibleNames.has(nm)) set.add(nm);
      }
      var overrides = loadPaidOverrides()[yearMonthKey(viewYear, viewMonth)];
      if (overrides) {
        for (var name in overrides) {
          if (overrides[name] && visibleNames.has(name)) set.add(name);
        }
      }
      return set;
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
          : "Show recurring bills for " + ariaBase
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
      if (!recurringMonthYear || !recurringMonthStrip) return;

      var buttons = recurringMonthStrip.querySelectorAll(".budgets-month-card");
      if (buttons.length !== MONTH_STRIP_SLOTS) return;

      recurringMonthYear.textContent = String(viewYear);

      for (var slot = 0; slot < MONTH_STRIP_SLOTS; slot++) {
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(viewYear, viewMonth, offset);
        updateMonthCard(buttons[slot], t.y, t.m, offset === 0);
      }
    }

    function sortTemplates(rows, key) {
      var arr = rows.slice();
      if (key === "latest") {
        arr.sort(function (a, b) {
          return effectiveDueDay(a) - effectiveDueDay(b);
        });
      } else if (key === "oldest") {
        arr.sort(function (a, b) {
          return effectiveDueDay(b) - effectiveDueDay(a);
        });
      } else if (key === "az") {
        arr.sort(function (a, b) {
          return effectiveDisplayName(a).localeCompare(effectiveDisplayName(b));
        });
      } else if (key === "za") {
        arr.sort(function (a, b) {
          return effectiveDisplayName(b).localeCompare(effectiveDisplayName(a));
        });
      } else if (key === "highest") {
        arr.sort(function (a, b) {
          return effectiveAmount(b) - effectiveAmount(a);
        });
      } else if (key === "lowest") {
        arr.sort(function (a, b) {
          return effectiveAmount(a) - effectiveAmount(b);
        });
      }
      return arr;
    }

    function filterBySearch(rows, q) {
      if (!q || !q.trim()) return rows.slice();
      var needle = q.trim().toLowerCase();
      return rows.filter(function (r) {
        var canon = r.name.toLowerCase();
        var disp = effectiveDisplayName(r).toLowerCase();
        return canon.indexOf(needle) !== -1 || disp.indexOf(needle) !== -1;
      });
    }

    function updateSummary(transactions) {
      var templates = recurringTemplatesVisible(transactions, removedNameSet);
      var totalSum = 0;
      for (var i = 0; i < templates.length; i++) {
        totalSum += effectiveAmount(templates[i]);
      }
      if (totalEl) totalEl.textContent = currency.format(totalSum);

      var paidCount = 0;
      var paidSum = 0;
      for (var pi = 0; pi < templates.length; pi++) {
        var tpl = templates[pi];
        if (paidNameSet.has(tpl.name)) {
          paidCount++;
          paidSum += effectiveAmount(tpl);
        }
      }
      if (paidEl)
        paidEl.textContent = formatSummaryLine(paidCount, paidSum);

      var unpaid = unpaidTemplatesForPaidSet(
        transactions,
        paidNameSet,
        removedNameSet
      );
      var upcomingSum = 0;
      for (var u = 0; u < unpaid.length; u++) {
        upcomingSum += effectiveAmount(unpaid[u]);
      }
      if (upcomingEl)
        upcomingEl.textContent = formatSummaryLine(unpaid.length, upcomingSum);

      var refDate = latestTransactionDate(transactions);
      var ds = dueSoonStats(
        transactions,
        refDate,
        viewYear,
        viewMonth,
        paidNameSet,
        removedNameSet
      );
      if (dueEl)
        dueEl.textContent = formatSummaryLine(ds.count, ds.sum);
    }

    function renderTable() {
      if (!tbody) return;
      tbody.innerHTML = "";

      var sortKey = sortSelect ? sortSelect.value : "latest";
      var q = searchInput ? searchInput.value : "";
      var rows = sortTemplates(
        filterBySearch(templateRows, q),
        sortKey
      );

      if (rows.length === 0) {
        var trEmpty = document.createElement("tr");
        var tdEmpty = document.createElement("td");
        tdEmpty.colSpan = 3;
        tdEmpty.className = "recurring-empty";
        tdEmpty.textContent =
          templateRows.length === 0
            ? "No recurring bills to display."
            : "No recurring bills match your search.";
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        return;
      }

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var tr = document.createElement("tr");

        var tdBill = document.createElement("td");
        var billWrap = document.createElement("div");
        billWrap.className = "recurring-row__bill";

        var marker = document.createElement("div");
        marker.className = "recurring-row__marker";
        marker.style.backgroundColor = categoryAccent(row.category);

        var img = document.createElement("img");
        img.className = "recurring-row__marker-img";
        img.alt = "";
        img.src = row.avatar;
        img.loading = "lazy";
        (function (imgEl, wrap, accent, nm, cat) {
          imgEl.addEventListener("error", function () {
            imgEl.remove();
            var fb = document.createElement("span");
            fb.className = "recurring-row__marker-fallback";
            fb.textContent = initials(nm);
            wrap.style.backgroundColor = accent || categoryAccent(cat);
            wrap.appendChild(fb);
          });
        })(img, marker, categoryAccent(row.category), row.name, row.category);
        marker.appendChild(img);

        var titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "recurring-row__title-btn";
        titleBtn.textContent = effectiveDisplayName(row);
        titleBtn.setAttribute(
          "aria-label",
          "Edit bill: " + effectiveDisplayName(row)
        );
        (function (tpl) {
          titleBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            openBillDialog(tpl);
          });
        })(row);

        billWrap.appendChild(marker);
        billWrap.appendChild(titleBtn);
        tdBill.appendChild(billWrap);

        var tdDue = document.createElement("td");
        var dueWrap = document.createElement("div");
        dueWrap.className = "recurring-row__due-cell";
        var dueTxt = document.createElement("p");
        dueTxt.className = "recurring-row__due-text";
        dueTxt.textContent =
          "Monthly-" + dayOrdinalFromDay(effectiveDueDay(row));

        dueWrap.appendChild(dueTxt);
        if (paidNameSet.has(row.name)) {
          var check = document.createElement("img");
          check.className = "recurring-row__paid-icon";
          check.src = "./assets/images/icon-bill-paid.svg";
          check.alt = "Paid";
          check.width = 18;
          check.height = 18;
          dueWrap.appendChild(check);
        }
        tdDue.appendChild(dueWrap);

        var tdAmt = document.createElement("td");
        var amt = document.createElement("p");
        amt.className = "recurring-row__amount";
        amt.textContent = currency.format(effectiveAmount(row));
        tdAmt.appendChild(amt);

        tr.appendChild(tdBill);
        tr.appendChild(tdDue);
        tr.appendChild(tdAmt);
        tbody.appendChild(tr);
      }
    }

    function refresh() {
      removedNameSet = loadRemovedBillNames();
      templateRows = recurringTemplatesVisible(
        allTransactions,
        removedNameSet
      );
      paidNameSet = computePaidNames(allTransactions);
      renderMonthNav();
      updateSummary(allTransactions);
      renderTable();
    }

    function hideBillFormErrors() {
      var els = [billNameErr, billAmountErr, billDueErr];
      for (var ei = 0; ei < els.length; ei++) {
        var el = els[ei];
        if (el) {
          el.hidden = true;
          el.textContent = "";
        }
      }
    }

    function syncModalPaidBtn() {
      if (!billPaidAction || !billCanonical) return;
      var nm = billCanonical.value;
      if (!nm) return;
      var paidTx = hasRecurringPaymentTx(
        allTransactions,
        nm,
        viewYear,
        viewMonth
      );
      billPaidAction.disabled = false;
      billPaidAction.classList.remove(
        "recurring-bill-dialog__paid-btn--neutral",
        "recurring-bill-dialog__paid-btn--undo"
      );
      if (paidTx) {
        billPaidAction.disabled = true;
        billPaidAction.textContent = "Recorded from transactions";
        billPaidAction.classList.add("recurring-bill-dialog__paid-btn--neutral");
        return;
      }
      var k = yearMonthKey(viewYear, viewMonth);
      var mo = loadPaidOverrides()[k];
      var manual = !!(mo && mo[nm]);
      if (manual) {
        billPaidAction.textContent = "Undo paid for this month";
        billPaidAction.classList.add("recurring-bill-dialog__paid-btn--undo");
      } else {
        billPaidAction.textContent = "Mark paid for this month";
      }
    }

    function closeBillDialog() {
      if (billDialog && typeof billDialog.close === "function") {
        billDialog.close();
      }
    }

    function closeRecurringDeleteConfirm() {
      pendingDeleteCanonical = null;
      if (
        recurringDeleteDialog &&
        typeof recurringDeleteDialog.close === "function"
      ) {
        recurringDeleteDialog.close();
      }
    }

    function openRecurringDeleteConfirm(canonical, label) {
      if (
        !recurringDeleteDialog ||
        typeof recurringDeleteDialog.showModal !== "function"
      ) {
        return;
      }
      pendingDeleteCanonical = canonical;
      if (recurringDeleteTitle) {
        recurringDeleteTitle.textContent = "Delete '" + label + "'";
      }
      if (recurringDeleteLede) {
        recurringDeleteLede.textContent =
          "Are you sure you want to delete this recurring bill? This action cannot be reversed, and all the data inside it will be removed forever.";
      }
      recurringDeleteDialog.showModal();
    }

    function confirmRecurringDelete() {
      if (pendingDeleteCanonical === null) return;
      var nm = pendingDeleteCanonical;
      closeRecurringDeleteConfirm();
      addRemovedBillName(nm);
      refresh();
    }

    function openBillDialog(template) {
      if (!billDialog || typeof billDialog.showModal !== "function") return;
      modalTemplateRef = template;
      hideBillFormErrors();
      billCanonical.value = template.name;
      if (billDisplayName) {
        billDisplayName.value = effectiveDisplayName(template);
      }
      if (billAmount) {
        billAmount.value = effectiveAmount(template).toFixed(2);
      }
      if (billDueDay) {
        billDueDay.value = String(effectiveDueDay(template));
      }
      if (billDialogTitle) {
        billDialogTitle.textContent = effectiveDisplayName(template);
      }
      if (billPeriodLabel) {
        billPeriodLabel.textContent = MONTH_SHORT[viewMonth] + " " + viewYear;
      }
      syncModalPaidBtn();
      billDialog.showModal();
      setTimeout(function () {
        if (billDisplayName) billDisplayName.focus();
      }, 0);
    }

    if (billDialog) {
      billDialog.addEventListener("close", function () {
        modalTemplateRef = null;
      });
    }

    if (billDialogClose) {
      billDialogClose.addEventListener("click", closeBillDialog);
    }

    if (billDialog) {
      billDialog.addEventListener("click", function (e) {
        if (e.target === billDialog) closeBillDialog();
      });
    }

    if (billForm) {
      billForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideBillFormErrors();
        if (!modalTemplateRef || !billCanonical || !billCanonical.value) {
          return;
        }
        var dn = billDisplayName ? billDisplayName.value.trim() : "";
        if (!dn) {
          if (billNameErr) {
            billNameErr.textContent = "Enter a bill name.";
            billNameErr.hidden = false;
          }
          return;
        }
        var amt = billAmount ? parseFloat(billAmount.value) : NaN;
        if (isNaN(amt) || amt < 0) {
          if (billAmountErr) {
            billAmountErr.textContent = "Enter a valid amount (0 or more).";
            billAmountErr.hidden = false;
          }
          return;
        }
        var dd = billDueDay ? parseInt(billDueDay.value, 10) : NaN;
        if (isNaN(dd) || dd < 1 || dd > 31) {
          if (billDueErr) {
            billDueErr.textContent = "Enter a day from 1 to 31.";
            billDueErr.hidden = false;
          }
          return;
        }
        persistBillProps(billCanonical.value, modalTemplateRef, {
          displayName: dn,
          amount: amt,
          dueDay: dd,
        });
        closeBillDialog();
        refresh();
      });
    }

    if (billPaidAction) {
      billPaidAction.addEventListener("click", function () {
        if (!billCanonical) return;
        var nm = billCanonical.value;
        if (!nm || billPaidAction.disabled) return;
        if (hasRecurringPaymentTx(allTransactions, nm, viewYear, viewMonth)) {
          return;
        }
        var k = yearMonthKey(viewYear, viewMonth);
        var mo = loadPaidOverrides()[k];
        var manual = !!(mo && mo[nm]);
        setManualPaidForMonth(viewYear, viewMonth, nm, !manual);
        closeBillDialog();
        refresh();
      });
    }

    if (billRemoveBtn) {
      billRemoveBtn.addEventListener("click", function () {
        if (!billCanonical) return;
        var nm = billCanonical.value;
        var shown =
          billDisplayName && billDisplayName.value.trim()
            ? billDisplayName.value.trim()
            : nm;
        if (!nm) return;
        closeBillDialog();
        openRecurringDeleteConfirm(nm, shown);
      });
    }

    if (recurringDeleteYes) {
      recurringDeleteYes.addEventListener("click", confirmRecurringDelete);
    }
    if (recurringDeleteNo) {
      recurringDeleteNo.addEventListener("click", closeRecurringDeleteConfirm);
    }
    if (recurringDeleteClose) {
      recurringDeleteClose.addEventListener("click", closeRecurringDeleteConfirm);
    }
    if (recurringDeleteDialog) {
      recurringDeleteDialog.addEventListener("click", function (e) {
        if (e.target === recurringDeleteDialog) closeRecurringDeleteConfirm();
      });
    }

    if (recurringMonthStrip) {
      recurringMonthStrip.addEventListener("click", function (e) {
        var btn = e.target.closest(".budgets-month-card");
        if (!recurringMonthStrip.contains(btn)) return;
        var buttons = recurringMonthStrip.querySelectorAll(".budgets-month-card");
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
        refresh();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", renderTable);
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", renderTable);
    }

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        allTransactions = data.transactions || [];
        budgetsData = data.budgets || [];
        refresh();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        var err = document.createElement("p");
        err.className = "recurring-error";
        err.setAttribute("role", "alert");
        err.textContent =
          "Could not load finance data. Serve this folder over HTTP so data.json can be fetched.";
        main.insertBefore(err, main.firstChild);
      });
  });
})();
