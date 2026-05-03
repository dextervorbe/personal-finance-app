(function () {
  var STORAGE_KEY = "finance-sidebar-collapsed";

  function readStoredCollapsed() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function applyCollapsed(collapsed) {
    document.body.classList.toggle("layout-sidebar-collapsed", collapsed);
    var btn = document.querySelector("[data-sidebar-toggle]");
    if (btn) {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute(
        "aria-label",
        collapsed ? "Expand navigation menu" : "Minimize navigation menu",
      );
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector("[data-sidebar-toggle]");
    var sidebar = document.getElementById("app-sidebar");
    if (!toggle || !sidebar) return;

    applyCollapsed(readStoredCollapsed());

    toggle.addEventListener("click", function () {
      var collapsed = !document.body.classList.contains("layout-sidebar-collapsed");
      applyCollapsed(collapsed);
    });
  });
})();
