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

function displayName(meal) {
  return meal?.name?.he?.trim() || meal?.name?.ar?.trim() || meal?.id || '—';
}

function levenshteinRatio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const dist = matrix[rows - 1][cols - 1];
  return 1 - dist / Math.max(a.length, b.length);
}

function nameSimilarity(importMeal, firebaseMeal) {
  const scores = [];
  const pairs = [
    [normText(importMeal?.name?.he), normText(firebaseMeal?.name?.he)],
    [normText(importMeal?.name?.ar), normText(firebaseMeal?.name?.ar)],
    [normText(importMeal?.name?.he), normText(firebaseMeal?.name?.ar)],
    [normText(importMeal?.name?.ar), normText(firebaseMeal?.name?.he)],
  ];
  for (const [a, b] of pairs) {
    if (a.length < 2 || b.length < 2) continue;
    if (a === b) scores.push(1);
    else if (a.includes(b) || b.includes(a)) scores.push(0.88);
    else scores.push(levenshteinRatio(a, b));
  }
  return scores.length ? Math.max(...scores) : 0;
}

export function importRowKey(categoryId, meal) {
  return `${categoryId}:${meal?.id || displayName(meal)}`;
}

/** Flat list of Firebase meals for pickers. */
export function listFirebaseMeals(firebaseData) {
  const categories = firebaseData?.categories || [];
  const catName = (id) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return id;
    return c.name?.he?.trim() || c.name?.ar?.trim() || id;
  };
  const out = [];
  for (const [categoryId, meals] of Object.entries(firebaseData?.items || {})) {
    if (!Array.isArray(meals)) continue;
    for (const meal of meals) {
      out.push({
        categoryId,
        mealId: meal.id,
        nameHe: meal?.name?.he?.trim() || '',
        nameAr: meal?.name?.ar?.trim() || '',
        categoryName: catName(categoryId),
        label: `${displayName(meal)} · ${catName(categoryId)}`,
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'he'));
}

export function getFirebaseCategoryOptions(firebaseData) {
  const cats = firebaseData?.categories || [];
  if (cats.length > 0) {
    return cats
      .filter((c) => !c.hidden)
      .map((c) => ({
        id: c.id,
        label: `${c.name?.he?.trim() || c.name?.ar?.trim() || c.id}`,
      }));
  }
  return Object.keys(firebaseData?.items || {}).map((id) => ({ id, label: id }));
}

export function suggestFirebaseMatches(importMeal, firebaseData, limit = 5) {
  const minScore = 0.55;
  const candidates = [];
  for (const fb of listFirebaseMeals(firebaseData)) {
    const meal = (firebaseData.items[fb.categoryId] || []).find((m) => m.id === fb.mealId);
    if (!meal) continue;
    const score = nameSimilarity(importMeal, meal);
    if (score >= minScore) {
      candidates.push({
        categoryId: fb.categoryId,
        mealId: fb.mealId,
        nameHe: fb.nameHe,
        nameAr: fb.nameAr,
        categoryName: fb.categoryName,
        label: fb.label,
        score,
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Default Firebase category for an import category (by id, then by name). */
export function resolveFirebaseCategoryId(importCategoryId, importData, firebaseData) {
  const items = firebaseData?.items || {};
  if (items[importCategoryId]) return importCategoryId;

  const importCat = (importData.categories || []).find((c) => c.id === importCategoryId);
  if (!importCat) return getFirebaseCategoryOptions(firebaseData)[0]?.id || importCategoryId;

  const he = normText(importCat.name?.he);
  const ar = normText(importCat.name?.ar);
  for (const fc of firebaseData.categories || []) {
    if (normText(fc.name?.he) === he || normText(fc.name?.ar) === ar) return fc.id;
  }
  return getFirebaseCategoryOptions(firebaseData)[0]?.id || importCategoryId;
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

function firebaseMealKey(categoryId, mealId) {
  return `${categoryId}:${mealId}`;
}

function findBestFirebaseMatch(importMeal, index, firebaseData, usedFirebase) {
  const id = importMeal?.id?.trim();
  if (id) {
    const hit = index.byId.get(id.toLowerCase());
    const key = hit ? firebaseMealKey(hit.categoryId, hit.meal.id) : '';
    if (hit && !usedFirebase.has(key)) {
      usedFirebase.add(key);
      return { ...hit, matchedBy: 'id' };
    }
  }

  for (const nk of nameKeys(importMeal)) {
    const hit = index.byName.get(nk);
    const key = hit ? firebaseMealKey(hit.categoryId, hit.meal.id) : '';
    if (hit && !usedFirebase.has(key)) {
      usedFirebase.add(key);
      return { ...hit, matchedBy: 'name' };
    }
  }

  const FUZZY_MIN = 0.82;
  let best = null;
  let bestScore = FUZZY_MIN;
  for (const fb of listFirebaseMeals(firebaseData)) {
    const key = firebaseMealKey(fb.categoryId, fb.mealId);
    if (usedFirebase.has(key)) continue;
    const meal = (firebaseData.items[fb.categoryId] || []).find((m) => m.id === fb.mealId);
    if (!meal) continue;
    const score = nameSimilarity(importMeal, meal);
    if (score >= bestScore) {
      bestScore = score;
      best = { categoryId: fb.categoryId, meal, matchedBy: 'fuzzy' };
    }
  }

  if (best) {
    usedFirebase.add(firebaseMealKey(best.categoryId, best.meal.id));
    return best;
  }

  return null;
}

function hasLocaleText(value) {
  return normText(value).length > 0;
}

/** Either side has text and they differ (Hebrew names, descriptions). */
function localeTextsDiffer(left, right) {
  const l = normText(left);
  const r = normText(right);
  if (!l && !r) return false;
  return l !== r;
}

/** Both sides have Arabic text and they differ (e.g. برجر vs برغر). */
function arTextsDiffer(left, right) {
  if (!hasLocaleText(left) || !hasLocaleText(right)) return false;
  return normText(left) !== normText(right);
}

function fieldValuesDiffer(field, importVal, firebaseVal) {
  if (field === 'price') return Number(importVal) !== Number(firebaseVal);
  if (field === 'image') return normImage(importVal) !== normImage(firebaseVal);
  if (field === 'nameHe' || field === 'descHe') return localeTextsDiffer(importVal, firebaseVal);
  if (field === 'nameAr') return arTextsDiffer(importVal, firebaseVal);
  if (field === 'descAr') return arTextsDiffer(importVal, firebaseVal);
  return normText(importVal) !== normText(firebaseVal);
}

function hasTextValue(field, value) {
  if (field === 'price') {
    const n = Number(value);
    return !Number.isNaN(n) && n > 0;
  }
  return hasLocaleText(value);
}

function shouldReportDiff(field, importVal, firebaseVal) {
  if (!hasTextValue(field, importVal)) return false;
  if (!hasTextValue(field, firebaseVal)) return true;
  return fieldValuesDiffer(field, importVal, firebaseVal);
}

function hasFirebaseValue(field, value) {
  return hasTextValue(field, value);
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
    field: 'nameHe',
    label: 'Name (HE) | שם (עברית)',
    getImport: (m) => m.name?.he,
    getFirebase: (m) => m.name?.he,
    apply: (meal, value) => ({
      ...meal,
      name: { ...(meal.name || {}), he: String(value).trim() },
    }),
  },
  {
    field: 'nameAr',
    label: 'Name (AR) | שם (ערבית)',
    getImport: (m) => m.name?.ar,
    getFirebase: (m) => m.name?.ar,
    apply: (meal, value) => ({
      ...meal,
      name: { ...(meal.name || {}), ar: String(value).trim() },
    }),
  },
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
  const usedFirebase = new Set();
  let matchedCount = 0;
  let inSyncCount = 0;

  for (const [importCategoryId, importMeals] of Object.entries(importData.items || {})) {
    if (!Array.isArray(importMeals)) continue;

    for (const importMeal of importMeals) {
      const match = findBestFirebaseMatch(importMeal, index, firebaseData, usedFirebase);
      const nameHe = importMeal?.name?.he?.trim() || '';
      const nameAr = importMeal?.name?.ar?.trim() || '';

      if (!match) {
        onlyInImport.push({
          rowKey: importRowKey(importCategoryId, importMeal),
          categoryId: importCategoryId,
          meal: importMeal,
          nameHe,
          nameAr,
          suggestions: suggestFirebaseMatches(importMeal, firebaseData),
        });
        continue;
      }

      matchedCount += 1;
      let mealHadDiff = false;

      for (const def of FIELD_DEFS) {
        const importVal = def.getImport(importMeal);
        const firebaseVal = def.getFirebase(match.meal);

        if (!shouldReportDiff(def.field, importVal, firebaseVal)) continue;

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

      if (!mealHadDiff) inSyncCount += 1;
    }
  }

  const nameDiffs = diffs.filter((d) => d.field === 'nameHe' || d.field === 'nameAr').length;

  return {
    diffs,
    onlyInImport,
    matchedCount,
    inSyncCount,
    nameDiffs,
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

/** Merge import meal fields onto an existing Firebase meal (map / link). */
export function applyImportMealOntoFirebase(firebaseMeal, importMeal) {
  const next = { ...firebaseMeal };
  const price = Number(importMeal.price);
  if (!Number.isNaN(price) && price > 0) next.price = price;
  if (importMeal.image?.trim()) next.image = importMeal.image.trim();
  if (importMeal.name?.he?.trim() || importMeal.name?.ar?.trim()) {
    next.name = {
      ...(next.name || {}),
      ...(importMeal.name?.he?.trim() ? { he: importMeal.name.he.trim() } : {}),
      ...(importMeal.name?.ar?.trim() ? { ar: importMeal.name.ar.trim() } : {}),
    };
  }
  if (importMeal.description?.he?.trim() || importMeal.description?.ar?.trim()) {
    next.description = {
      ...(next.description || {}),
      ...(importMeal.description?.he?.trim() ? { he: importMeal.description.he.trim() } : {}),
      ...(importMeal.description?.ar?.trim() ? { ar: importMeal.description.ar.trim() } : {}),
    };
  }
  if (Array.isArray(importMeal.options) && importMeal.options.length > 0) {
    next.options = importMeal.options;
  }
  return next;
}

/**
 * @param {Array<{ rowKey: string, mode: 'add', targetCategoryId: string } | { rowKey: string, mode: 'map', targetCategoryId: string, targetMealId: string }>} actions
 * @param {object} onlyInImportRows from compare result
 */
export function applyImportOnlyActions(firebaseItems, actions, onlyInImportRows) {
  const items = JSON.parse(JSON.stringify(firebaseItems || {}));
  const rowByKey = new Map(onlyInImportRows.map((r) => [r.rowKey, r]));

  for (const action of actions) {
    const row = rowByKey.get(action.rowKey);
    if (!row?.meal) continue;

    if (action.mode === 'map') {
      const list = items[action.targetCategoryId];
      if (!Array.isArray(list)) continue;
      const idx = list.findIndex((m) => m.id === action.targetMealId);
      if (idx === -1) continue;
      list[idx] = applyImportMealOntoFirebase(list[idx], row.meal);
      continue;
    }

    if (action.mode === 'add') {
      const catId = action.targetCategoryId;
      if (!Array.isArray(items[catId])) items[catId] = [];
      const mealId = row.meal.id?.trim() || `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const order = items[catId].length;
      const meal = {
        ...row.meal,
        id: mealId,
        order: row.meal.order ?? order,
        available: row.meal.available !== false,
        unavailable: row.meal.unavailable === true,
      };
      if (items[catId].some((m) => m.id === mealId)) continue;
      items[catId].push(meal);
    }
  }

  return items;
}
