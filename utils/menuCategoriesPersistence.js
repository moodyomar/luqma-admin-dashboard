/**
 * Category / subcategory writes — safe for production:
 * - Never touches meal name, price, options, images, etc.
 * - Only normalizes subcategory-shaped data and removes stale meal.subcategoryId when the sub no longer exists.
 */

/**
 * Ensures every category has a stable `subcategories` array and clean sub shapes for Firestore.
 */
export function normalizeMenuCategoriesForSave(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.map((cat, index) => {
    const raw = cat.subcategories;
    const subcategories = Array.isArray(raw)
      ? raw
          .filter((s) => s && s.id != null && String(s.id).trim() !== '')
          .map((s, i) => ({
            id: String(s.id).trim(),
            name: {
              ar: s.name?.ar != null ? String(s.name.ar) : '',
              he: s.name?.he != null ? String(s.name.he) : '',
            },
            order: typeof s.order === 'number' ? s.order : i,
          }))
      : [];
    return {
      ...cat,
      order: typeof cat.order === 'number' ? cat.order : index,
      subcategories,
    };
  });
}

/**
 * Removes meal.subcategoryId only when it is not in the category's subcategory list (including empty list).
 * Does not modify any other meal fields.
 * @returns {{ items: Record<string, Array>, touchedCategoryIds: Set<string> }}
 */
export function sanitizeItemsForSubcategoryIds(categories, items) {
  const nextItems = { ...items };
  const touchedCategoryIds = new Set();
  for (const cat of categories) {
    const allowed = new Set((cat.subcategories || []).map((s) => s.id));
    const list = nextItems[cat.id];
    if (!Array.isArray(list)) continue;
    let changed = false;
    const mapped = list.map((meal) => {
      const sid = meal.subcategoryId;
      if (sid == null || sid === '') return meal;
      if (allowed.has(sid)) return meal;
      changed = true;
      const { subcategoryId, ...rest } = meal;
      return rest;
    });
    if (changed) {
      nextItems[cat.id] = mapped;
      touchedCategoryIds.add(cat.id);
    }
  }
  return { items: nextItems, touchedCategoryIds };
}

/**
 * Single updateDoc payload: categories + only item arrays that changed after sanitization.
 */
export function buildMenuCategoryFirestorePayload(normalizedCategories, cleanedItems, touchedCategoryIds) {
  const payload = { categories: normalizedCategories };
  touchedCategoryIds.forEach((cid) => {
    payload[`items.${cid}`] = cleanedItems[cid];
  });
  return payload;
}
