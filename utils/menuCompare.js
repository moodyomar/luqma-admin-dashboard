/**
 * Compare digital-menu / app export JSON with the live Firebase menu document.
 * Suggests applying import values (price, image, descriptions) onto Firebase.
 */

function normText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normImage(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const parts = u.pathname.split('/').filter(Boolean);
    return (parts[parts.length - 1] || s).toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

function nameKeys(meal) {
  const keys = [];
  const he = normText(meal?.name?.he);
  const ar = normText(meal?.name?.ar);
  if (he.length >= 2) keys.push(`he:${he}`);
  if (ar.length >= 2) keys.push(`ar:${ar}`);
  return keys;
}

export function parseMenuImportJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object');
  }
  if (!parsed.items || typeof parsed.items !== 'object') {
    throw new Error('JSON must include an "items" object');
  }
  return parsed;
}

function indexFirebaseItems(items) {
  const byId = new Map();
  const byName = new Map();

  for (const [categoryId, meals] of Object.entries(items || {})) {
    if (!Array.isArray(meals)) continue;
    for (const meal of meals) {
      const entry = { categoryId, meal };
      const id = meal?.id?.trim();
      if (id) byId.set(id.toLowerCase(), entry);
      for (const nk of nameKeys(meal)) {
        if (!byName.has(nk)) byName.set(nk, entry);
      }
    }
  }

  return { byId, byName };
}

function findFirebaseMatch(importMeal, index) {
  const id = importMeal?.id?.trim();
  if (id) {
    const hit = index.byId.get(id.toLowerCase());
    if (hit) return { ...hit, matchedBy: 'id' };
  }
  for (const nk of nameKeys(importMeal)) {
    const hit = index.byName.get(nk);
    if (hit) return { ...hit, matchedBy: 'name' };
  }
  return null;
}

function hasImportValue(field, value) {
  if (field === 'price') {
    const n = Number(value);
    return !Number.isNaN(n) && n > 0;
  }
  return normText(value).length > 0;
}

function hasFirebaseValue(field, value) {
  if (field === 'price') {
    const n = Number(value);
    return !Number.isNaN(n) && n > 0;
  }
  if (field === 'image') return normImage(value).length > 0;
  return normText(value).length > 0;
}

function valuesDiffer(field, importVal, firebaseVal) {
  if (field === 'price') return Number(importVal) !== Number(firebaseVal);
  if (field === 'image') return normImage(importVal) !== normImage(firebaseVal);
  return normText(importVal) !== normText(firebaseVal);
}

function formatDisplay(field, value) {
  if (field === 'price') {
    const n = Number(value);
    return n > 0 ? `₪${n}` : '—';
  }
  if (field === 'image') {
    const s = String(value ?? '').trim();
    if (!s) return '—';
    return normImage(s) || s.slice(0, 60);
  }
  const t = String(value ?? '').trim();
  return t || '—';
}

const FIELD_DEFS = [
  {
    field: 'price',
    label: 'Price | السعر',
    getImport: (m) => m.price,
    getFirebase: (m) => m.price,
    apply: (meal, value) => ({ ...meal, price: Number(value) }),
  },
  {
    field: 'image',
    label: 'Image | الصورة',
    getImport: (m) => m.image,
    getFirebase: (m) => m.image,
    apply: (meal, value) => ({ ...meal, image: String(value).trim() }),
  },
  {
    field: 'descHe',
    label: 'Description (HE) | الوصف (عبري)',
    getImport: (m) => m.description?.he,
    getFirebase: (m) => m.description?.he,
    apply: (meal, value) => ({
      ...meal,
      description: { ...(meal.description || {}), he: String(value).trim() },
    }),
  },
  {
    field: 'descAr',
    label: 'Description (AR) | الوصف (عربي)',
    getImport: (m) => m.description?.ar,
    getFirebase: (m) => m.description?.ar,
    apply: (meal, value) => ({
      ...meal,
      description: { ...(meal.description || {}), ar: String(value).trim() },
    }),
  },
];

/**
 * @returns {{
 *   diffs: Array<{
 *     patchId: string;
 *     categoryId: string;
 *     mealId: string;
 *     mealNameHe: string;
 *     mealNameAr: string;
 *     field: string;
 *     fieldLabel: string;
 *     kind: 'missing' | 'different';
 *     importValue: unknown;
 *     firebaseValue: unknown;
 *     importDisplay: string;
 *     firebaseDisplay: string;
 *     matchedBy: string;
 *   }>;
 *   onlyInImport: Array<{ categoryId: string; meal: object; nameHe: string; nameAr: string }>;
 *   matchedCount: number;
 *   inSyncCount: number;
 * }}
 */
export function compareMenuWithImport(firebaseData, importData) {
  const index = indexFirebaseItems(firebaseData?.items);
  const diffs = [];
  const onlyInImport = [];
  const matchedFirebaseKeys = new Set();
  let matchedCount = 0;
  let inSyncCount = 0;

  for (const [importCategoryId, importMeals] of Object.entries(importData.items || {})) {
    if (!Array.isArray(importMeals)) continue;

    for (const importMeal of importMeals) {
      const match = findFirebaseMatch(importMeal, index);
      const nameHe = importMeal?.name?.he?.trim() || '';
      const nameAr = importMeal?.name?.ar?.trim() || '';

      if (!match) {
        onlyInImport.push({
          categoryId: importCategoryId,
          meal: importMeal,
          nameHe,
          nameAr,
        });
        continue;
      }

      matchedCount += 1;
      matchedFirebaseKeys.add(`${match.categoryId}:${match.meal.id}`);
      let mealHadDiff = false;

      for (const def of FIELD_DEFS) {
        const importVal = def.getImport(importMeal);
        const firebaseVal = def.getFirebase(match.meal);

        if (!hasImportValue(def.field, importVal)) continue;
        if (
          !hasFirebaseValue(def.field, firebaseVal) ||
          valuesDiffer(def.field, importVal, firebaseVal)
        ) {
          mealHadDiff = true;
          diffs.push({
            patchId: `${match.categoryId}:${match.meal.id}:${def.field}`,
            categoryId: match.categoryId,
            mealId: match.meal.id,
            mealNameHe: nameHe || match.meal?.name?.he || '',
            mealNameAr: nameAr || match.meal?.name?.ar || '',
            field: def.field,
            fieldLabel: def.label,
            kind: hasFirebaseValue(def.field, firebaseVal) ? 'different' : 'missing',
            importValue: importVal,
            firebaseValue: firebaseVal,
            importDisplay: formatDisplay(def.field, importVal),
            firebaseDisplay: formatDisplay(def.field, firebaseVal),
            matchedBy: match.matchedBy,
          });
        }
      }

      if (!mealHadDiff) inSyncCount += 1;
    }
  }

  return {
    diffs,
    onlyInImport,
    matchedCount,
    inSyncCount,
  };
}

/** Apply selected patches onto a deep-cloned items map. */
export function applyMenuPatches(firebaseItems, selectedDiffs) {
  const items = JSON.parse(JSON.stringify(firebaseItems || {}));

  for (const diff of selectedDiffs) {
    const def = FIELD_DEFS.find((d) => d.field === diff.field);
    if (!def) continue;

    const list = items[diff.categoryId];
    if (!Array.isArray(list)) continue;

    const idx = list.findIndex((m) => m.id === diff.mealId);
    if (idx === -1) continue;

    list[idx] = def.apply(list[idx], diff.importValue);
  }

  return items;
}

export function countImportMeals(importData) {
  return Object.values(importData?.items || {}).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0,
  );
}
