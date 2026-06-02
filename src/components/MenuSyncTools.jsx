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
  countImportMeals,
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

    try {
      const importData = parseMenuImportJson(importJson);
      const snap = await getDoc(doc(db, 'menus', activeBusinessId));
      if (!snap.exists()) {
        toast.error('لا يوجد منيو في Firebase');
        return;
      }
      const firebaseData = snap.data();
      setFirebaseSnapshot(firebaseData);

      const result = compareMenuWithImport(firebaseData, importData);
      setCompareResult(result);
      setSelected(new Set(result.diffs.map((d) => d.patchId)));

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

      const importData = parseMenuImportJson(importJson);
      const fresh = { ...firebaseSnapshot, items: updatedItems };
      setFirebaseSnapshot(fresh);
      const result = compareMenuWithImport(fresh, importData);
      setCompareResult(result);
      setSelected(new Set(result.diffs.map((d) => d.patchId)));
    } catch (err) {
      console.error('[MenuSyncTools] apply failed:', err);
      toast.error('فشل الحفظ: ' + (err.message || 'Unknown'));
    } finally {
      setApplying(false);
    }
  };

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
                            {d.matchedBy === 'name' ? ' · مطابقة بالاسم' : ''}
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
            <details style={{ marginTop: '16px', fontSize: '13px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                وجبات في الاستيراد فقط ({compareResult.onlyInImport.length})
              </summary>
              <ul style={{ marginTop: '8px', paddingInlineStart: '20px', color: '#555' }}>
                {compareResult.onlyInImport.slice(0, 40).map((row, i) => (
                  <li key={`${row.categoryId}-${row.meal?.id || i}`}>
                    {row.nameHe || row.nameAr}
                    {row.meal?.id ? ` (${row.meal.id})` : ''}
                  </li>
                ))}
                {compareResult.onlyInImport.length > 40 && (
                  <li>…و {compareResult.onlyInImport.length - 40} أخرى</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
