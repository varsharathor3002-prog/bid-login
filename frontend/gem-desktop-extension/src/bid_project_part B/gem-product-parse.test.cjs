const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./gem-product-parse.js');

const { parseListing, parseProduct } = globalThis.AcxxelGemProduct;

// Snippets copied from mkp.gem.gov.in pages (October 2026).
const LISTING = `
  Showing 1 - 12 products of 142 products <span class='bn-breadcrumbs'>
  <a href="/entry-mid-level-desktop-computer/acl-1082-ds-2025-3040/p-5116877-7271624685-cat.html#variant_id=5116877-7271624685">x</a>
  <a href="/entry-mid-level-desktop-computer/acl-1082-ds-2025-3040/p-5116877-7271624685-cat.html#variant_id=5116877-7271624685"><img></a>
  <a href="/entry-mid-level-desktop-computer/acxxel-desktop-acl-1077ds-25de-s3421/p-5116877-40739025530-cat.html#variant_id=5116877-40739025530">y</a>
  <a class="next_page" rel="next" href="/computers-entry-level-computer-cpu/search?page=2">Next &#8594;</a>`;

const PRODUCT = `
  <h1 class="like-h3" itemprop='name'>
          acxxel Entry Level Desktop Computer with Warranty 3 Year
          <div class='brand'>
  <span class="brand-name">acxxel<sup>R</sup></span>
  <span itemprop="model" style="display:none;">ACL-1077DS-25DE-S3421</span>
  <tr>
    <td class="feature_name" width="150">Graphic Card Make and Model  - Must declare</td>
    <td>Integrated </td>
  </tr>
  <tr>
    <td class="feature_name" width="150">Screen Size (in CMs)</td>
    <td>48.26 - 53 (19.0&quot; - 20.87&quot;)</td>
  </tr>`;

test('reads total, unique product links and next page from a listing', () => {
  const listing = parseListing(LISTING);
  assert.equal(listing.total, 142);
  assert.deepEqual(listing.links, [
    '/entry-mid-level-desktop-computer/acl-1082-ds-2025-3040/p-5116877-7271624685-cat.html',
    '/entry-mid-level-desktop-computer/acxxel-desktop-acl-1077ds-25de-s3421/p-5116877-40739025530-cat.html',
  ]);
  assert.equal(listing.hasNext, true);
  assert.equal(parseListing(LISTING.replace('class="next_page"', '')).hasNext, false);
});

test('reads model, brand and decoded specification rows from a product page', () => {
  const product = parseProduct(PRODUCT);
  assert.equal(product.model_no, 'ACL-1077DS-25DE-S3421');
  assert.equal(product.brand, 'acxxel');
  assert.equal(product.title, 'acxxel Entry Level Desktop Computer with Warranty 3 Year');
  assert.deepEqual(product.pairs, [
    ['Graphic Card Make and Model - Must declare', 'Integrated'],
    ['Screen Size (in CMs)', '48.26 - 53 (19.0" - 20.87")'],
  ]);
});

test('reads the product image in GeM largest size', () => {
  const html = '<meta property="og:image" content="https://assets-mkpbg.gem.gov.in/img/othe/5770552/cc/a1/wired1.png.c64bddcca1.999x200x200.jpg"/>';
  assert.equal(parseProduct(html).image, 'https://assets-mkpbg.gem.gov.in/img/othe/5770552/cc/a1/wired1.png.c64bddcca1.999x420x420.jpg');
  assert.equal(parseProduct('<meta property="og:image" content="https://evil.example/x.jpg"/>').image, '');
});
