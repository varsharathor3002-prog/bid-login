(() => {
  // Parsers for GeM Market pages (product search lists and product pages).
  // Product pages are server-rendered: the model is in itemprop="model" and
  // the specifications are td.feature_name rows. Pure functions, so the
  // service worker and the node tests share them.
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decode = (value) => String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] === '#') {
        const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();

  function parseListing(html) {
    const total = Number(html.match(/Showing\s+[\d\s-]+products\s+of\s+(\d+)\s+products/i)?.[1] || 0);
    const links = [...new Set(
      [...html.matchAll(/href="(\/[^"#?]*?\/p-\d+-\d+-cat\.html)/g)].map((match) => match[1]),
    )];
    return { total, links, hasNext: /class="next_page"/.test(html) };
  }

  const SPEC_ROW = /<td class="feature_name"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  const specRows = (html) => [...html.matchAll(SPEC_ROW)]
    .map((match) => [decode(match[1]), decode(match[2])])
    .filter(([label]) => label);

  // The page's own spec groups ("<h4> MEMORY </h4>" + table), in page order;
  // they differ per category and per product.
  function parseSections(html) {
    const start = html.indexOf('id="feature_groups"');
    if (start < 0) return [];
    return html.slice(start).split(/<h4[^>]*>/).slice(1)
      .map((chunk) => [decode(chunk.split(/<\/h4>/)[0]), specRows(chunk)])
      .filter(([title, rows]) => title && rows.length);
  }

  function parseProduct(html) {
    return {
      model_no: decode(html.match(/itemprop="model"[^>]*>([^<]+)</)?.[1]),
      brand: decode(html.match(/class="brand-name">([^<]+)</)?.[1]),
      title: decode(html.match(/itemprop=['"]name['"][^>]*>([^<]+)</)?.[1]),
      pairs: specRows(html),
      sections: parseSections(html),
    };
  }

  async function fetchText(url) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error(`GeM returned ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
        await sleep(1500 * attempt);
      }
    }
    throw new Error(`${lastError.message} for ${url}`);
  }

  globalThis.AcxxelGemProduct = { parseListing, parseProduct, fetchText };
})();
