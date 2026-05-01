(function () {
  var PAGE_SIZE = 10;

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

  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "";
    var b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase() || "?";
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

    var allTransactions = [];
    var currentPage = 1;

    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalizeQueryCategory(params.get("category"));
    if (fromUrl) catEl.value = fromUrl;

    function applyFilters() {
      var q = searchEl.value;
      var sortMode = sortEl.value;
      var cat = catEl.value;

      var rows = filterByCategory(allTransactions, cat);
      rows = filterBySearch(rows, q);
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
        for (var i = 0; i < slice.length; i++) {
          renderRow(tbody, slice[i]);
        }
      }

      pagNav.hidden = total === 0;

      renderPagination(totalPages, total);
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

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        allTransactions = data.transactions || [];
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
