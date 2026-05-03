/**
 * Category → accent color (same palette as recurring bills). Exposed for avatar fallbacks.
 */
(function (global) {
  var CATEGORY_ACCENT = {
    Entertainment: "#C94736",
    Bills: "#277C78",
    Groceries: "#82C9D7",
    "Dining Out": "#3F82B2",
    Transportation: "#F2CDAC",
    "Personal Care": "#67C7C9",
    Education: "#D946B8",
    Lifestyle: "#826CB0",
    Shopping: "#626070",
    General: "#6B7F59",
  };

  function financeCategoryAccent(category) {
    var c = category == null ? "" : String(category);
    return CATEGORY_ACCENT[c] || "#277C78";
  }

  /** Strong fill + white text for initials chips when avatar image is missing. */
  function financeStyleCategoryFallback(el, category) {
    if (!el) return;
    var accent =
      typeof global.financeCategoryAccent === "function"
        ? global.financeCategoryAccent
        : financeCategoryAccent;
    el.style.backgroundColor = accent(category);
    el.style.color = "#fff";
  }

  global.financeCategoryAccent = financeCategoryAccent;
  global.financeStyleCategoryFallback = financeStyleCategoryFallback;
})(typeof window !== "undefined" ? window : this);
