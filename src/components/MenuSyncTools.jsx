import { useRef, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FiCopy, FiUpload, FiGitMerge, FiCheck } from 'react-icons/fi';
import { copyMenuJsonToClipboard } from '../../utils/exportMenuJson';
import {
  parseMenuImportJson,
  compareMenuWithImport,
  applyMenuPatches,
  applyImportOnlyActions,
  countImportMeals,
  getFirebaseCategoryOptions,
  listFirebaseMeals,
  resolveFirebaseCategoryId,
} from '../../utils/menuCompare';

const sectionStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e9ecef',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '20px',
};

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  background: '#007AFF',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
};

const btnSecondary = {
  ...btnPrimary,
  background: '#fff',
  color: '#007AFF',
  border: '1px solid #007AFF',
};

export default function MenuSyncTools() {
  const { activeBusinessId } = useAuth();
  const fileRef = useRef(null);

  const [copying, setCopying] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [comparing, setComparing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [firebaseSnapshot, setFirebaseSnapshot] = useState(null);
  const [importDataSnapshot, setImportDataSnapshot] = useState(null);
  /** @type {[Record<string, { mode: 'skip'|'add'|'map', targetCategoryId: string, targetMealId?: string }>, Function]} */
  const [importOnlyPlans, setImportOnlyPlans] = useState({});

  const handleCopy = async () => {
    if (!activeBusinessId) return;
    setCopying(true);
    try {
      const snap = await getDoc(doc(db, 'menus', activeBusinessId));
      if (!snap.exists()) {
        toast.error('لا يوجد منيو | אין תפריט');
        return;
      }
      await copyMenuJsonToClipboard(snap.data());
      toast.success('تم نسخ المنيو | התפריט הועתק');
    } catch (err) {
      console.error('[MenuSyncTools] copy failed:', err);
      toast.error('فشل النسخ | ההעתקה נכשלה');
    } finally {
      setCopying(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportJson(String(reader.result || ''));
      setCompareResult(null);
      setSelected(new Set());
      setImportOnlyPlans({});
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCompare = async () => {
    if (!activeBusinessId) return;
    if (!importJson.trim()) {
      toast.error('الصق أو ارفع JSON للقائمة الرقمية');
      return;
    }

    setComparing(true);
    setCompareResult(null);
    setSelected(new Set());
    setImportOnlyPlans({});

    try {
      const importData = parseMenuImportJson(importJson);
      const snap = await getDoc(doc(db, 'menus', activeBusinessId));
      if (!snap.exists()) {
        toast.error('لا يوجد منيو في Firebase');
        return;
      }
      const firebaseData = snap.data();
      setFirebaseSnapshot(firebaseData);
      setImportDataSnapshot(importData);

      const result = compareMenuWithImport(firebaseData, importData);
      setCompareResult(result);
      setSelected(new Set(result.diffs.map((d) => d.patchId)));

      const initialPlans = {};
      for (const row of result.onlyInImport) {
        const defaultCat = resolveFirebaseCategoryId(row.categoryId, importData, firebaseData);
        const top = row.suggestions?.[0];
        initialPlans[row.rowKey] = top
          ? {
              mode: 'map',
              targetCategoryId: top.categoryId,
              targetMealId: top.mealId,
            }
          : {
              mode: 'add',
              targetCategoryId: defaultCat,
            };
      }
      setImportOnlyPlans(initialPlans);

      const importCount = countImportMeals(importData);
      if (result.diffs.length === 0) {
        toast.success(
          `لا فروقات في الحقول المقارنة (${result.inSyncCount} وجبة متطابقة من ${importCount})`,
        );
      } else {
        toast(
          `${result.diffs.length} فرق(فروق) — ${result.onlyInImport.length} وجبة غير موجودة في Firebase`,
          { icon: 'ℹ️' },
        );
      }
    } catch (err) {
      console.error('[MenuSyncTools] compare failed:', err);
      toast.error(err.message || 'فشلت المقارنة');
    } finally {
      setComparing(false);
    }
  };

  const togglePatch = (patchId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(patchId)) next.delete(patchId);
      else next.add(patchId);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (!compareResult) return;
    setSelected(
      checked ? new Set(compareResult.diffs.map((d) => d.patchId)) : new Set(),
    );
  };

  const handleApply = async () => {
    if (!activeBusinessId || !compareResult || !firebaseSnapshot) return;
    const patches = compareResult.diffs.filter((d) => selected.has(d.patchId));
    if (patches.length === 0) {
      toast.error('اختر حقولاً واحدة على الأقل');
      return;
    }

    if (
      !confirm(
        `تطبيق ${patches.length} تغيير(ات) على Firebase؟\nسيتم استبدال القيم المحددة بقيم ملف الاستيراد.`,
      )
    ) {
      return;
    }

    setApplying(true);
    try {
      const updatedItems = applyMenuPatches(firebaseSnapshot.items, patches);
      await updateDoc(doc(db, 'menus', activeBusinessId), { items: updatedItems });
      toast.success(`تم التحديث: ${patches.length} حقل | עודכנו ${patches.length} שדות`);

      const importData = importDataSnapshot || parseMenuImportJson(importJson);
      const fresh = { ...firebaseSnapshot, items: updatedItems };
      setFirebaseSnapshot(fresh);
      refreshCompare(fresh, importData);
    } catch (err) {
      console.error('[MenuSyncTools] apply failed:', err);
      toast.error('فشل الحفظ: ' + (err.message || 'Unknown'));
    } finally {
      setApplying(false);
    }
  };

  const refreshCompare = (firebaseData, importData) => {
    const result = compareMenuWithImport(firebaseData, importData);
    setCompareResult(result);
    setSelected(new Set(result.diffs.map((d) => d.patchId)));
    const initialPlans = {};
    for (const row of result.onlyInImport) {
      const defaultCat = resolveFirebaseCategoryId(row.categoryId, importData, firebaseData);
      const top = row.suggestions?.[0];
      initialPlans[row.rowKey] = top
        ? { mode: 'map', targetCategoryId: top.categoryId, targetMealId: top.mealId }
        : { mode: 'add', targetCategoryId: defaultCat };
    }
    setImportOnlyPlans(initialPlans);
  };

  const setPlan = (rowKey, patch) => {
    setImportOnlyPlans((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], ...patch },
    }));
  };

  const handleApplyImportOnly = async () => {
    if (!activeBusinessId || !compareResult || !firebaseSnapshot) return;

    const actions = compareResult.onlyInImport
      .map((row) => {
        const plan = importOnlyPlans[row.rowKey];
        if (!plan || plan.mode === 'skip') return null;
        if (plan.mode === 'map' && plan.targetCategoryId && plan.targetMealId) {
          return {
            rowKey: row.rowKey,
            mode: 'map',
            targetCategoryId: plan.targetCategoryId,
            targetMealId: plan.targetMealId,
          };
        }
        if (plan.mode === 'add' && plan.targetCategoryId) {
          return { rowKey: row.rowKey, mode: 'add', targetCategoryId: plan.targetCategoryId };
        }
        return null;
      })
      .filter(Boolean);

    if (actions.length === 0) {
      toast.error('اختر إضافة أو ربط لوجبة واحدة على الأقل');
      return;
    }

    const addCount = actions.filter((a) => a.mode === 'add').length;
    const mapCount = actions.filter((a) => a.mode === 'map').length;
    if (
      !confirm(
        `تطبيق على Firebase؟\nإضافة: ${addCount}\nربط وتحديث: ${mapCount}`,
      )
    ) {
      return;
    }

    setApplying(true);
    try {
      const updatedItems = applyImportOnlyActions(
        firebaseSnapshot.items,
        actions,
        compareResult.onlyInImport,
      );
      await updateDoc(doc(db, 'menus', activeBusinessId), { items: updatedItems });
      toast.success(`تم: ${addCount} إضافة، ${mapCount} ربط`);

      const importData = importDataSnapshot || parseMenuImportJson(importJson);
      const fresh = { ...firebaseSnapshot, items: updatedItems };
      setFirebaseSnapshot(fresh);
      refreshCompare(fresh, importData);
    } catch (err) {
      console.error('[MenuSyncTools] import-only apply failed:', err);
      toast.error('فشل الحفظ: ' + (err.message || 'Unknown'));
    } finally {
      setApplying(false);
    }
  };

  const firebaseMealOptions = firebaseSnapshot ? listFirebaseMeals(firebaseSnapshot) : [];
  const categoryOptions = firebaseSnapshot ? getFirebaseCategoryOptions(firebaseSnapshot) : [];
  const importOnlyActionCount = compareResult
    ? compareResult.onlyInImport.filter((row) => {
        const p = importOnlyPlans[row.rowKey];
        return p && p.mode !== 'skip' && (p.mode === 'add' || (p.mode === 'map' && p.targetMealId));
      }).length
    : 0;

  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FiGitMerge size={18} /> مزامنة القائمة | Menu sync
      </h2>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
        انسخ منيو Firebase كـ JSON، أو قارن تصدير القائمة الرقمية (مثل bunelo-export.json) مع التطبيق —
        الأسعار، الصور، والأوصاف. ثم طبّق ما تختاره على Firebase.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <button type="button" onClick={handleCopy} disabled={copying || !activeBusinessId} style={btnSecondary}>
          <FiCopy size={16} />
          {copying ? 'جاري النسخ…' : 'نسخ JSON من Firebase'}
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#555' }}>
          JSON القائمة الرقمية / التصدير
        </label>
        <textarea
          value={importJson}
          onChange={(e) => {
            setImportJson(e.target.value);
            setCompareResult(null);
            setImportOnlyPlans({});
          }}
          placeholder='الصق ملف التصدير (categories + items)…'
          dir="ltr"
          style={{
            width: '100%',
            minHeight: '140px',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '10px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleFile} />
        <button type="button" onClick={() => fileRef.current?.click()} style={btnSecondary}>
          <FiUpload size={16} /> رفع ملف JSON
        </button>
        <button
          type="button"
          onClick={handleCompare}
          disabled={comparing || !importJson.trim() || !activeBusinessId}
          style={btnPrimary}
        >
          <FiGitMerge size={16} />
          {comparing ? 'جاري المقارنة…' : 'مقارنة مع Firebase'}
        </button>
      </div>

      {compareResult && (
        <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
            <span style={{ background: '#fff3cd', padding: '4px 10px', borderRadius: '6px' }}>
              {compareResult.diffs.length} فرق
            </span>
            {(compareResult.nameDiffs ?? 0) > 0 && (
              <span style={{ background: '#e8daef', padding: '4px 10px', borderRadius: '6px' }}>
                {compareResult.nameDiffs} فرق أسماء
              </span>
            )}
            <span style={{ background: '#d4edda', padding: '4px 10px', borderRadius: '6px' }}>
              {compareResult.inSyncCount} متطابق
            </span>
            {compareResult.onlyInImport.length > 0 && (
              <span style={{ background: '#f8d7da', padding: '4px 10px', borderRadius: '6px' }}>
                {compareResult.onlyInImport.length} غير موجود في Firebase
              </span>
            )}
          </div>

          {compareResult.diffs.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selected.size === compareResult.diffs.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  تحديد الكل
                </label>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying || selected.size === 0}
                  style={{ ...btnPrimary, background: applying ? '#999' : '#28a745' }}
                >
                  <FiCheck size={16} />
                  {applying ? 'جاري التطبيق…' : `تطبيق المحدد على Firebase (${selected.size})`}
                </button>
              </div>

              <div style={{ maxHeight: '420px', overflow: 'auto', border: '1px solid #e9ecef', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px', width: 32 }} />
                      <th style={{ padding: '8px', textAlign: 'start' }}>الوجبة</th>
                      <th style={{ padding: '8px', textAlign: 'start' }}>الحقل</th>
                      <th style={{ padding: '8px', textAlign: 'start' }}>Firebase</th>
                      <th style={{ padding: '8px', textAlign: 'start' }}>الاستيراد ←</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResult.diffs.map((d) => (
                      <tr key={d.patchId} style={{ borderTop: '1px solid #eee' }}>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <input
                            type="checkbox"
                            checked={selected.has(d.patchId)}
                            onChange={() => togglePatch(d.patchId)}
                          />
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{d.mealNameHe || d.mealNameAr}</div>
                          {d.mealNameAr && d.mealNameHe !== d.mealNameAr && (
                            <div style={{ color: '#666', fontSize: '11px' }}>{d.mealNameAr}</div>
                          )}
                          <div style={{ fontSize: '10px', color: '#999' }}>
                            {d.kind === 'missing' ? 'ناقص في Firebase' : 'مختلف'}
                            {d.matchedBy === 'id'
                              ? ' · نفس المعرّف'
                              : d.matchedBy === 'name'
                                ? ' · مطابقة بالاسم'
                                : d.matchedBy === 'fuzzy'
                                  ? ' · مطابقة تقريبية'
                                  : ''}
                          </div>
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top' }}>{d.fieldLabel}</td>
                        <td style={{ padding: '8px', verticalAlign: 'top', color: '#c0392b', maxWidth: 160, wordBreak: 'break-word' }}>
                          {d.firebaseDisplay}
                        </td>
                        <td style={{ padding: '8px', verticalAlign: 'top', color: '#27ae60', maxWidth: 160, wordBreak: 'break-word' }}>
                          {d.importDisplay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {compareResult.onlyInImport.length > 0 && (
            <section style={{ marginTop: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  وجبات في الاستيراد فقط ({compareResult.onlyInImport.length})
                </h3>
                <button
                  type="button"
                  onClick={handleApplyImportOnly}
                  disabled={applying || importOnlyActionCount === 0}
                  style={{ ...btnPrimary, background: applying ? '#999' : '#6f42c1' }}
                >
                  <FiCheck size={16} />
                  {applying ? 'جاري التطبيق…' : `إضافة / ربط (${importOnlyActionCount})`}
                </button>
              </div>
              <p style={{ color: '#666', margin: '0 0 12px', lineHeight: 1.5 }}>
                قد تكون نفس الوجبة في التطبيق باسم مختلف أو ID مختلف. اختر <strong>ربط</strong> لتحديث وجبة موجودة، أو <strong>إضافة</strong> كوجبة جديدة في Firebase.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflow: 'auto' }}>
                {compareResult.onlyInImport.map((row) => {
                  const plan = importOnlyPlans[row.rowKey] || { mode: 'skip', targetCategoryId: '' };
                  return (
                    <div
                      key={row.rowKey}
                      style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '12px',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        {row.nameHe || row.nameAr}
                      </div>
                      {row.nameAr && row.nameHe !== row.nameAr && (
                        <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>{row.nameAr}</div>
                      )}
                      {row.meal?.id && (
                        <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace', marginBottom: '8px' }}>
                          {row.meal.id}
                        </div>
                      )}

                      {row.suggestions?.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#555' }}>اقتراحات ربط: </span>
                          {row.suggestions.map((s) => (
                            <button
                              key={`${s.categoryId}-${s.mealId}`}
                              type="button"
                              onClick={() =>
                                setPlan(row.rowKey, {
                                  mode: 'map',
                                  targetCategoryId: s.categoryId,
                                  targetMealId: s.mealId,
                                })
                              }
                              style={{
                                margin: '4px 4px 0 0',
                                padding: '4px 8px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: '1px solid #007AFF',
                                background:
                                  plan.mode === 'map' && plan.targetMealId === s.mealId
                                    ? '#007AFF'
                                    : '#fff',
                                color:
                                  plan.mode === 'map' && plan.targetMealId === s.mealId
                                    ? '#fff'
                                    : '#007AFF',
                                cursor: 'pointer',
                              }}
                            >
                              {s.nameHe || s.nameAr} ({Math.round(s.score * 100)}%)
                            </button>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                          إجراء
                          <select
                            value={plan.mode}
                            onChange={(e) => {
                              const mode = e.target.value;
                              if (mode === 'add') {
                                setPlan(row.rowKey, {
                                  mode: 'add',
                                  targetCategoryId:
                                    plan.targetCategoryId ||
                                    resolveFirebaseCategoryId(
                                      row.categoryId,
                                      importDataSnapshot,
                                      firebaseSnapshot,
                                    ),
                                  targetMealId: undefined,
                                });
                              } else if (mode === 'map') {
                                const fb = row.suggestions?.[0] || firebaseMealOptions[0];
                                setPlan(row.rowKey, {
                                  mode: 'map',
                                  targetCategoryId: fb?.categoryId || '',
                                  targetMealId: fb?.mealId || '',
                                });
                              } else {
                                setPlan(row.rowKey, { mode: 'skip' });
                              }
                            }}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #dee2e6', minWidth: '140px' }}
                          >
                            <option value="skip">تخطي</option>
                            <option value="map">ربط بوجبة موجودة</option>
                            <option value="add">إضافة جديدة</option>
                          </select>
                        </label>

                        {plan.mode === 'add' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', flex: 1, minWidth: '160px' }}>
                            القسم في Firebase
                            <select
                              value={plan.targetCategoryId || ''}
                              onChange={(e) => setPlan(row.rowKey, { targetCategoryId: e.target.value })}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #dee2e6' }}
                            >
                              {categoryOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {plan.mode === 'map' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', flex: 1, minWidth: '200px' }}>
                            الوجبة في Firebase
                            <select
                              value={plan.targetMealId ? `${plan.targetCategoryId}:${plan.targetMealId}` : ''}
                              onChange={(e) => {
                                const [categoryId, mealId] = e.target.value.split(':');
                                setPlan(row.rowKey, { targetCategoryId: categoryId, targetMealId: mealId });
                              }}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #dee2e6' }}
                            >
                              <option value="">— اختر —</option>
                              {firebaseMealOptions.map((m) => (
                                <option key={`${m.categoryId}:${m.mealId}`} value={`${m.categoryId}:${m.mealId}`}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
