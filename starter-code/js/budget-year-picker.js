(function (global) {
  var YEAR_MIN = 2018;
  var YEAR_MAX = 2035;

  function closeAllYearPanels() {
    var panels = document.querySelectorAll(".budgets-year-picker__dropdown");
    for (var i = 0; i < panels.length; i++) {
      panels[i].hidden = true;
    }
    var btns = document.querySelectorAll(".budgets-month-nav__year-btn");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-expanded", "false");
    }
  }

  var docHandlersInstalled = false;
  function ensureDocHandlers() {
    if (docHandlersInstalled) return;
    docHandlersInstalled = true;
    document.addEventListener("click", function (e) {
      if (e.target.closest(".budgets-year-picker")) return;
      closeAllYearPanels();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllYearPanels();
    });
  }

  global.initBudgetYearPicker = function (opts) {
    var btn = opts.button;
    var panel = opts.panel;
    var getYear = opts.getYear;
    var setYear = opts.setYear;
    var onCommit = opts.onCommit || function () {};
    if (!btn || !panel) return;

    ensureDocHandlers();

    function syncButtonText() {
      btn.textContent = String(getYear());
    }

    function updateSelectedState() {
      var cy = String(getYear());
      var optionBtns = panel.querySelectorAll(".budgets-year-picker__option");
      for (var i = 0; i < optionBtns.length; i++) {
        var ob = optionBtns[i];
        var sel = ob.dataset.year === cy;
        ob.classList.toggle("budgets-year-picker__option--selected", sel);
        ob.setAttribute("aria-selected", sel ? "true" : "false");
      }
    }

    if (panel.dataset.ready !== "1") {
      panel.innerHTML = "";
      for (var y = YEAR_MIN; y <= YEAR_MAX; y++) {
        var optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "budgets-year-picker__option";
        optBtn.setAttribute("role", "option");
        optBtn.dataset.year = String(y);
        optBtn.textContent = String(y);
        optBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var year = parseInt(ev.currentTarget.dataset.year, 10);
          if (!Number.isFinite(year)) return;
          setYear(year);
          syncButtonText();
          updateSelectedState();
          closeAllYearPanels();
          onCommit();
        });
        panel.appendChild(optBtn);
      }
      panel.dataset.ready = "1";
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var opening = panel.hidden;
      closeAllYearPanels();
      if (opening) {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        updateSelectedState();
        var sel = panel.querySelector(".budgets-year-picker__option--selected");
        if (sel) sel.scrollIntoView({ block: "nearest" });
      }
    });

    syncButtonText();
    updateSelectedState();
  };

  global.closeBudgetYearPanels = closeAllYearPanels;
})(typeof window !== "undefined" ? window : global);
