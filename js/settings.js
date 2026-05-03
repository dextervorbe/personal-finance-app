(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector(".settings-page");
    if (!main) return;

    var input = document.getElementById("settings-category-input");
    var colorInput = document.getElementById("settings-category-color");
    var addBtn = document.getElementById("settings-category-add");
    var listEl = document.getElementById("settings-category-list");
    var errEl = document.getElementById("settings-category-err");

    if (
      colorInput &&
      typeof financeDefaultUserCategoryColor === "string"
    ) {
      colorInput.value = financeDefaultUserCategoryColor;
    }

    function hideErr() {
      if (!errEl) return;
      errEl.hidden = true;
      errEl.textContent = "";
    }

    function showErr(msg) {
      if (!errEl) return;
      errEl.hidden = false;
      errEl.textContent = msg;
    }

    function renderList() {
      if (
        !listEl ||
        typeof financeGetUserCategoryEntries !== "function"
      ) {
        return;
      }
      listEl.innerHTML = "";
      var rows = financeGetUserCategoryEntries();
      if (rows.length === 0) {
        var liEmpty = document.createElement("li");
        liEmpty.className =
          "settings-category-row settings-category-row--empty";
        liEmpty.textContent =
          "No custom categories yet. Add a name and color below — they appear with the built-in categories everywhere you pick a category.";
        listEl.appendChild(liEmpty);
        return;
      }

      for (var i = 0; i < rows.length; i++) {
        (function (entry) {
          var name = entry.name;
          var col = entry.color;

          var li = document.createElement("li");
          li.className = "settings-category-row";

          var colorEl = document.createElement("input");
          colorEl.type = "color";
          colorEl.className = "settings-category-color-input";
          colorEl.value = col;
          colorEl.setAttribute("title", "Color for " + name);
          colorEl.setAttribute("aria-label", "Color for category " + name);
          colorEl.addEventListener("input", function () {
            if (typeof financeSetUserCategoryColor === "function") {
              financeSetUserCategoryColor(name, colorEl.value);
            }
          });

          var span = document.createElement("span");
          span.className = "settings-category-name";
          span.textContent = name;

          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "settings-category-remove";
          rm.textContent = "Remove";
          rm.setAttribute("aria-label", "Remove category " + name);
          rm.addEventListener("click", function () {
            if (typeof financeRemoveUserCategory === "function") {
              financeRemoveUserCategory(name);
            }
            renderList();
          });

          li.appendChild(colorEl);
          li.appendChild(span);
          li.appendChild(rm);
          listEl.appendChild(li);
        })(rows[i]);
      }
    }

    function tryAdd() {
      hideErr();
      var raw = input ? input.value : "";
      var rawColor = colorInput ? colorInput.value : "";
      if (typeof financeAddUserCategory !== "function") return;
      var res = financeAddUserCategory(raw, rawColor);
      if (!res.ok) {
        if (res.reason === "empty") {
          showErr("Enter a category name.");
        } else if (res.reason === "preset") {
          showErr("That name is already a default category.");
        } else if (res.reason === "duplicate") {
          showErr("That category is already in your list.");
        } else {
          showErr("Could not add category.");
        }
        return;
      }
      if (input) input.value = "";
      renderList();
      if (input) input.focus();
    }

    if (addBtn) {
      addBtn.addEventListener("click", function () {
        tryAdd();
      });
    }

    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          tryAdd();
        }
      });
    }

    renderList();
    main.removeAttribute("aria-busy");
  });
})();
