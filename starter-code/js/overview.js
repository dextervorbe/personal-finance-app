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

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }

  function latestTransactionDate(transactions) {
    if (!transactions || transactions.length === 0) {
      return new Date();
    }
    var latest = parseISO(transactions[0].date);
    for (var i = 1; i < transactions.length; i++) {
      var d = parseISO(transactions[i].date);
      if (d > latest) latest = d;
    }
    return latest;
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

  function incomeInMonth(transactions, year, monthIndex) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) continue;
      if (t.amount > 0) sum += t.amount;
    }
    return sum;
  }

  function expensesInMonth(transactions, year, monthIndex) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      var d = parseISO(t.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex) continue;
      if (t.amount < 0) sum += Math.abs(t.amount);
    }
    return sum;
  }

  function addUTCDays(date, days) {
    var d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
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

  var REMOVED_RECURRING_KEY = "pf-recurring-removed-bills";
  var BILL_PROPS_KEY = "pf-recurring-bill-props";

  function loadBillPropsOverview() {
    try {
      var raw = localStorage.getItem(BILL_PROPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function effectiveAmountOverview(template) {
    var p = loadBillPropsOverview()[template.name];
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

  function effectiveDueDayOverview(template) {
    var p = loadBillPropsOverview()[template.name];
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

  function loadRemovedRecurringBillNames() {
    try {
      var raw = localStorage.getItem(REMOVED_RECURRING_KEY);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function recurringTemplatesVisibleForOverview(transactions) {
    var removed = loadRemovedRecurringBillNames();
    return uniqueRecurringLatest(transactions).filter(function (v) {
      return !removed.has(v.name);
    });
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
    var visible = recurringTemplatesVisibleForOverview(transactions);
    return visible.filter(function (v) {
      return !paidNames.has(v.name);
    });
  }

  function recurringPaidSumForMonth(transactions, year, monthIndex) {
    var visibleNames = new Set();
    var vis = recurringTemplatesVisibleForOverview(transactions);
    for (var i = 0; i < vis.length; i++) {
      visibleNames.add(vis[i].name);
    }
    var paid = paidRecurringInMonth(transactions, year, monthIndex);
    var sum = 0;
    for (var i = 0; i < paid.length; i++) {
      if (visibleNames.has(paid[i].name)) {
        sum += Math.abs(paid[i].amount);
      }
    }
    return sum;
  }

  function recurringUpcomingSumForMonth(transactions, year, monthIndex) {
    var unpaid = unpaidRecurringForMonth(transactions, year, monthIndex);
    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      sum += effectiveAmountOverview(unpaid[i]);
    }
    return sum;
  }

  function recurringDueSoonSumForMonth(
    transactions,
    referenceDate,
    year,
    monthIndex
  ) {
    var unpaid = unpaidRecurringForMonth(transactions, year, monthIndex);
    var start = addUTCDays(referenceDate, 1);
    start.setUTCHours(0, 0, 0, 0);
    var end = addUTCDays(referenceDate, 5);
    end.setUTCHours(23, 59, 59, 999);

    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      var v = unpaid[i];
      var dueDay = effectiveDueDayOverview(v);
      var due = new Date(Date.UTC(year, monthIndex, dueDay));
      if (due >= start && due <= end) {
        sum += effectiveAmountOverview(v);
      }
    }
    return sum;
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

  function renderTransactions(container, transactions) {
    container.innerHTML = "";
    var sorted = transactions.slice().sort(function (a, b) {
      return parseISO(b.date) - parseISO(a.date);
    });
    var top = sorted.slice(0, 5);

    for (var i = 0; i < top.length; i++) {
      var t = top[i];
      var row = document.createElement("div");
      row.className = "tx-row";

      var avatarCell = document.createElement("div");
      avatarCell.className = "tx-row__avatar-cell";

      var img = document.createElement("img");
      img.className = "tx-row__avatar";
      img.alt = "";
      img.src = t.avatar;
      img.loading = "lazy";

      (function (imgEl, cell, displayName) {
        imgEl.addEventListener("error", function () {
          imgEl.remove();
          var fb = document.createElement("span");
          fb.className = "tx-row__avatar-fallback";
          fb.textContent = initials(displayName);
          cell.appendChild(fb);
        });
      })(img, avatarCell, t.name);

      avatarCell.appendChild(img);

      var name = document.createElement("p");
      name.className = "tx-row__name";
      name.textContent = t.name;

      var amountEl = document.createElement("p");
      var isCredit = t.amount >= 0;
      amountEl.className =
        "tx-row__amount " +
        (isCredit ? "tx-row__amount--credit" : "tx-row__amount--debit");
      amountEl.textContent =
        (isCredit ? "+" : "-") + currency.format(Math.abs(t.amount));

      var dateEl = document.createElement("p");
      dateEl.className = "tx-row__date";
      dateEl.textContent = dateFmt.format(parseISO(t.date));

      var meta = document.createElement("div");
      meta.className = "tx-row__meta";
      meta.appendChild(amountEl);
      meta.appendChild(dateEl);

      row.appendChild(avatarCell);
      row.appendChild(name);
      row.appendChild(meta);

      container.appendChild(row);
    }
  }

  function renderPotsMiniGrid(container, pots) {
    container.innerHTML = "";
    for (var i = 0; i < pots.length; i++) {
      var p = pots[i];
      var mini = document.createElement("div");
      mini.className = "pots-mini";

      var accent = document.createElement("span");
      accent.className = "pots-mini__accent";
      accent.style.backgroundColor = p.theme;
      accent.setAttribute("aria-hidden", "true");

      var meta = document.createElement("div");
      meta.className = "pots-mini__meta";

      var label = document.createElement("span");
      label.className = "pots-mini__name";
      label.textContent = p.name;

      var amt = document.createElement("span");
      amt.className = "pots-mini__amount";
      amt.textContent = currency.format(p.total);

      meta.appendChild(label);
      meta.appendChild(amt);

      mini.appendChild(accent);
      mini.appendChild(meta);

      container.appendChild(mini);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".overview");
    if (!main) return;

    var overviewMonthYear = document.getElementById("overview-month-year");
    var overviewMonthStrip = document.getElementById("overview-month-strip");

    var viewYear = 2024;
    var viewMonth = 7;

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    var overviewData = null;

    function sumBudgetMaximums(budgets) {
      var s = 0;
      for (var i = 0; i < budgets.length; i++) {
        s += budgets[i].maximum;
      }
      return s;
    }

    function updateMonthCard(btn, y, m, isActive, transactions, budgets) {
      if (!btn) return;
      var cap = sumBudgetMaximums(budgets);
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
          : "Show overview for " + ariaBase
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
      if (!overviewMonthYear || !overviewMonthStrip) return;

      var buttons = overviewMonthStrip.querySelectorAll(".budgets-month-card");
      if (buttons.length !== MONTH_STRIP_SLOTS) return;

      var transactions = overviewData ? overviewData.transactions || [] : [];
      var budgets = overviewData ? overviewData.budgets || [] : [];

      overviewMonthYear.textContent = String(viewYear);

      for (var slot = 0; slot < MONTH_STRIP_SLOTS; slot++) {
        var offset = slot - MONTH_STRIP_CENTER;
        var t = addCalendarMonths(viewYear, viewMonth, offset);
        updateMonthCard(
          buttons[slot],
          t.y,
          t.m,
          offset === 0,
          transactions,
          budgets
        );
      }
    }

    function renderOverviewContent() {
      if (!overviewData) return;

      var balance = overviewData.balance;
      document.getElementById("overview-balance").textContent =
        currency.format(balance.current);

      var transactions = overviewData.transactions || [];
      document.getElementById("overview-income").textContent = currency.format(
        incomeInMonth(transactions, viewYear, viewMonth)
      );
      document.getElementById("overview-expenses").textContent =
        currency.format(expensesInMonth(transactions, viewYear, viewMonth));

      var pots = overviewData.pots || [];
      var potsSaved = 0;
      for (var pi = 0; pi < pots.length; pi++) {
        potsSaved += pots[pi].total;
      }
      document.getElementById("pots-total-saved").textContent =
        currency.format(potsSaved);

      renderPotsMiniGrid(document.getElementById("pots-mini-grid"), pots);

      var inMonth = [];
      for (var ti = 0; ti < transactions.length; ti++) {
        var tx = transactions[ti];
        var d = parseISO(tx.date);
        if (
          d.getUTCFullYear() === viewYear &&
          d.getUTCMonth() === viewMonth
        ) {
          inMonth.push(tx);
        }
      }
      renderTransactions(
        document.getElementById("overview-transactions"),
        inMonth
      );

      var budgets = overviewData.budgets || [];
      var spents = [];
      var themes = [];
      var budgetLimit = 0;
      for (var bi = 0; bi < budgets.length; bi++) {
        var b = budgets[bi];
        themes.push(b.theme);
        spents.push(spentInMonth(transactions, b.category, viewYear, viewMonth));
        budgetLimit += b.maximum;
      }
      var totalSpentBudget = 0;
      for (var si = 0; si < spents.length; si++) {
        totalSpentBudget += spents[si];
      }

      var donut = document.getElementById("budgets-donut");
      donut.style.background = buildConicGradient(spents, themes);

      document.getElementById("budgets-center-spent").textContent =
        currency.format(totalSpentBudget);
      document.getElementById("budgets-center-limit").textContent =
        "of " + currency.format(budgetLimit) + " limit";

      var periodLabel = monthAriaFmt.format(
        new Date(Date.UTC(viewYear, viewMonth, 1))
      );
      var summaryEl = document.getElementById("budgets-chart-summary");
      summaryEl.textContent =
        "Budget spending for " +
        periodLabel +
        ": " +
        currency.format(totalSpentBudget) +
        " spent of " +
        currency.format(budgetLimit) +
        " total budget limit across " +
        budgets.length +
        " categories.";

      var legend = document.getElementById("budgets-legend");
      legend.innerHTML = "";
      for (var li = 0; li < budgets.length; li++) {
        var row = document.createElement("div");
        row.className = "budgets-legend__row";

        var sw = document.createElement("span");
        sw.className = "budgets-legend__swatch";
        sw.style.backgroundColor = budgets[li].theme;
        sw.setAttribute("aria-hidden", "true");

        var lbl = document.createElement("span");
        lbl.className = "budgets-legend__label";
        lbl.textContent = budgets[li].category;

        var val = document.createElement("span");
        val.className = "budgets-legend__value";
        val.textContent = currency.format(spents[li]);

        row.appendChild(sw);
        row.appendChild(lbl);
        row.appendChild(val);
        legend.appendChild(row);
      }

      var refDate = latestTransactionDate(transactions);
      document.getElementById("recurring-paid").textContent = currency.format(
        recurringPaidSumForMonth(transactions, viewYear, viewMonth)
      );
      document.getElementById("recurring-upcoming").textContent =
        currency.format(
          recurringUpcomingSumForMonth(transactions, viewYear, viewMonth)
        );
      document.getElementById("recurring-due").textContent = currency.format(
        recurringDueSoonSumForMonth(
          transactions,
          refDate,
          viewYear,
          viewMonth
        )
      );
    }

    function renderAll() {
      renderMonthNav();
      renderOverviewContent();
    }

    if (overviewMonthStrip) {
      overviewMonthStrip.addEventListener("click", function (e) {
        var btn = e.target.closest(".budgets-month-card");
        if (!btn || !overviewMonthStrip.contains(btn)) return;
        var buttons = overviewMonthStrip.querySelectorAll(".budgets-month-card");
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

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        overviewData = data;
        renderAll();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        var banner = document.createElement("p");
        banner.setAttribute("role", "alert");
        banner.className = "overview-error";
        banner.textContent =
          "Could not load finance data. Serve this folder over HTTP (for example, a local dev server) so data.json can be fetched.";
        main.insertBefore(banner, main.firstChild);
      });
  });
})();
