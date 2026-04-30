(function () {
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  function applyMeta(theme) {
    document.documentElement.style.colorScheme =
      theme === "dark" ? "dark" : "light";
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("finance-theme", theme);
    } catch (_) {}
    applyMeta(theme);
  }

  applyMeta(currentTheme());

  document.addEventListener("DOMContentLoaded", function () {
    applyMeta(currentTheme());

    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    });
  });
})();
