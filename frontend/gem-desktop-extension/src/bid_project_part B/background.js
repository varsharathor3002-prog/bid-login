// Keep the original service worker intact; both controllers register separately.
importScripts('../background.js', 'financial-ranking-sync.js', 'gem-product-parse.js', 'gem-product-scan.js');
