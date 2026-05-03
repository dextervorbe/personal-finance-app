(function () {
  var POT_NAME_MAX = 30;

  /** Pots totals + main balance (synced with overview via same key). */
  var PF_POTS_STORAGE_KEY = "pf-pots-app-state-v1";

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

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".pots-page");
    if (!main) return;

    var gridRoot = document.getElementById("pots-grid-root");
    var addOpenBtn = document.getElementById("pot-add-open");
    var addDialog = document.getElementById("pot-add-dialog");
    var addClose = document.getElementById("pot-add-close");
    var addForm = document.getElementById("pot-add-form");
    var addName = document.getElementById("pot-add-name");
    var addNameCount = document.getElementById("pot-add-name-count");
    var addNameErr = document.getElementById("pot-add-name-err");
    var addTarget = document.getElementById("pot-add-target");
    var addTargetErr = document.getElementById("pot-add-target-err");
    var addTheme = document.getElementById("pot-add-theme");
    var addThemeSwatch = document.getElementById("pot-add-theme-swatch");

    var editDialog = document.getElementById("pot-edit-dialog");
    var editClose = document.getElementById("pot-edit-close");
    var editForm = document.getElementById("pot-edit-form");
    var editName = document.getElementById("pot-edit-name");
    var editNameCount = document.getElementById("pot-edit-name-count");
    var editNameErr = document.getElementById("pot-edit-name-err");
    var editTarget = document.getElementById("pot-edit-target");
    var editTargetErr = document.getElementById("pot-edit-target-err");
    var editTheme = document.getElementById("pot-edit-theme");
    var editThemeSwatch = document.getElementById("pot-edit-theme-swatch");

    var deleteDialog = document.getElementById("pot-delete-dialog");
    var deleteClose = document.getElementById("pot-delete-close");
    var deleteYes = document.getElementById("pot-delete-yes");
    var deleteNo = document.getElementById("pot-delete-no");
    var deleteTitle = document.getElementById("pot-delete-title");
    var deleteLede = document.getElementById("pot-delete-lede");

    var addMoneyDialog = document.getElementById("pot-add-money-dialog");
    var addMoneyClose = document.getElementById("pot-add-money-close");
    var addMoneyForm = document.getElementById("pot-add-money-form");
    var addMoneyTitle = document.getElementById("pot-add-money-title");
    var addMoneyPreview = document.getElementById("pot-add-money-preview");
    var addMoneyAmount = document.getElementById("pot-add-money-amount");
    var addMoneyErr = document.getElementById("pot-add-money-err");

    var withdrawDialog = document.getElementById("pot-withdraw-dialog");
    var withdrawClose = document.getElementById("pot-withdraw-close");
    var withdrawForm = document.getElementById("pot-withdraw-form");
    var withdrawTitle = document.getElementById("pot-withdraw-title");
    var withdrawPreview = document.getElementById("pot-withdraw-preview");
    var withdrawAmount = document.getElementById("pot-withdraw-amount");
    var withdrawErr = document.getElementById("pot-withdraw-err");

    var potsState = [];
    var currentBalance = 0;

    function normalizePotRow(p) {
      return {
        name: String(p.name || "").trim() || "Pot",
        target: Number.isFinite(Number(p.target)) ? Number(p.target) : 0,
        total: Number.isFinite(Number(p.total)) ? Number(p.total) : 0,
        theme: typeof p.theme === "string" ? p.theme : "#277C78",
      };
    }

    function loadPotsAppState() {
      try {
        var raw = localStorage.getItem(PF_POTS_STORAGE_KEY);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o || typeof o !== "object" || !Array.isArray(o.pots)) return null;
        return o;
      } catch (e) {
        return null;
      }
    }

    function savePotsAppState() {
      try {
        localStorage.setItem(
          PF_POTS_STORAGE_KEY,
          JSON.stringify({
            pots: potsState.map(function (p) {
              return {
                name: p.name,
                target: p.target,
                total: p.total,
                theme: p.theme,
              };
            }),
            mainBalance: currentBalance,
          })
        );
      } catch (e) {
        /* quota / private mode */
      }
    }

    var pendingDeleteIndex = null;
    var pendingEditIndex = null;
    var pendingMoneyIndex = null;

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

    function syncPotNameCount(input, countEl) {
      if (!input || !countEl) return;
      var len = input.value.length;
      var left = Math.max(0, POT_NAME_MAX - len);
      countEl.textContent = left + " of " + POT_NAME_MAX + " characters left";
    }

    function populateThemeSelect(selectEl, swatchEl, preferredHex) {
      if (!selectEl) return;
      selectEl.innerHTML = "";
      for (var i = 0; i < THEME_PRESETS.length; i++) {
        var p = THEME_PRESETS[i];
        var opt = document.createElement("option");
        opt.value = p.hex;
        opt.textContent = p.label;
        selectEl.appendChild(opt);
      }
      var idx = 0;
      if (preferredHex) {
        var h = String(preferredHex).toLowerCase().trim();
        for (var j = 0; j < THEME_PRESETS.length; j++) {
          if (THEME_PRESETS[j].hex.toLowerCase() === h) {
            idx = j;
            break;
          }
        }
      }
      selectEl.selectedIndex = idx;
      if (swatchEl) swatchEl.style.backgroundColor = selectEl.value;
    }

    function syncAddThemeSwatch() {
      if (!addTheme || !addThemeSwatch) return;
      addThemeSwatch.style.backgroundColor = addTheme.value;
    }

    function syncEditThemeSwatch() {
      if (!editTheme || !editThemeSwatch) return;
      editThemeSwatch.style.backgroundColor = editTheme.value;
    }

    function isPotNameTaken(name, excludeIndex) {
      var n = name.trim().toLowerCase();
      if (!n) return false;
      for (var i = 0; i < potsState.length; i++) {
        if (i === excludeIndex) continue;
        if (potsState[i].name.trim().toLowerCase() === n) return true;
      }
      return false;
    }

    function closeAllPotMenus() {
      var wraps = document.querySelectorAll(".pot-card__menu-wrap");
      for (var w = 0; w < wraps.length; w++) {
        wraps[w].classList.remove("is-open");
        var dd = wraps[w].querySelector(".pot-card__dropdown");
        if (dd) dd.hidden = true;
        var mBtn = wraps[w].querySelector(".pot-card__menu");
        if (mBtn) mBtn.setAttribute("aria-expanded", "false");
      }
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest(".pot-card__menu-wrap")) return;
      closeAllPotMenus();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeAllPotMenus();
    });

    function renderPots() {
      if (!gridRoot) return;
      gridRoot.innerHTML = "";

      if (potsState.length === 0) {
        var empty = document.createElement("p");
        empty.className = "pots-empty";
        empty.textContent =
          "No pots yet. Add a pot to start saving toward a goal.";
        gridRoot.appendChild(empty);
        savePotsAppState();
        return;
      }

      for (var i = 0; i < potsState.length; i++) {
        (function (idx) {
          var p = potsState[idx];
          var pct =
            p.target > 0
              ? Math.min((p.total / p.target) * 100, 100)
              : 0;
          var pctLabel = p.target > 0 ? pct.toFixed(2) : "0.00";

          var article = document.createElement("article");
          article.className = "pot-card";

          var header = document.createElement("header");
          header.className = "pot-card__header";

          var dot = document.createElement("span");
          dot.className = "pot-card__dot";
          dot.style.backgroundColor = p.theme;
          dot.setAttribute("aria-hidden", "true");

          var title = document.createElement("h2");
          title.className = "pot-card__title";
          title.textContent = p.name;

          var menuWrap = document.createElement("div");
          menuWrap.className = "pot-card__menu-wrap";

          var menuBtn = document.createElement("button");
          menuBtn.type = "button";
          menuBtn.className = "pot-card__menu";
          menuBtn.setAttribute("aria-label", p.name + " pot options");
          menuBtn.setAttribute("aria-expanded", "false");
          menuBtn.setAttribute("aria-haspopup", "true");

          var menuImg = document.createElement("img");
          menuImg.src = "./assets/images/icon-ellipsis.svg";
          menuImg.alt = "";
          menuImg.width = 21;
          menuImg.height = 17;
          menuBtn.appendChild(menuImg);

          var dropdown = document.createElement("div");
          dropdown.className = "pot-card__dropdown";
          dropdown.setAttribute("role", "menu");
          dropdown.hidden = true;
          dropdown.id = "pot-dd-" + idx;

          var editItem = document.createElement("button");
          editItem.type = "button";
          editItem.className = "pot-card__dropdown-item";
          editItem.setAttribute("role", "menuitem");
          editItem.textContent = "Edit Pot";

          var sep = document.createElement("div");
          sep.className = "pot-card__dropdown-sep";
          sep.setAttribute("role", "separator");

          var delItem = document.createElement("button");
          delItem.type = "button";
          delItem.className =
            "pot-card__dropdown-item pot-card__dropdown-item--danger";
          delItem.setAttribute("role", "menuitem");
          delItem.textContent = "Delete Pot";

          dropdown.appendChild(editItem);
          dropdown.appendChild(sep);
          dropdown.appendChild(delItem);

          menuBtn.setAttribute("aria-controls", dropdown.id);

          menuWrap.appendChild(menuBtn);
          menuWrap.appendChild(dropdown);

          menuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var wasOpen = !dropdown.hidden;
            closeAllPotMenus();
            if (!wasOpen) {
              dropdown.hidden = false;
              menuWrap.classList.add("is-open");
              menuBtn.setAttribute("aria-expanded", "true");
            }
          });
          editItem.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllPotMenus();
            openEditModal(idx);
          });
          delItem.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllPotMenus();
            openDeleteModal(idx);
          });

          header.appendChild(dot);
          header.appendChild(title);
          header.appendChild(menuWrap);

          var savedRow = document.createElement("div");
          savedRow.className = "pot-card__saved-row";
          var savedLab = document.createElement("p");
          savedLab.className = "pot-card__saved-label";
          savedLab.textContent = "Total Saved:";
          var savedVal = document.createElement("p");
          savedVal.className = "pot-card__saved-value";
          savedVal.textContent = currency.format(p.total);
          savedRow.appendChild(savedLab);
          savedRow.appendChild(savedVal);

          var progress = document.createElement("div");
          progress.className = "pot-card__progress";
          progress.setAttribute("role", "progressbar");
          progress.setAttribute("aria-valuemin", "0");
          progress.setAttribute("aria-valuemax", "100");
          progress.setAttribute("aria-valuenow", String(Math.round(pct)));
          progress.setAttribute(
            "aria-label",
            pctLabel + "% of savings goal for " + p.name
          );
          var fill = document.createElement("span");
          fill.className = "pot-card__progress-fill";
          fill.style.width = pct + "%";
          fill.style.backgroundColor = p.theme;
          progress.appendChild(fill);

          var metaRow = document.createElement("div");
          metaRow.className = "pot-card__meta-row";
          var pctP = document.createElement("p");
          pctP.className = "pot-card__pct";
          pctP.textContent = pctLabel + "%";
          var tgtP = document.createElement("p");
          tgtP.className = "pot-card__target";
          tgtP.innerHTML =
            "Target of <strong>" + currency.format(p.target) + "</strong>";
          metaRow.appendChild(pctP);
          metaRow.appendChild(tgtP);

          var actions = document.createElement("div");
          actions.className = "pot-card__actions";
          var btnAdd = document.createElement("button");
          btnAdd.type = "button";
          btnAdd.className = "pot-card__btn";
          btnAdd.textContent = "+ Add Money";
          var btnWd = document.createElement("button");
          btnWd.type = "button";
          btnWd.className = "pot-card__btn";
          btnWd.textContent = "Withdraw";

          btnAdd.addEventListener("click", function () {
            openAddMoneyModal(idx);
          });
          btnWd.addEventListener("click", function () {
            openWithdrawModal(idx);
          });

          actions.appendChild(btnAdd);
          actions.appendChild(btnWd);

          article.appendChild(header);
          article.appendChild(savedRow);
          article.appendChild(progress);
          article.appendChild(metaRow);
          article.appendChild(actions);

          gridRoot.appendChild(article);
        })(i);
      }
      savePotsAppState();
    }

    function openAddModal() {
      if (!addDialog || typeof addDialog.showModal !== "function") return;
      hideErr(addNameErr);
      hideErr(addTargetErr);
      if (addName) addName.removeAttribute("aria-invalid");
      if (addTarget) addTarget.removeAttribute("aria-invalid");
      if (addName) addName.value = "";
      if (addTarget) addTarget.value = "";
      syncPotNameCount(addName, addNameCount);
      populateThemeSelect(addTheme, addThemeSwatch, null);
      syncAddThemeSwatch();
      addDialog.showModal();
      requestAnimationFrame(function () {
        if (addName) addName.focus();
      });
    }

    function closeAddModal() {
      if (addDialog && typeof addDialog.close === "function") addDialog.close();
    }

    function openEditModal(index) {
      var p = potsState[index];
      if (!p || !editDialog || typeof editDialog.showModal !== "function") return;
      pendingEditIndex = index;
      hideErr(editNameErr);
      hideErr(editTargetErr);
      if (editName) editName.removeAttribute("aria-invalid");
      if (editTarget) editTarget.removeAttribute("aria-invalid");
      if (editName) editName.value = p.name;
      if (editTarget) editTarget.value = String(p.target);
      syncPotNameCount(editName, editNameCount);
      populateThemeSelect(editTheme, editThemeSwatch, p.theme);
      syncEditThemeSwatch();
      editDialog.showModal();
      requestAnimationFrame(function () {
        if (editTarget) {
          editTarget.focus();
          editTarget.select();
        }
      });
    }

    function closeEditModal() {
      pendingEditIndex = null;
      if (editDialog && typeof editDialog.close === "function") editDialog.close();
    }

    function openDeleteModal(index) {
      var p = potsState[index];
      if (!p || !deleteDialog) return;
      pendingDeleteIndex = index;
      if (deleteTitle) deleteTitle.textContent = "Delete '" + p.name + "'";
      if (deleteLede) {
        deleteLede.textContent =
          "Are you sure you want to delete this pot? This action cannot be reversed, and all the data inside it will be removed forever.";
      }
      deleteDialog.showModal();
    }

    function closeDeleteModal() {
      pendingDeleteIndex = null;
      if (deleteDialog && typeof deleteDialog.close === "function") {
        deleteDialog.close();
      }
    }

    function confirmDeletePot() {
      if (pendingDeleteIndex === null) return;
      var idx = pendingDeleteIndex;
      closeDeleteModal();
      if (idx >= 0 && idx < potsState.length) {
        currentBalance += potsState[idx].total;
        potsState.splice(idx, 1);
        renderPots();
      }
    }

    function updateAddMoneyPreview() {
      if (!addMoneyPreview || pendingMoneyIndex === null) return;
      var p = potsState[pendingMoneyIndex];
      if (!p) return;
      var raw = addMoneyAmount ? addMoneyAmount.value.trim() : "";
      var amt = raw === "" ? 0 : Number(raw);
      var add =
        Number.isFinite(amt) && amt > 0 ? amt : 0;
      var newTotal = p.total + add;
      addMoneyPreview.innerHTML =
        '<div class="pot-modal-preview-row"><span>New Amount</span><strong>' +
        currency.format(newTotal) +
        "</strong></div>" +
        '<div class="pot-modal-preview-row"><span>Target</span><span>' +
        currency.format(p.target) +
        "</span></div>";
    }

    function openAddMoneyModal(index) {
      var p = potsState[index];
      if (!p || !addMoneyDialog || typeof addMoneyDialog.showModal !== "function")
        return;
      pendingMoneyIndex = index;
      if (addMoneyTitle) addMoneyTitle.textContent = "Add to '" + p.name + "'";
      hideErr(addMoneyErr);
      if (addMoneyAmount) {
        addMoneyAmount.value = "";
        addMoneyAmount.removeAttribute("aria-invalid");
      }
      updateAddMoneyPreview();
      addMoneyDialog.showModal();
      requestAnimationFrame(function () {
        if (addMoneyAmount) addMoneyAmount.focus();
      });
    }

    function closeAddMoneyModal() {
      pendingMoneyIndex = null;
      if (addMoneyDialog && typeof addMoneyDialog.close === "function") {
        addMoneyDialog.close();
      }
    }

    function updateWithdrawPreview() {
      if (!withdrawPreview || pendingMoneyIndex === null) return;
      var p = potsState[pendingMoneyIndex];
      if (!p) return;
      var raw = withdrawAmount ? withdrawAmount.value.trim() : "";
      var amt = raw === "" ? 0 : Number(raw);
      var w =
        Number.isFinite(amt) && amt > 0 ? amt : 0;
      var newTotal = Math.max(p.total - w, 0);
      withdrawPreview.innerHTML =
        '<div class="pot-modal-preview-row"><span>New Amount</span><strong>' +
        currency.format(newTotal) +
        "</strong></div>" +
        '<div class="pot-modal-preview-row"><span>Target</span><span>' +
        currency.format(p.target) +
        "</span></div>";
    }

    function openWithdrawModal(index) {
      var p = potsState[index];
      if (
        !p ||
        !withdrawDialog ||
        typeof withdrawDialog.showModal !== "function"
      )
        return;
      pendingMoneyIndex = index;
      if (withdrawTitle)
        withdrawTitle.textContent = "Withdraw from '" + p.name + "'";
      hideErr(withdrawErr);
      if (withdrawAmount) {
        withdrawAmount.value = "";
        withdrawAmount.removeAttribute("aria-invalid");
      }
      updateWithdrawPreview();
      withdrawDialog.showModal();
      requestAnimationFrame(function () {
        if (withdrawAmount) withdrawAmount.focus();
      });
    }

    function closeWithdrawModal() {
      pendingMoneyIndex = null;
      if (withdrawDialog && typeof withdrawDialog.close === "function") {
        withdrawDialog.close();
      }
    }

    if (addTheme) addTheme.addEventListener("change", syncAddThemeSwatch);
    if (editTheme) editTheme.addEventListener("change", syncEditThemeSwatch);

    if (addName && addNameCount) {
      addName.addEventListener("input", function () {
        syncPotNameCount(addName, addNameCount);
      });
    }
    if (editName && editNameCount) {
      editName.addEventListener("input", function () {
        syncPotNameCount(editName, editNameCount);
      });
    }

    if (addMoneyAmount) {
      addMoneyAmount.addEventListener("input", updateAddMoneyPreview);
    }
    if (withdrawAmount) {
      withdrawAmount.addEventListener("input", updateWithdrawPreview);
    }

    if (addOpenBtn) addOpenBtn.addEventListener("click", openAddModal);
    if (addClose && addDialog) {
      addClose.addEventListener("click", closeAddModal);
      addDialog.addEventListener("click", function (e) {
        if (e.target === addDialog) closeAddModal();
      });
    }

    if (editClose && editDialog) {
      editClose.addEventListener("click", closeEditModal);
      editDialog.addEventListener("click", function (e) {
        if (e.target === editDialog) closeEditModal();
      });
    }

    if (deleteClose && deleteDialog) {
      deleteClose.addEventListener("click", closeDeleteModal);
      deleteDialog.addEventListener("click", function (e) {
        if (e.target === deleteDialog) closeDeleteModal();
      });
    }
    if (deleteYes) deleteYes.addEventListener("click", confirmDeletePot);
    if (deleteNo) deleteNo.addEventListener("click", closeDeleteModal);

    if (addMoneyClose && addMoneyDialog) {
      addMoneyClose.addEventListener("click", closeAddMoneyModal);
      addMoneyDialog.addEventListener("click", function (e) {
        if (e.target === addMoneyDialog) closeAddMoneyModal();
      });
    }

    if (withdrawClose && withdrawDialog) {
      withdrawClose.addEventListener("click", closeWithdrawModal);
      withdrawDialog.addEventListener("click", function (e) {
        if (e.target === withdrawDialog) closeWithdrawModal();
      });
    }

    if (addForm) {
      addForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(addNameErr);
        hideErr(addTargetErr);

        var nameRaw = addName ? addName.value.trim() : "";
        if (!nameRaw) {
          showErr(addNameErr, "Enter a pot name.");
          if (addName) addName.setAttribute("aria-invalid", "true");
          return;
        }
        if (nameRaw.length > POT_NAME_MAX) {
          showErr(addNameErr, "Pot name must be " + POT_NAME_MAX + " characters or fewer.");
          if (addName) addName.setAttribute("aria-invalid", "true");
          return;
        }
        if (isPotNameTaken(nameRaw, -1)) {
          showErr(addNameErr, "A pot with this name already exists.");
          if (addName) addName.setAttribute("aria-invalid", "true");
          return;
        }
        if (addName) addName.removeAttribute("aria-invalid");

        var rawT = addTarget ? addTarget.value.trim() : "";
        var targetNum = rawT === "" ? NaN : Number(rawT);
        if (!Number.isFinite(targetNum) || targetNum <= 0) {
          showErr(addTargetErr, "Enter a target amount greater than zero.");
          if (addTarget) addTarget.setAttribute("aria-invalid", "true");
          return;
        }
        if (addTarget) addTarget.removeAttribute("aria-invalid");

        potsState.push({
          name: nameRaw,
          target: targetNum,
          total: 0,
          theme: addTheme ? addTheme.value : "#277C78",
        });
        renderPots();
        closeAddModal();
      });
    }

    if (editForm) {
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(editNameErr);
        hideErr(editTargetErr);
        if (pendingEditIndex === null) return;

        var nameRaw = editName ? editName.value.trim() : "";
        if (!nameRaw) {
          showErr(editNameErr, "Enter a pot name.");
          if (editName) editName.setAttribute("aria-invalid", "true");
          return;
        }
        if (nameRaw.length > POT_NAME_MAX) {
          showErr(editNameErr, "Pot name must be " + POT_NAME_MAX + " characters or fewer.");
          if (editName) editName.setAttribute("aria-invalid", "true");
          return;
        }
        if (isPotNameTaken(nameRaw, pendingEditIndex)) {
          showErr(editNameErr, "A pot with this name already exists.");
          if (editName) editName.setAttribute("aria-invalid", "true");
          return;
        }
        if (editName) editName.removeAttribute("aria-invalid");

        var rawT = editTarget ? editTarget.value.trim() : "";
        var targetNum = rawT === "" ? NaN : Number(rawT);
        if (!Number.isFinite(targetNum) || targetNum <= 0) {
          showErr(editTargetErr, "Enter a target amount greater than zero.");
          if (editTarget) editTarget.setAttribute("aria-invalid", "true");
          return;
        }

        var row = potsState[pendingEditIndex];
        if (targetNum < row.total) {
          showErr(
            editTargetErr,
            "Target cannot be less than the amount already saved (" +
              currency.format(row.total) +
              ")."
          );
          if (editTarget) editTarget.setAttribute("aria-invalid", "true");
          return;
        }
        if (editTarget) editTarget.removeAttribute("aria-invalid");

        row.name = nameRaw;
        row.target = targetNum;
        row.theme = editTheme ? editTheme.value : row.theme;
        closeEditModal();
        renderPots();
      });
    }

    if (addMoneyForm) {
      addMoneyForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(addMoneyErr);
        if (pendingMoneyIndex === null) return;
        var idx = pendingMoneyIndex;
        var p = potsState[idx];
        if (!p) {
          closeAddMoneyModal();
          return;
        }

        var raw = addMoneyAmount ? addMoneyAmount.value.trim() : "";
        var amt = raw === "" ? NaN : Number(raw);
        if (!Number.isFinite(amt) || amt <= 0) {
          showErr(addMoneyErr, "Enter an amount greater than zero.");
          if (addMoneyAmount) addMoneyAmount.setAttribute("aria-invalid", "true");
          return;
        }
        if (amt > currentBalance) {
          showErr(
            addMoneyErr,
            "Amount cannot exceed your current balance (" +
              currency.format(currentBalance) +
              ")."
          );
          if (addMoneyAmount) addMoneyAmount.setAttribute("aria-invalid", "true");
          return;
        }
        if (addMoneyAmount) addMoneyAmount.removeAttribute("aria-invalid");

        p.total += amt;
        currentBalance -= amt;
        closeAddMoneyModal();
        renderPots();
      });
    }

    if (withdrawForm) {
      withdrawForm.addEventListener("submit", function (e) {
        e.preventDefault();
        hideErr(withdrawErr);
        if (pendingMoneyIndex === null) return;
        var idx = pendingMoneyIndex;
        var p = potsState[idx];
        if (!p) {
          closeWithdrawModal();
          return;
        }

        var raw = withdrawAmount ? withdrawAmount.value.trim() : "";
        var amt = raw === "" ? NaN : Number(raw);
        if (!Number.isFinite(amt) || amt <= 0) {
          showErr(withdrawErr, "Enter an amount greater than zero.");
          if (withdrawAmount) withdrawAmount.setAttribute("aria-invalid", "true");
          return;
        }
        if (amt > p.total) {
          showErr(
            withdrawErr,
            "Amount cannot exceed the pot balance (" +
              currency.format(p.total) +
              ")."
          );
          if (withdrawAmount) withdrawAmount.setAttribute("aria-invalid", "true");
          return;
        }
        if (withdrawAmount) withdrawAmount.removeAttribute("aria-invalid");

        p.total -= amt;
        currentBalance += amt;
        closeWithdrawModal();
        renderPots();
      });
    }

    fetch("./data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then(function (data) {
        var baseLedger = ledgerBalanceFromTransactions(
          data.transactions || [],
          data.openingBalance
        );
        var seed = (data.pots || []).map(normalizePotRow);
        var stored = loadPotsAppState();

        if (stored && Array.isArray(stored.pots)) {
          potsState = stored.pots.map(normalizePotRow);
          if (
            typeof stored.mainBalance === "number" &&
            Number.isFinite(stored.mainBalance)
          ) {
            currentBalance = Math.max(0, stored.mainBalance);
          } else {
            var inPots = 0;
            for (var pi = 0; pi < potsState.length; pi++) {
              inPots += potsState[pi].total;
            }
            currentBalance = Math.max(0, baseLedger - inPots);
          }
        } else {
          potsState = seed;
          currentBalance = baseLedger;
        }

        populateThemeSelect(addTheme, addThemeSwatch, null);
        populateThemeSelect(editTheme, editThemeSwatch, THEME_PRESETS[0].hex);
        syncAddThemeSwatch();
        syncEditThemeSwatch();
        renderPots();
        main.removeAttribute("aria-busy");
      })
      .catch(function () {
        main.removeAttribute("aria-busy");
        var err = document.createElement("p");
        err.className = "pots-error";
        err.setAttribute("role", "alert");
        err.textContent =
          "Could not load finance data. Serve this folder over HTTP so data.json can be fetched.";
        main.insertBefore(err, main.firstChild);
      });
  });
})();
