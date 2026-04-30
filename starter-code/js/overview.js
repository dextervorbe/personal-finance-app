(function () {
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

  function isAugust2024(d) {
    return d.getUTCFullYear() === 2024 && d.getUTCMonth() === 7;
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }

  function latestTransactionDate(transactions) {
    var latest = parseISO(transactions[0].date);
    for (var i = 1; i < transactions.length; i++) {
      var d = parseISO(transactions[i].date);
      if (d > latest) latest = d;
    }
    return latest;
  }

  function spentInAugust(transactions, category) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (!isAugust2024(parseISO(t.date))) continue;
      if (t.category !== category) continue;
      if (t.amount >= 0) continue;
      sum += Math.abs(t.amount);
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

  function paidRecurringAugust(transactions) {
    var out = [];
    for (var i = 0; i < transactions.length; i++) {
      var t = transactions[i];
      if (!t.recurring) continue;
      if (!isAugust2024(parseISO(t.date))) continue;
      out.push(t);
    }
    return out;
  }

  function unpaidRecurringForAugust(transactions) {
    var paidNames = new Set();
    var paid = paidRecurringAugust(transactions);
    for (var i = 0; i < paid.length; i++) {
      paidNames.add(paid[i].name);
    }
    return uniqueRecurringLatest(transactions).filter(function (v) {
      return !paidNames.has(v.name);
    });
  }

  function recurringPaidSum(transactions) {
    var paid = paidRecurringAugust(transactions);
    var sum = 0;
    for (var i = 0; i < paid.length; i++) {
      sum += Math.abs(paid[i].amount);
    }
    return sum;
  }

  function recurringUpcomingSum(transactions) {
    var unpaid = unpaidRecurringForAugust(transactions);
    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      sum += Math.abs(unpaid[i].amount);
    }
    return sum;
  }

  function recurringDueSoonSum(transactions, referenceDate) {
    var unpaid = unpaidRecurringForAugust(transactions);
    var start = addUTCDays(referenceDate, 1);
    start.setUTCHours(0, 0, 0, 0);
    var end = addUTCDays(referenceDate, 5);
    end.setUTCHours(23, 59, 59, 999);

    var sum = 0;
    for (var i = 0; i < unpaid.length; i++) {
      var v = unpaid[i];
      var dueDay = parseISO(v.date).getUTCDate();
      var due = new Date(Date.UTC(2024, 7, dueDay));
      if (due >= start && due <= end) {
        sum += Math.abs(v.amount);
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
    for (var i = 0; i < spents.length; i++) total += spents[i];
    if (total <= 0) {
      var empty = cssVar("--color-donut-empty", "#e0dedc");
      return "conic-gradient(from -90deg, " + empty + " 0deg 360deg)";
    }
    var angle = 0;
    var parts = [];
    for (var j = 0; j < spents.length; j++) {
      var frac = spents[j] / total;
      var deg = frac * 360;
      var start = angle;
      angle += deg;
      parts.push(themes[j] + " " + start + "deg " + angle + "deg");
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

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        var balance = data.balance;
        document.getElementById("overview-balance").textContent =
          currency.format(balance.current);
        document.getElementById("overview-income").textContent =
          currency.format(balance.income);
        document.getElementById("overview-expenses").textContent =
          currency.format(balance.expenses);

        var pots = data.pots || [];
        var potsSaved = 0;
        for (var pi = 0; pi < pots.length; pi++) {
          potsSaved += pots[pi].total;
        }
        document.getElementById("pots-total-saved").textContent =
          currency.format(potsSaved);

        renderPotsMiniGrid(
          document.getElementById("pots-mini-grid"),
          pots,
        );

        var transactions = data.transactions || [];
        renderTransactions(
          document.getElementById("overview-transactions"),
          transactions,
        );

        var budgets = data.budgets || [];
        var spents = [];
        var themes = [];
        var budgetLimit = 0;
        for (var bi = 0; bi < budgets.length; bi++) {
          var b = budgets[bi];
          themes.push(b.theme);
          spents.push(spentInAugust(transactions, b.category));
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

        var summaryEl = document.getElementById("budgets-chart-summary");
        summaryEl.textContent =
          "Budget spending for August 2024: " +
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
        document.getElementById("recurring-paid").textContent =
          currency.format(recurringPaidSum(transactions));
        document.getElementById("recurring-upcoming").textContent =
          currency.format(recurringUpcomingSum(transactions));
        document.getElementById("recurring-due").textContent =
          currency.format(recurringDueSoonSum(transactions, refDate));

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
