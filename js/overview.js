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
  var CUSTOM_BILLS_KEY = "pf-recurring-custom-bills";
  var PAID_OVERRIDES_KEY = "pf-recurring-paid-overrides";

  /** Same keys as transactions.js — overview reflects saved edits. */
  var TX_DELETED_KEY = "pf-tx-deleted-ids";
  var TX_OVERRIDES_KEY = "pf-tx-overrides";
  var TX_ADDED_KEY = "pf-tx-user-added";
  var PF_POTS_STORAGE_KEY = "pf-pots-app-state-v1";

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

  function mergePotsFromStorage(jsonPots) {
    try {
      var raw = localStorage.getItem(PF_POTS_STORAGE_KEY);
      if (!raw) return jsonPots || [];
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.pots)) return jsonPots || [];
      return o.pots.map(function (p) {
        return {
          name: p.name,
          target: Number(p.target),
          total: Number(p.total),
          theme: p.theme || "#277C78",
        };
      });
    } catch (e) {
      return jsonPots || [];
    }
  }

  var PF_BUDGETS_STORAGE_KEY = "pf-budgets-app-state-v1";

  function normalizeBudgetRowFromStorage(b) {
    return {
      category: String(b && b.category !== undefined ? b.category : "General"),
      maximum: Number.isFinite(Number(b && b.maximum)) ? Number(b.maximum) : 0,
      theme: typeof (b && b.theme) === "string" ? b.theme : "#277C78",
    };
  }

  function mergeBudgetsFromStorage(jsonBudgets) {
    try {
      var raw = localStorage.getItem(PF_BUDGETS_STORAGE_KEY);
      if (!raw) {
        return (jsonBudgets || []).map(normalizeBudgetRowFromStorage);
      }
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.budgets)) {
        return (jsonBudgets || []).map(normalizeBudgetRowFromStorage);
      }
      return o.budgets.map(normalizeBudgetRowFromStorage);
    } catch (e) {
      return (jsonBudgets || []).map(normalizeBudgetRowFromStorage);
    }
  }

  function loadCustomBillsOverview() {
    try {
      var raw = localStorage.getItem(CUSTOM_BILLS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function customBillToTemplateOverview(c) {
    var day = Math.max(1, Math.min(31, Number(c.dueDay)));
    var d = new Date(Date.UTC(2026, 7, day));
    return {
      name: "__pf_custom_" + c.id,
      amount: -Math.abs(Number(c.amount)),
      date: d.toISOString().slice(0, 10),
      recurring: true,
      category: "Bills",
      avatar: "./assets/images/icon-recurring-bills.svg",
    };
  }

  function loadPaidOverridesOverview() {
    try {
      var raw = localStorage.getItem(PAID_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function yearMonthKeyOverview(y, m0) {
    return y + "-" + String(m0 + 1).padStart(2, "0");
  }

  function loadBillPropsOverview() {
    try {
      var raw = localStorage.getItem(BILL_PROPS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function effectiveAmountOverview(template) {
    if (template.name.indexOf("__pf_custom_") === 0) {
      var cid = template.name.slice("__pf_custom_".length);
      var list = loadCustomBillsOverview();
      for (var ci = 0; ci < list.length; ci++) {
        if (list[ci].id === cid) return Math.abs(Number(list[ci].amount));
      }
    }
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
    if (template.name.indexOf("__pf_custom_") === 0) {
      var cid2 = template.name.slice("__pf_custom_".length);
      var list2 = loadCustomBillsOverview();
      for (var cj = 0; cj < list2.length; cj++) {
        if (list2[cj].id === cid2) {
          var dd = list2[cj].dueDay;
          if (typeof dd === "number" && dd >= 1 && dd <= 31) return dd;
        }
      }
    }
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
    var fromTx = uniqueRecurringLatest(transactions).filter(function (v) {
      return !removed.has(v.name);
    });
    var customs = loadCustomBillsOverview().map(customBillToTemplateOverview);
    return fromTx.concat(customs);
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
    var visibleNames = new Set();
    for (var vi = 0; vi < visible.length; vi++) {
      visibleNames.add(visible[vi].name);
    }
    var mo = loadPaidOverridesOverview()[yearMonthKeyOverview(year, monthIndex)];
    if (mo) {
      for (var nm in mo) {
        if (mo[nm] && visibleNames.has(nm)) paidNames.add(nm);
      }
    }
    return visible.filter(function (v) {
      return !paidNames.has(v.name);
    });
  }

  function recurringPaidSumForMonth(transactions, year, monthIndex) {
    var visible = recurringTemplatesVisibleForOverview(transactions);
    var visibleNames = new Set();
    for (var i = 0; i < visible.length; i++) {
      visibleNames.add(visible[i].name);
    }

    var paid = paidRecurringInMonth(transactions, year, monthIndex);
    var namesPaidByTx = new Set();
    var sum = 0;
    for (var j = 0; j < paid.length; j++) {
      var pt = paid[j];
      if (!visibleNames.has(pt.name)) continue;
      namesPaidByTx.add(pt.name);
      sum += Math.abs(pt.amount);
    }

    var mo = loadPaidOverridesOverview()[yearMonthKeyOverview(year, monthIndex)];
    if (mo) {
      for (var nm in mo) {
        if (!mo[nm] || !visibleNames.has(nm)) continue;
        if (namesPaidByTx.has(nm)) continue;
        for (var v = 0; v < visible.length; v++) {
          if (visible[v].name === nm) {
            sum += effectiveAmountOverview(visible[v]);
            break;
          }
        }
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

  /* —— Credit cards overview (same storage keys as credit-cards.js) —— */
  var CC_TX_DELETED_KEY = "pf-cc-tx-deleted-ids";
  var CC_TX_OVERRIDES_KEY = "pf-cc-tx-overrides";
  var CC_TX_ADDED_KEY = "pf-cc-tx-user-added";
  var PF_CC_ACCOUNT_KEY = "pf-cc-account";
  var PF_CC_CARDS_KEY = "pf-cc-cards";
  var PF_CC_ACTIVE_CARD_KEY = "pf-cc-active-card";
  var PF_CC_SEED_CLEARED_KEY = "pf-cc-seed-cleared";
  var CC_DEFAULT_CARD_ID = "cc-card-default";

  function ccLoadDeletedIds() {
    try {
      var raw = localStorage.getItem(CC_TX_DELETED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function ccLoadOverrides() {
    try {
      var raw = localStorage.getItem(CC_TX_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function ccLoadAddedTransactions() {
    try {
      var raw = localStorage.getItem(CC_TX_ADDED_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function ccSeedCleared() {
    try {
      return localStorage.getItem(PF_CC_SEED_CLEARED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function ccTxEffectiveCardId(t) {
    return t.cardId || CC_DEFAULT_CARD_ID;
  }

  function ccTxsForCard(rows, cardId) {
    if (!cardId) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (ccTxEffectiveCardId(rows[i]) === cardId) out.push(rows[i]);
    }
    return out;
  }

  function ccSumAmounts(rows) {
    var s = 0;
    for (var i = 0; i < rows.length; i++) {
      s += rows[i].amount;
    }
    return s;
  }

  function ccBalance(card, allRows) {
    if (!card) return null;
    return card.borrowedAmount + ccSumAmounts(ccTxsForCard(allRows, card.id));
  }

  function ccApplyOverrides(tx, ov) {
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
      cardId: tx.cardId,
    };
  }

  function ccRebuildAllTransactions(jsonTransactions, seedCardId) {
    var sid = seedCardId || CC_DEFAULT_CARD_ID;
    var deleted = ccLoadDeletedIds();
    var overrides = ccLoadOverrides();
    var added = ccLoadAddedTransactions();

    var jsonPart = (jsonTransactions || [])
      .map(function (t, i) {
        var id = "cc-b-" + i;
        if (deleted.has(id)) return null;
        var tx = {
          avatar: t.avatar,
          name: t.name,
          category: t.category,
          date: t.date,
          amount: t.amount,
          recurring: !!t.recurring,
          cardId: sid,
          __txId: id,
        };
        return ccApplyOverrides(tx, overrides[id]);
      })
      .filter(Boolean);

    var addedPart = added.map(function (t) {
      var base = ccApplyOverrides(t, overrides[t.__txId]);
      if (!base.cardId) base.cardId = sid;
      return base;
    });

    return addedPart.concat(jsonPart);
  }

  function ccLoadCardsState() {
    try {
      var raw = localStorage.getItem(PF_CC_CARDS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          var cardsOut = [];
          for (var i = 0; i < arr.length; i++) {
            var c = arr[i];
            if (
              c &&
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              Number.isFinite(Number(c.borrowedAmount))
            ) {
              cardsOut.push({
                id: c.id,
                name: c.name.trim() || "Card",
                borrowedAmount: Number(c.borrowedAmount),
              });
            }
          }
          if (cardsOut.length > 0) {
            var active = localStorage.getItem(PF_CC_ACTIVE_CARD_KEY);
            if (
              !active ||
              !cardsOut.some(function (x) {
                return x.id === active;
              })
            ) {
              active = cardsOut[0].id;
            }
            return { cards: cardsOut, activeCardId: active };
          }
        }
      }
      var legacy = localStorage.getItem(PF_CC_ACCOUNT_KEY);
      if (legacy) {
        try {
          var o = JSON.parse(legacy);
          if (
            o &&
            typeof o.name === "string" &&
            Number.isFinite(Number(o.borrowedAmount))
          ) {
            return {
              cards: [
                {
                  id: CC_DEFAULT_CARD_ID,
                  name: o.name.trim() || "Card",
                  borrowedAmount: Number(o.borrowedAmount),
                },
              ],
              activeCardId: CC_DEFAULT_CARD_ID,
            };
          }
        } catch (e) {}
      }
    } catch (e2) {}
    if (ccSeedCleared()) {
      return { cards: [], activeCardId: null };
    }
    return {
      cards: [
        {
          id: CC_DEFAULT_CARD_ID,
          name: "Capital One",
          borrowedAmount: 1000,
        },
      ],
      activeCardId: CC_DEFAULT_CARD_ID,
    };
  }

  function renderCreditCardsOverview(container, cards, allCcTransactions) {
    if (!container) return;
    container.innerHTML = "";
    if (!cards || cards.length === 0) {
      var empty = document.createElement("p");
      empty.className = "overview-cc-empty";
      empty.textContent =
        "No credit cards on file. Add one from Credit Cards.";
      container.appendChild(empty);
      return;
    }

    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      var accentIdx = ci % 5;
      var row = document.createElement("div");
      row.className =
        "overview-cc-row overview-cc-row--accent-" + accentIdx;

      var body = document.createElement("div");
      body.className = "overview-cc-row__body";

      var lbl = document.createElement("p");
      lbl.className = "overview-cc-row__label";
      lbl.textContent = card.name;

      var bal = ccBalance(card, allCcTransactions);
      var val = document.createElement("p");
      val.className = "overview-cc-row__value";
      val.textContent =
        bal !== null ? currency.format(bal) : "—";

      body.appendChild(lbl);
      body.appendChild(val);
      row.appendChild(body);
      container.appendChild(row);
    }
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

      var avatarUrl = t.avatar && String(t.avatar).trim();
      if (!avatarUrl) {
        var fb0 = document.createElement("span");
        fb0.className = "tx-row__avatar-fallback";
        if (typeof financeStyleCategoryFallback === "function") {
          financeStyleCategoryFallback(fb0, t.category);
        }
        fb0.textContent = initials(t.name);
        avatarCell.appendChild(fb0);
      } else {
        var img = document.createElement("img");
        img.className = "tx-row__avatar";
        img.alt = "";
        img.src = avatarUrl;
        img.loading = "lazy";

        (function (imgEl, cell, displayName, category) {
          imgEl.addEventListener("error", function () {
            imgEl.remove();
            var fb = document.createElement("span");
            fb.className = "tx-row__avatar-fallback";
            if (typeof financeStyleCategoryFallback === "function") {
              financeStyleCategoryFallback(fb, category);
            }
            fb.textContent = initials(displayName);
            cell.appendChild(fb);
          });
        })(img, avatarCell, t.name, t.category);

        avatarCell.appendChild(img);
      }

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
    var overviewYearPanel = document.getElementById("overview-month-year-panel");
    var overviewMonthStrip = document.getElementById("overview-month-strip");

    var viewYear = new Date().getFullYear();
    var viewMonth = new Date().getMonth();

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    var overviewData = null;
    var mergedMainTransactions = [];

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

      var transactions = overviewData ? mergedMainTransactions : [];
      var budgets = overviewData
        ? mergeBudgetsFromStorage(overviewData.budgets || [])
        : [];

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

      var transactions = mergedMainTransactions;
      var ledgerBalance = ledgerBalanceFromTransactions(
        transactions,
        overviewData.openingBalance
      );
      document.getElementById("overview-balance").textContent =
        currency.format(ledgerBalance);

      document.getElementById("overview-income").textContent = currency.format(
        incomeInMonth(transactions, viewYear, viewMonth)
      );
      document.getElementById("overview-expenses").textContent =
        currency.format(expensesInMonth(transactions, viewYear, viewMonth));

      var periodHuman = monthAriaFmt.format(
        new Date(Date.UTC(viewYear, viewMonth, 1))
      );
      var scopeLine = "For " + periodHuman;
      var incomeScopeEl = document.getElementById("overview-income-scope");
      var expensesScopeEl = document.getElementById("overview-expenses-scope");
      if (incomeScopeEl) incomeScopeEl.textContent = scopeLine;
      if (expensesScopeEl) expensesScopeEl.textContent = scopeLine;

      var pots = mergePotsFromStorage(overviewData.pots || []);
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

      var budgets = mergeBudgetsFromStorage(overviewData.budgets || []);
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

      var ccState = ccLoadCardsState();
      var ccCards = ccState.cards;
      var ccSeedId =
        ccCards.length > 0 ? ccCards[0].id : CC_DEFAULT_CARD_ID;
      var ccJsonSource = ccSeedCleared()
        ? []
        : overviewData.creditCardTransactions || [];
      var ccAllTx = ccRebuildAllTransactions(ccJsonSource, ccSeedId);
      renderCreditCardsOverview(
        document.getElementById("overview-credit-cards"),
        ccCards,
        ccAllTx
      );
    }

    function renderAll() {
      if (overviewData) {
        mergedMainTransactions = rebuildMainTransactionsFromStorage(
          overviewData.transactions || []
        );
      } else {
        mergedMainTransactions = [];
      }
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

    if (typeof initBudgetYearPicker === "function") {
      initBudgetYearPicker({
        button: overviewMonthYear,
        panel: overviewYearPanel,
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
