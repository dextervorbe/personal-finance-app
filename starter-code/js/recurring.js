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

  function unpaidRecurringForMonth(transactions, year, monthIndex) {
    var paidNames = new Set();
    var paid = paidRecurringInMonth(transactions, year, monthIndex);
    for (var i = 0; i < paid.length; i++) {
      paidNames.add(paid[i].name);
    }
    return uniqueRecurringLatest(transactions).filter(function (v) {
      return !paidNames.has(v.name);
    });
  }

  function addUTCDays(date, days) {
    var d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  function dueSoonStats(transactions, referenceDate, year, monthIndex) {
    var unpaid = unpaidRecurringForMonth(transactions, year, monthIndex);
    var start = addUTCDays(referenceDate, 1);
    start.setUTCHours(0, 0, 0, 0);
    var end = addUTCDays(referenceDate, 5);
    end.setUTCHours(23, 59, 59, 999);

    var count = 0;
    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      var v = unpaid[i];
      var dueDay = parseISO(v.date).getUTCDate();
      var due = new Date(Date.UTC(year, monthIndex, dueDay));
      if (due >= start && due <= end) {
        count += 1;
        sum += Math.abs(v.amount);
      }
    }
    return { count: count, sum: sum };
  }

  function categoryAccent(cat) {
    return CATEGORY_ACCENT[cat] || "#277C78";
  }

  function dayOrdinalUTC(iso) {
    var day = parseISO(iso).getUTCDate();
    var j = day % 10;
    var k = day % 100;
    if (j === 1 && k !== 11) return day + "st";
    if (j === 2 && k !== 12) return day + "nd";
    if (j === 3 && k !== 13) return day + "rd";
    return day + "th";
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

    function computePaidNames(transactions) {
      var set = new Set();
      var paid = paidRecurringInMonth(transactions, viewYear, viewMonth);
      for (var i = 0; i < paid.length; i++) {
        set.add(paid[i].name);
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
          return (
            parseISO(a.date).getUTCDate() - parseISO(b.date).getUTCDate()
          );
        });
      } else if (key === "oldest") {
        arr.sort(function (a, b) {
          return (
            parseISO(b.date).getUTCDate() - parseISO(a.date).getUTCDate()
          );
        });
      } else if (key === "az") {
        arr.sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
      } else if (key === "za") {
        arr.sort(function (a, b) {
          return b.name.localeCompare(a.name);
        });
      } else if (key === "highest") {
        arr.sort(function (a, b) {
          return Math.abs(b.amount) - Math.abs(a.amount);
        });
      } else if (key === "lowest") {
        arr.sort(function (a, b) {
          return Math.abs(a.amount) - Math.abs(b.amount);
        });
      }
      return arr;
    }

    function filterBySearch(rows, q) {
      if (!q || !q.trim()) return rows.slice();
      var needle = q.trim().toLowerCase();
      return rows.filter(function (r) {
        return r.name.toLowerCase().indexOf(needle) !== -1;
      });
    }

    function updateSummary(transactions) {
      var templates = uniqueRecurringLatest(transactions);
      var totalSum = 0;
      for (var i = 0; i < templates.length; i++) {
        totalSum += Math.abs(templates[i].amount);
      }
      if (totalEl) totalEl.textContent = currency.format(totalSum);

      var paidTx = paidRecurringInMonth(transactions, viewYear, viewMonth);
      var paidSum = 0;
      for (var p = 0; p < paidTx.length; p++) {
        paidSum += Math.abs(paidTx[p].amount);
      }
      if (paidEl)
        paidEl.textContent = formatSummaryLine(paidTx.length, paidSum);

      var unpaid = unpaidRecurringForMonth(transactions, viewYear, viewMonth);
      var upcomingSum = 0;
      for (var u = 0; u < unpaid.length; u++) {
        upcomingSum += Math.abs(unpaid[u].amount);
      }
      if (upcomingEl)
        upcomingEl.textContent = formatSummaryLine(unpaid.length, upcomingSum);

      var refDate = latestTransactionDate(transactions);
      var ds = dueSoonStats(transactions, refDate, viewYear, viewMonth);
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
        tdEmpty.textContent = "No recurring bills match your search.";
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

        var title = document.createElement("p");
        title.className = "recurring-row__title";
        title.textContent = row.name;

        billWrap.appendChild(marker);
        billWrap.appendChild(title);
        tdBill.appendChild(billWrap);

        var tdDue = document.createElement("td");
        var dueWrap = document.createElement("div");
        dueWrap.className = "recurring-row__due-cell";
        var dueTxt = document.createElement("p");
        dueTxt.className = "recurring-row__due-text";
        dueTxt.textContent =
          "Monthly-" + dayOrdinalUTC(row.date);

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
        amt.textContent = currency.format(Math.abs(row.amount));
        tdAmt.appendChild(amt);

        tr.appendChild(tdBill);
        tr.appendChild(tdDue);
        tr.appendChild(tdAmt);
        tbody.appendChild(tr);
      }
    }

    function refresh() {
      paidNameSet = computePaidNames(allTransactions);
      renderMonthNav();
      updateSummary(allTransactions);
      renderTable();
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
        templateRows = uniqueRecurringLatest(allTransactions);
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
