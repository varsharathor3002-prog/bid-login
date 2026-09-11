/* Dormant until explicitly integrated. Loading this file never starts a scan. */
(() => {
  const COMPANY_NAMES = Object.freeze(['LAPS N TABS TECHNOLOGY PRIVATE LIMITED', 'LAPS N TABS TECHNOLOGY PVT LTD']);
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const header = (value) => clean(value).toLowerCase().replace(/[:*]/g, '').trim();
  const sellerKey = (value) => clean(value)
    .replace(/\s*\((?:MSE|MII)(?:\s*,\s*(?:MSE|MII))*\)\s*$/i, "")
    .trim().toUpperCase();

  function price(value) {
    // GeM renders its rupee glyph through a custom icon font; the cell's
    // actual text/innerText content is a literal backtick, not U+20B9.
    const match = clean(value).match(/^(?:(?:₹|`|INR|Rs\.?)\s*)?(\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.(\d{1,2}))?(?:\s*(?:\(Bid Price\)|\/-))?$/i);
    if (!match) return null;
    // Preserve currency precision without floating point conversion.
    return `${match[1].replace(/,/g, "")}.${(match[2] || "").padEnd(2, "0")}`;
  }

  function parseTable(headers, rows, companyNames = COMPANY_NAMES) {
    const columns = headers.map(header);
    const required = [/^seller\s+name\b/, /^offered\s+item\b/, /^total\s+price\b/, /^(?:rank|awarded)\b/];
    const indices = required.map((pattern) => columns.findIndex((name) => pattern.test(name)));
    if (indices.some((index) => index < 0)) {
      return { status: "unreadable", reason: "Financial table headers missing", sellers: [] };
    }
    if (!rows.length) return { status: "unreadable", reason: "No seller rows", sellers: [] };
    const sellers = [];
    let rejectedSellerRows = 0;
    const rejectedSamples = [];
    for (const row of rows) {
      const values = row.map(clean);
      let [seller, item, amount, rankText] = indices.map((index) => values[index] || '');
      let rank = rankText.match(/^L([1-9]\d*)$/i);
      let totalPrice = price(amount);
      // GeM's responsive DataTable sometimes inserts an unlabelled control
      // cell into body rows only. Recover the stable financial fields from
      // their row order: Seller, Offered Item, Total Price, Rank.
      if (!seller || !item || !rank || totalPrice === null) {
        const rankEntries = values.map((value, index) => ({ value, index, match: value.match(/^L([1-9]\d*)$/i) })).filter((entry) => entry.match);
        const amountEntries = values.map((value, index) => ({ value, index, parsed: price(value) })).filter((entry) => entry.parsed !== null);
        if (rankEntries.length === 1) {
          const rankEntry = rankEntries[0];
          const amountEntry = amountEntries.filter((entry) => entry.index < rankEntry.index).at(-1);
          const preceding = amountEntry ? values.map((value, index) => ({ value, index })).filter((entry) => entry.index < amountEntry.index && entry.value) : [];
          if (amountEntry && preceding.length >= 2) {
            const itemEntry = preceding.at(-1);
            const sellerEntry = preceding.slice(0, -1).reverse().find((entry) => !/^\d+$/.test(entry.value));
            if (sellerEntry) {
              seller = sellerEntry.value;
              item = itemEntry.value;
              amount = amountEntry.value;
              rankText = rankEntry.value;
              rank = rankEntry.match;
              totalPrice = amountEntry.parsed;
            }
          }
        }
      }
      if (!seller || !item || !rank || totalPrice === null || !Number.isSafeInteger(Number(rank[1]))) {
        // GeM appends responsive header/footer/detail rows to the same table.
        // Ignore those, but fail if no complete seller row can be recovered.
        if (seller || item || amount || rankText) {
          rejectedSellerRows += 1;
          if (rejectedSamples.length < 2) rejectedSamples.push(values.slice(-4).map((value) => value.slice(0, 80)));
        }
        continue;
      }
      sellers.push({ sellerName: seller, offeredItem: item, totalPrice, currency: "INR", rank: Number(rank[1]) });
    }
    if (!sellers.length) return { status: "unreadable", reason: `No complete financial seller rows (${rejectedSellerRows} unsupported rows; row tails ${JSON.stringify(rejectedSamples)})`, sellers: [] };
    const aliases = new Set(companyNames.map(sellerKey).filter(Boolean));
    const matches = sellers.filter((seller) => aliases.has(sellerKey(seller.sellerName)));
    return {
      status: "read",
      sellers,
      // Keep every published tie. Prices and row order never determine rank.
      leaders: Object.fromEntries([1, 2, 3].map((rank) => [`L${rank}`, sellers.filter((seller) => seller.rank === rank)])),
      companyMatch: !aliases.size ? "unconfigured" : matches.length === 1 ? "matched" : matches.length ? "ambiguous" : "not_found",
      companyRank: matches.length === 1 ? matches[0].rank : null,
    };
  }

  function readDocument(doc, companyNames = COMPANY_NAMES) {
    const candidates = [];
    for (const table of doc.querySelectorAll('table, [role="table"], [role="grid"]')) {
      const rows = Array.from(table.rows || table.querySelectorAll('[role="row"]'));
      const cells = (row) => Array.from(row.cells || row.querySelectorAll('[role="columnheader"], [role="cell"], [role="gridcell"]'));
      const headerIndex = rows.findIndex((row) => {
        const values = cells(row).map((cell) => header(cell.innerText || cell.textContent));
        return [/^seller\s+name\b/, /^offered\s+item\b/, /^total\s+price\b/, /^(?:rank|awarded)\b/]
          .every((pattern) => values.some((value) => pattern.test(value)));
      });
      if (headerIndex < 0) continue;
      candidates.push(parseTable(
        cells(rows[headerIndex]).map((cell) => cell.innerText || cell.textContent),
        rows.slice(headerIndex + 1).map((row) => cells(row).map((cell) => cell.innerText || cell.textContent)).filter((row) => row.some((value) => clean(value))),
        companyNames,
      ));
    }
    if (candidates.length !== 1) {
      return { status: "unreadable", reason: candidates.length ? "Multiple financial tables require lot selection" : "Financial table not found", sellers: [] };
    }
    return candidates[0];
  }

  globalThis.AcxxelFinancialRanking = Object.freeze({ parseTable, readDocument });
})();
