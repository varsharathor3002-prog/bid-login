export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export const rateKey = (category, name) => `${category}::${name}`;

export const ratesToMap = (rates = []) =>
  Object.fromEntries(rates.map((rate) => [rateKey(rate.category, rate.name), Number(rate.price)]));

export async function fetchComponentRates(product) {
  const response = await fetch(`${API_BASE}/component-rates/?product=${encodeURIComponent(product)}`);
  if (!response.ok) throw new Error("Component rates could not be loaded.");
  return (await response.json()).rates || [];
}

export const effectivePrice = (overrides, category, option) => {
  const overridden = overrides[rateKey(category, option.name)];
  return overridden === undefined ? option.price : overridden;
};

export function applyRatesToCatalog(categories, rates = []) {
  const overrides = ratesToMap(rates);
  categories.forEach(([category, items]) => items.forEach((item) => {
    if (!("_catalogPrice" in item)) {
      Object.defineProperty(item, "_catalogPrice", { value: item.price, enumerable: false });
    }
    const changed = overrides[rateKey(category, item.name)];
    item.price = changed === undefined ? item._catalogPrice : changed;
  }));
}