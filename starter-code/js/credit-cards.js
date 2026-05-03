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

  var TX_DELETED_KEY = "pf-cc-tx-deleted-ids";
  var TX_OVERRIDES_KEY = "pf-cc-tx-overrides";
  var TX_ADDED_KEY = "pf-cc-tx-user-added";

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

  var PF_CC_ACCOUNT_KEY = "pf-cc-account";
  var PF_CC_CARDS_KEY = "pf-cc-cards";
  var PF_CC_ACTIVE_CARD_KEY = "pf-cc-active-card";
  var PF_CC_SEED_CLEARED_KEY = "pf-cc-seed-cleared";
  var DEFAULT_CARD_ID = "cc-card-default";

  function isSeedCleared() {
    try {
      return localStorage.getItem(PF_CC_SEED_CLEARED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setSeedCleared(on) {
    try {
      if (on) localStorage.setItem(PF_CC_SEED_CLEARED_KEY, "1");
      else localStorage.removeItem(PF_CC_SEED_CLEARED_KEY);
    } catch (e) {
      /* quota / private mode */
    }
  }

  function txEffectiveCardId(t) {
    return t.cardId || DEFAULT_CARD_ID;
  }

  function loadCardsState() {
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
                  id: DEFAULT_CARD_ID,
                  name: o.name.trim() || "Card",
                  borrowedAmount: Number(o.borrowedAmount),
                },
              ],
              activeCardId: DEFAULT_CARD_ID,
            };
          }
        } catch (e) {}
      }
    } catch (e2) {}
    if (isSeedCleared()) {
      return { cards: [], activeCardId: null };
    }
    return {
      cards: [
        {
          id: DEFAULT_CARD_ID,
          name: "Capital One",
          borrowedAmount: 1000,
        },
      ],
      activeCardId: DEFAULT_CARD_ID,
    };
  }

  function saveCards(cardsArr) {
    try {
      localStorage.setItem(PF_CC_CARDS_KEY, JSON.stringify(cardsArr));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function saveActiveCardId(id) {
    try {
      if (id) localStorage.setItem(PF_CC_ACTIVE_CARD_KEY, id);
      else localStorage.removeItem(PF_CC_ACTIVE_CARD_KEY);
    } catch (e) {
      /* quota / private mode */
    }
  }

  function newCardId() {
    return (
      "cc-card-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 10)
    );
  }

  function sumAllTxAmounts(rows) {
    var s = 0;
    for (var i = 0; i < rows.length; i++) {
      s += rows[i].amount;
    }
    return s;
  }

  function txsForCard(rows, cardId) {
    if (!cardId) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (txEffectiveCardId(rows[i]) === cardId) out.push(rows[i]);
    }
    return out;
  }

  function filterRowsByCardId(rows, cardId) {
    if (!cardId) return [];
    return rows.filter(function (t) {
      return txEffectiveCardId(t) === cardId;
    });
  }

  function computeRunningBalance(card, rows) {
    if (!card) return null;
    return card.borrowedAmount + sumAllTxAmounts(txsForCard(rows, card.id));
  }

  function newUserTxId() {
    return (
      "cc-u-" +
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
      recurring:
        ov.recurring !== undefined ? !!ov.recurring : !!tx.recurring,
      __txId: tx.__txId,
      cardId: tx.cardId,
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

  function rebuildTransactionsFromStorage(jsonTransactions, seedCardId) {
    var sid = seedCardId || DEFAULT_CARD_ID;
    var deleted = loadDeletedIds();
    var overrides = loadOverrides();
    var added = loadAddedTransactions();

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
        return applyTxOverrides(tx, overrides[id]);
      })
      .filter(Boolean);

    var addedPart = added.map(function (t) {
      var base = applyTxOverrides(t, overrides[t.__txId]);
      if (!base.cardId) base.cardId = sid;
      return base;
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

    var avatarUrl = t.avatar && String(t.avatar).trim();
    if (!avatarUrl) {
      var fbEmpty = document.createElement("span");
      fbEmpty.className = "tx-avatar-fallback";
      if (typeof financeStyleCategoryFallback === "function") {
        financeStyleCategoryFallback(fbEmpty, t.category);
      }
      fbEmpty.textContent = initials(t.name);
      slot.appendChild(fbEmpty);
    } else {
      var img = document.createElement("img");
      img.className = "tx-avatar";
      img.alt = "";
      img.src = avatarUrl;
      img.loading = "lazy";
      img.addEventListener("error", function () {
        img.remove();
        var fb = document.createElement("span");
        fb.className = "tx-avatar-fallback";
        if (typeof financeStyleCategoryFallback === "function") {
          financeStyleCategoryFallback(fb, t.category);
        }
        fb.textContent = initials(t.name);
        slot.appendChild(fb);
      });
      slot.appendChild(img);
    }

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

    var tbody = document.getElementById("cc-tbody");
    var emptyEl = document.getElementById("cc-empty");
    var searchEl = document.getElementById("cc-search");
    var sortEl = document.getElementById("cc-sort");
    var catEl = document.getElementById("cc-category");
    var prevBtn = document.getElementById("cc-prev");
    var nextBtn = document.getElementById("cc-next");
    var pagesEl = document.getElementById("cc-pages");
    var pagNav = document.getElementById("cc-pagination");

    var addOpenBtn = document.getElementById("cc-add-open");
    var addDialog = document.getElementById("cc-add-dialog");
    var addForm = document.getElementById("cc-add-form");
    var modalCloseBtn = document.getElementById("cc-modal-close");
    var addName = document.getElementById("cc-add-name");
    var addNameCount = document.getElementById("cc-add-name-count");
    var addNameErr = document.getElementById("cc-add-name-err");
    var addDate = document.getElementById("cc-add-date");
    var addDateDisplay = document.getElementById("cc-add-date-display");
    var addDateErr = document.getElementById("cc-add-date-err");
    var addAmount = document.getElementById("cc-add-amount");
    var addAmountErr = document.getElementById("cc-add-amount-err");
    var addRecurring = document.getElementById("cc-add-recurring");

    var dateWrap = document.querySelector(".cc-modal-field-date-wrap");
    var txDateTrigger = document.getElementById("cc-date-trigger");
    var txDateCalendar = document.getElementById("cc-date-calendar");
    var txCalTitle = document.getElementById("cc-cal-title");
    var txCalGrid = document.getElementById("cc-cal-grid");
    var txCalPrev = document.getElementById("cc-cal-prev");
    var txCalNext = document.getElementById("cc-cal-next");

    var calendarOpen = false;
    var viewYear = new Date().getFullYear();
    var viewMonth = new Date().getMonth();

    var allTransactions = [];
    var jsonTransactionsCache = [];
    var budgetsData = [];
    var currentPage = 1;
    var pendingDeleteTxId = null;

    var txMonthYear = document.getElementById("cc-month-year");
    var txYearPanel = document.getElementById("cc-month-year-panel");
    var txMonthStrip = document.getElementById("cc-month-strip");
    var monthNavYear = new Date().getFullYear();
    var monthNavMonth = new Date().getMonth();

    var cards = [];
    var activeCardId = null;
    var pendingActionsCardId = null;
    var isAddingCard = false;
    var manageEditingCardId = null;

    var manageCardDialog = document.getElementById("cc-manage-card-dialog");
    var manageCardTitle = document.getElementById("cc-manage-card-title");
    var manageCardClose = document.getElementById("cc-manage-card-close");
    var manageCardForm = document.getElementById("cc-manage-card-form");
    var manageName = document.getElementById("cc-manage-name");
    var manageBorrowed = document.getElementById("cc-manage-borrowed");
    var manageNameErr = document.getElementById("cc-manage-name-err");
    var manageBorrowedErr = document.getElementById("cc-manage-borrowed-err");
    var openDeleteCardBtn = document.getElementById("cc-open-delete-card");
    var accountCarouselEl = document.getElementById("cc-account-carousel");
    var accountCardsEl = document.getElementById("cc-account-cards");
    var cardPrevBtn = document.getElementById("cc-card-prev");
    var cardNextBtn = document.getElementById("cc-card-next");
    var cardCarouselMeta = document.getElementById("cc-card-carousel-meta");
    var accountEmptyEl = document.getElementById("cc-account-empty");
    var accountAddBtn = document.getElementById("cc-account-add-btn");

    var cardActionsDialog = document.getElementById("cc-card-actions-dialog");
    var cardActionsClose = document.getElementById("cc-card-actions-close");
    var cardActionsManage = document.getElementById("cc-actions-manage");
    var cardActionsAddCard = document.getElementById("cc-actions-add-card");
    var cardActionsDesc = document.getElementById("cc-card-actions-desc");

    var deleteCardDialog = document.getElementById("cc-delete-card-dialog");
    var deleteCardClose = document.getElementById("cc-delete-card-close");
    var deleteCardYes = document.getElementById("cc-delete-card-yes");
    var deleteCardNo = document.getElementById("cc-delete-card-no");
    var deleteCardLede = document.getElementById("cc-delete-card-lede");

    var monthAriaFmt = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    var editDialog = document.getElementById("cc-edit-dialog");
    var editCloseBtn = document.getElementById("cc-edit-close");
    var editForm = document.getElementById("cc-edit-form");
    var editId = document.getElementById("cc-edit-id");
    var editName = document.getElementById("cc-edit-name");
    var editCategory = document.getElementById("cc-edit-category");
    var editDate = document.getElementById("cc-edit-date");
    var editAmount = document.getElementById("cc-edit-amount");
    var editRecurring = document.getElementById("cc-edit-recurring");
    var editNameErr = document.getElementById("cc-edit-name-err");
    var editDateErr = document.getElementById("cc-edit-date-err");
    var editAmountErr = document.getElementById("cc-edit-amount-err");
    var editRemoveBtn = document.getElementById("cc-edit-remove");

    var deleteDialog = document.getElementById("cc-delete-dialog");
    var deleteCloseBtn = document.getElementById("cc-delete-close");
    var deleteYesBtn = document.getElementById("cc-delete-yes");
    var deleteNoBtn = document.getElementById("cc-delete-no");
    var deleteTitleEl = document.getElementById("cc-delete-title");
    var deleteLedeEl = document.getElementById("cc-delete-lede");

    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalizeQueryCategory(params.get("category"));
    if (fromUrl) catEl.value = fromUrl;

    function rebuildAllFromCache() {
      var seedCardId =
        cards.length > 0 ? cards[0].id : DEFAULT_CARD_ID;
      allTransactions = rebuildTransactionsFromStorage(
        jsonTransactionsCache,
        seedCardId,
      );
    }

    function wipeCreditCardAndTransactions() {
      setSeedCleared(true);
      try {
        localStorage.removeItem(PF_CC_ACCOUNT_KEY);
        localStorage.removeItem(PF_CC_CARDS_KEY);
        localStorage.removeItem(PF_CC_ACTIVE_CARD_KEY);
      } catch (e) {}
      saveDeletedIds(new Set());
      saveOverrides({});
      saveAddedTransactions([]);
      jsonTransactionsCache = [];
      cards = [];
      activeCardId = null;
      rebuildAllFromCache();
    }

    function findCardById(id) {
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].id === id) return cards[i];
      }
      return null;
    }

    function deleteCardById(cardId) {
      if (!cardId) return;

      var ownSeed =
        cards.length > 0 && cards[0].id === cardId && jsonTransactionsCache.length > 0;

      var added = loadAddedTransactions().filter(function (t) {
        return txEffectiveCardId(t) !== cardId;
      });
      saveAddedTransactions(added);

      if (ownSeed) {
        var del = loadDeletedIds();
        for (var i = 0; i < jsonTransactionsCache.length; i++) {
          del.add("cc-b-" + i);
        }
        saveDeletedIds(del);
      }

      var nextCards = cards.filter(function (c) {
        return c.id !== cardId;
      });

      if (nextCards.length === 0) {
        wipeCreditCardAndTransactions();
        return;
      }

      cards = nextCards;
      saveCards(cards);

      if (activeCardId === cardId) {
        activeCardId = cards[0].id;
        saveActiveCardId(activeCardId);
      }

      rebuildAllFromCache();
    }

    function syncActiveCardIndex() {
      var idx = -1;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].id === activeCardId) {
          idx = i;
          break;
        }
      }
      if (idx < 0 && cards.length > 0) {
        activeCardId = cards[0].id;
        saveActiveCardId(activeCardId);
        idx = 0;
      }
      return idx;
    }

    function stepActiveCard(delta) {
      if (!cards.length) return;
      var idx = syncActiveCardIndex();
      if (idx < 0) return;
      var nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= cards.length) return;
      activeCardId = cards[nextIdx].id;
      saveActiveCardId(activeCardId);
      currentPage = 1;
      applyFilters();
    }

    function renderAccountCards() {
      if (!accountCardsEl || !accountEmptyEl) return;

      if (!cards.length) {
        accountCardsEl.innerHTML = "";
        if (accountCarouselEl) accountCarouselEl.hidden = true;
        if (cardCarouselMeta) {
          cardCarouselMeta.hidden = true;
          cardCarouselMeta.textContent = "";
        }
        accountEmptyEl.hidden = false;
        if (addOpenBtn) addOpenBtn.disabled = true;
        return;
      }

      if (accountCarouselEl) accountCarouselEl.hidden = false;
      accountEmptyEl.hidden = true;
      if (addOpenBtn) addOpenBtn.disabled = false;

      syncActiveCardIndex();

      var idx = -1;
      var card = null;
      for (var ci = 0; ci < cards.length; ci++) {
        if (cards[ci].id === activeCardId) {
          idx = ci;
          card = cards[ci];
          break;
        }
      }
      if (!card && cards.length) {
        card = cards[0];
        idx = 0;
        activeCardId = card.id;
        saveActiveCardId(activeCardId);
      }

      accountCardsEl.innerHTML = "";

      var hideNav = cards.length <= 1;
      if (cardPrevBtn) {
        cardPrevBtn.hidden = hideNav;
        cardPrevBtn.disabled = hideNav || idx <= 0;
      }
      if (cardNextBtn) {
        cardNextBtn.hidden = hideNav;
        cardNextBtn.disabled = hideNav || idx < 0 || idx >= cards.length - 1;
      }
      if (cardCarouselMeta) {
        if (cards.length > 1 && idx >= 0) {
          cardCarouselMeta.hidden = false;
          cardCarouselMeta.textContent =
            "Card " + (idx + 1) + " of " + cards.length;
        } else {
          cardCarouselMeta.hidden = true;
          cardCarouselMeta.textContent = "";
        }
      }

      if (!card) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-account-card";
      btn.dataset.cardId = card.id;
      btn.setAttribute("aria-current", "true");
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-controls", "cc-card-actions-dialog");
      var bal = computeRunningBalance(card, allTransactions);
      btn.setAttribute(
        "aria-label",
        "Card options: " +
          card.name +
          ", balance " +
          currency.format(bal !== null ? bal : 0),
      );

      var icon = document.createElement("span");
      icon.className = "cc-account-card__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2 10h20"/><rect x="5" y="14" width="5" height="2" rx="0.5" fill="currentColor"/></svg>';

      var body = document.createElement("span");
      body.className = "cc-account-card__body";

      var nameEl = document.createElement("span");
      nameEl.className = "cc-account-card__name";
      nameEl.textContent = card.name;

      var valEl = document.createElement("span");
      valEl.className = "cc-account-card__value";
      valEl.setAttribute("aria-live", "polite");
      valEl.textContent = bal !== null ? currency.format(bal) : "—";

      var subEl = document.createElement("span");
      subEl.className = "cc-account-card__sub";
      subEl.textContent = "Balance after all transactions on this card";

      body.appendChild(nameEl);
      body.appendChild(valEl);
      body.appendChild(subEl);
      btn.appendChild(icon);
      btn.appendChild(body);
      accountCardsEl.appendChild(btn);
    }

    function closeCardActionsDialog() {
      if (cardActionsDialog && typeof cardActionsDialog.close === "function") {
        cardActionsDialog.close();
      }
    }

    function openCardActionsDialog() {
      if (
        !cardActionsDialog ||
        typeof cardActionsDialog.showModal !== "function"
      )
        return;
      var c = pendingActionsCardId
        ? findCardById(pendingActionsCardId)
        : null;
      if (cardActionsDesc && c) {
        cardActionsDesc.textContent = "Choose an action for " + c.name + ".";
      }
      cardActionsDialog.showModal();
    }

    function onCardBoxClick(cardId) {
      if (!cardId) return;
      pendingActionsCardId = cardId;
      activeCardId = cardId;
      saveActiveCardId(activeCardId);
      applyFilters();
      openCardActionsDialog();
    }

    function openManageForEdit(cardId) {
      if (!manageCardDialog || typeof manageCardDialog.showModal !== "function")
        return;
      closeCardActionsDialog();
      clearManageCardErrors();
      isAddingCard = false;
      manageEditingCardId = cardId;
      var acc = findCardById(cardId);
      if (manageCardTitle) manageCardTitle.textContent = "Credit card";
      if (manageName) manageName.value = acc ? acc.name : "";
      if (manageBorrowed)
        manageBorrowed.value = acc ? String(acc.borrowedAmount) : "1000";
      if (openDeleteCardBtn) {
        openDeleteCardBtn.hidden = false;
        openDeleteCardBtn.disabled = false;
      }
      manageCardDialog.showModal();
      requestAnimationFrame(function () {
        if (manageName) manageName.focus();
      });
    }

    function openManageForAdd() {
      if (!manageCardDialog || typeof manageCardDialog.showModal !== "function")
        return;
      closeCardActionsDialog();
      clearManageCardErrors();
      isAddingCard = true;
      manageEditingCardId = null;
      if (manageCardTitle) manageCardTitle.textContent = "Add credit card";
      if (manageName) manageName.value = "Capital One";
      if (manageBorrowed) manageBorrowed.value = "1000";
      if (openDeleteCardBtn) {
        openDeleteCardBtn.hidden = true;
        openDeleteCardBtn.disabled = true;
      }
      manageCardDialog.showModal();
      requestAnimationFrame(function () {
        if (manageName) manageName.focus();
      });
    }

    function clearManageCardErrors() {
      if (manageNameErr) {
        manageNameErr.hidden = true;
        manageNameErr.textContent = "";
      }
      if (manageBorrowedErr) {
        manageBorrowedErr.hidden = true;
        manageBorrowedErr.textContent = "";
      }
      if (manageName) manageName.removeAttribute("aria-invalid");
      if (manageBorrowed) manageBorrowed.removeAttribute("aria-invalid");
    }

    function closeManageCardModal() {
      if (manageCardDialog && typeof manageCardDialog.close === "function") {
        manageCardDialog.close();
      }
    }

    function openDeleteCardConfirm() {
      if (
        !deleteCardDialog ||
        typeof deleteCardDialog.showModal !== "function"
      )
        return;
      var c = manageEditingCardId ? findCardById(manageEditingCardId) : null;
      var label = c ? c.name : "this card";
      if (deleteCardLede) {
        deleteCardLede.textContent =
          "This will remove " +
          label +
          " and all transactions on this card. If this is your default card, bundled demo transactions are removed too. This cannot be undone.";
      }
      deleteCardDialog.showModal();
    }

    function closeDeleteCardModal() {
      if (deleteCardDialog && typeof deleteCardDialog.close === "function") {
        deleteCardDialog.close();
      }
    }

    function confirmDeleteCreditCard() {
      if (!manageEditingCardId) return;
      deleteCardById(manageEditingCardId);
      closeDeleteCardModal();
      closeManageCardModal();
      currentPage = 1;
      applyFilters();
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
      if (editRecurring) editRecurring.checked = !!tx.recurring;
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

      if (id.indexOf("cc-u-") === 0) {
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
      var exp = totalExpenseInMonth(
        filterRowsByCardId(allTransactions, activeCardId),
        y,
        m,
      );
      btn.classList.toggle("budgets-month-card--active", isActive);
      btn.classList.toggle("budgets-month-card--empty", cap <= 0);

      var label = btn.querySelector(".budgets-month-card__label");
      if (label) label.textContent = MONTH_SHORT[m];

      var ariaBase = monthAriaFmt.format(new Date(Date.UTC(y, m, 1)));
      btn.setAttribute(
        "aria-label",
        isActive
          ? ariaBase + ", selected"
          : "Show credit card transactions for " + ariaBase
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

      var rows = filterRowsByCardId(allTransactions, activeCardId);
      rows = filterByCategory(rows, cat);
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
      renderAccountCards();
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

        var cat = document.getElementById("cc-add-category").value;
        var newTx = {
          __txId: newUserTxId(),
          avatar: "./assets/images/avatars/__new__.jpg",
          name: nameVal,
          category: cat,
          date: dateInputToISO(addDate.value),
          amount: amtNum,
          recurring: addRecurring.checked,
          cardId: activeCardId || DEFAULT_CARD_ID,
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
          recurring: !!(editRecurring && editRecurring.checked),
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

    if (accountCardsEl) {
      accountCardsEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".cc-account-card");
        if (!btn || !accountCardsEl.contains(btn)) return;
        var cid = btn.dataset.cardId;
        if (!cid) return;
        onCardBoxClick(cid);
      });
    }
    if (accountAddBtn) {
      accountAddBtn.addEventListener("click", function () {
        openManageForAdd();
      });
    }
    if (cardActionsClose && cardActionsDialog) {
      cardActionsClose.addEventListener("click", closeCardActionsDialog);
    }
    if (cardActionsDialog) {
      cardActionsDialog.addEventListener("click", function (e) {
        if (e.target === cardActionsDialog) closeCardActionsDialog();
      });
    }
    if (cardActionsManage) {
      cardActionsManage.addEventListener("click", function () {
        if (pendingActionsCardId) {
          openManageForEdit(pendingActionsCardId);
        }
      });
    }
    if (cardActionsAddCard) {
      cardActionsAddCard.addEventListener("click", function () {
        openManageForAdd();
      });
    }
    if (cardPrevBtn) {
      cardPrevBtn.addEventListener("click", function () {
        stepActiveCard(-1);
      });
    }
    if (cardNextBtn) {
      cardNextBtn.addEventListener("click", function () {
        stepActiveCard(1);
      });
    }
    if (manageCardClose && manageCardDialog) {
      manageCardClose.addEventListener("click", closeManageCardModal);
    }
    if (manageCardDialog) {
      manageCardDialog.addEventListener("click", function (e) {
        if (e.target === manageCardDialog) closeManageCardModal();
      });
    }
    if (manageCardForm && manageCardDialog) {
      manageCardForm.addEventListener("submit", function (e) {
        e.preventDefault();
        clearManageCardErrors();
        var nameVal = manageName ? manageName.value.trim() : "";
        var borrowedRaw = manageBorrowed ? manageBorrowed.value.trim() : "";
        var borrowedNum =
          borrowedRaw === "" ? NaN : Number(borrowedRaw);
        var ok = true;

        if (!nameVal) {
          if (manageNameErr) {
            manageNameErr.textContent = "Enter a bank name.";
            manageNameErr.hidden = false;
          }
          if (manageName) manageName.setAttribute("aria-invalid", "true");
          ok = false;
        } else if (nameVal.length > NAME_MAX) {
          if (manageNameErr) {
            manageNameErr.textContent =
              "Name must be " + NAME_MAX + " characters or fewer.";
            manageNameErr.hidden = false;
          }
          if (manageName) manageName.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (borrowedRaw === "" || !Number.isFinite(borrowedNum)) {
          if (manageBorrowedErr) {
            manageBorrowedErr.textContent = "Enter a valid borrowed amount.";
            manageBorrowedErr.hidden = false;
          }
          if (manageBorrowed)
            manageBorrowed.setAttribute("aria-invalid", "true");
          ok = false;
        }

        if (!ok) return;

        if (isAddingCard) {
          var nid = newCardId();
          cards.push({
            id: nid,
            name: nameVal,
            borrowedAmount: borrowedNum,
          });
          activeCardId = nid;
          saveActiveCardId(activeCardId);
        } else if (manageEditingCardId) {
          var target = findCardById(manageEditingCardId);
          if (target) {
            target.name = nameVal;
            target.borrowedAmount = borrowedNum;
          }
        }
        saveCards(cards);
        closeManageCardModal();
        applyFilters();
      });
    }
    if (openDeleteCardBtn) {
      openDeleteCardBtn.addEventListener("click", openDeleteCardConfirm);
    }
    if (deleteCardYes) {
      deleteCardYes.addEventListener("click", confirmDeleteCreditCard);
    }
    if (deleteCardNo) {
      deleteCardNo.addEventListener("click", closeDeleteCardModal);
    }
    if (deleteCardClose) {
      deleteCardClose.addEventListener("click", closeDeleteCardModal);
    }
    if (deleteCardDialog) {
      deleteCardDialog.addEventListener("click", function (e) {
        if (e.target === deleteCardDialog) closeDeleteCardModal();
      });
    }

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        jsonTransactionsCache = isSeedCleared()
          ? []
          : data.creditCardTransactions || [];
        budgetsData = data.budgets || [];
        var st = loadCardsState();
        cards = st.cards;
        activeCardId = st.activeCardId;
        rebuildAllFromCache();
        applyFilters();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        var stErr = loadCardsState();
        cards = stErr.cards;
        activeCardId = stErr.activeCardId;
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
        renderAccountCards();
      });
  });
})();
