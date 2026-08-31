/**
 * Size pricing helpers.
 *
 * A meal's sizes live in its first `select` option (same convention the menu app
 * and OptionsEditor use). Each value's `extra` is a delta added to `meal.price`,
 * so the price the customer actually pays for a size is `meal.price + extra`.
 */

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

/** Index of the option holding the meal's sizes, or -1 when the meal has none. */
export function findSizeOptionIndex(meal) {
  const options = Array.isArray(meal?.options) ? meal.options : [];
  return options.findIndex(
    (opt) => opt?.type === 'select' && Array.isArray(opt?.values) && opt.values.length > 0,
  );
}

export function getBasePrice(meal) {
  return toNumber(meal?.price);
}

/**
 * Absolute prices for a meal, base price first followed by one entry per size.
 * Meals without sizes return a single entry.
 */
export function getMealPriceEntries(meal) {
  const base = getBasePrice(meal);
  const sizeIndex = findSizeOptionIndex(meal);
  if (sizeIndex === -1) {
    return [{ key: 'base', label: '', price: base, isBase: true }];
  }

  const values = meal.options[sizeIndex].values;
  return values.map((val, idx) => ({
    key: val?.value || `size_${idx}`,
    label: val?.label?.ar || val?.label?.he || '',
    labelAr: val?.label?.ar || '',
    labelHe: val?.label?.he || '',
    price: base + toNumber(val?.extra),
    isBase: idx === 0,
    valueIndex: idx,
  }));
}

/** Header label, e.g. "35 • 45 • 55" (or just "35" when there are no sizes). */
export function formatMealPriceLabel(meal) {
  const prices = getMealPriceEntries(meal).map((entry) =>
    Number.isInteger(entry.price) ? String(entry.price) : entry.price.toFixed(2),
  );
  const unique = prices.filter((price, idx) => idx === 0 || price !== prices[idx - 1]);
  return unique.join(' • ');
}

/**
 * Rebuild a meal from absolute prices and size names: the base price is stored
 * as-is and every size keeps its own absolute price by storing the difference
 * from the new base.
 *
 * `sizeEdits` entries look like `{ price, labelAr, labelHe }`; omitted fields
 * keep their current value.
 */
export function applyMealPrices(meal, basePrice, sizeEdits = []) {
  const base = toNumber(basePrice);
  const updated = { ...meal, price: base };
  const sizeIndex = findSizeOptionIndex(meal);
  if (sizeIndex === -1 || sizeEdits.length === 0) return updated;

  const options = [...meal.options];
  const sizeOption = options[sizeIndex];
  options[sizeIndex] = {
    ...sizeOption,
    values: sizeOption.values.map((val, idx) => {
      const edit = sizeEdits[idx];
      if (!edit) return val;

      const next = { ...val };
      if (edit.price != null && edit.price !== '') {
        next.extra = toNumber(edit.price) - base;
      }
      if (edit.labelAr != null || edit.labelHe != null) {
        next.label = {
          ...val?.label,
          ar: edit.labelAr != null ? String(edit.labelAr).trim() : val?.label?.ar || '',
          he: edit.labelHe != null ? String(edit.labelHe).trim() : val?.label?.he || '',
        };
      }
      return next;
    }),
  };
  updated.options = options;
  return updated;
}
