(function (global) {
  /**
   * Net balance after all posted transactions (positive amounts = money in,
   * negative = spending). Optional openingBalance is applied before summing.
   */
  function ledgerBalanceFromTransactions(transactions, openingBalance) {
    var base =
      openingBalance == null || openingBalance === ""
        ? 0
        : Number(openingBalance);
    if (!Number.isFinite(base)) base = 0;
    var sum = base;
    if (!transactions || transactions.length === 0) return sum;
    for (var i = 0; i < transactions.length; i++) {
      var n = Number(transactions[i].amount);
      if (Number.isFinite(n)) sum += n;
    }
    return sum;
  }

  global.ledgerBalanceFromTransactions = ledgerBalanceFromTransactions;
})(typeof window !== "undefined" ? window : globalThis);
