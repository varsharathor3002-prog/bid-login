// Value for a price input: an unset price (blank, 0, "0.00") shows as empty
// so the field's "Price" placeholder is visible instead of a 0.
export function priceInputValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (text === "" || (!Number.isNaN(Number(text)) && Number(text) === 0)) return "";
  return value;
}
