(function (global) {
  /**
   * Parse amount from add/edit transaction fields.
   * Unsigned values are debits (negative); leading "+" marks income (positive).
   */
  function parseTransactionAmountInput(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return NaN;
    var isCredit = s.charAt(0) === "+";
    if (isCredit) s = s.slice(1).trim();
    else if (s.charAt(0) === "-") s = s.slice(1).trim();
    if (s === "") return NaN;
    var n = Number(s);
    if (!Number.isFinite(n)) return NaN;
    if (n === 0) return 0;
    return isCredit ? Math.abs(n) : -Math.abs(n);
  }

  /** Value for amount inputs when opening edit (matches parse rules). */
  function formatTransactionAmountInput(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return "0";
    if (n > 0) return "+" + n;
    return String(Math.abs(n));
  }

  global.parseTransactionAmountInput = parseTransactionAmountInput;
  global.formatTransactionAmountInput = formatTransactionAmountInput;
})(typeof window !== "undefined" ? window : globalThis);
