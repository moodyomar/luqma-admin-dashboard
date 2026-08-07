import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export const DEFAULT_LUCKY_WHEEL = {
  enabled: false,
  spinCostPoints: 10,
  cooldownHours: 24,
  prizeExpiryDays: 14,
  segments: [
    { id: 'seg_none', type: 'none', weight: 40, label: { ar: 'حاول مرة أخرى', he: 'נסה שוב' } },
    { id: 'seg_points', type: 'points', weight: 30, points: 5, label: { ar: '+5 نقاط', he: '+5 נקודות' } },
  ],
};

const SEGMENT_TYPES = [
  { value: 'none', label: 'נסה שוב', emoji: '🙂' },
  { value: 'points', label: 'נקודות', emoji: '⭐' },
  { value: 'percent_off', label: 'הנחה %', emoji: '%' },
  { value: 'fixed_off', label: 'הנחה ₪', emoji: '₪' },
  { value: 'free_item', label: 'מוצר חינם', emoji: '🎁' },
];

const CHANCE_PRESETS = [
  { key: 'rare', label: 'נדיר', weight: 5 },
  { key: 'normal', label: 'רגיל', weight: 15 },
  { key: 'common', label: 'נפוץ', weight: 30 },
];

function chancePresetForWeight(weight) {
  const w = Number(weight) || 0;
  if (w <= 8) return 'rare';
  if (w <= 22) return 'normal';
  return 'common';
}

function defaultLabelsForType(type, extra = {}) {
  if (type === 'none') return { ar: 'حاول مرة أخرى', he: 'נסה שוב' };
  if (type === 'points') {
    const p = Number(extra.points) || 5;
    return { ar: `+${p} نقاط`, he: `+${p} נקודות` };
  }
  if (type === 'percent_off') {
    const v = Number(extra.discountValue) || 10;
    return { ar: `خصم ${v}%`, he: `הנחה ${v}%` };
  }
  if (type === 'fixed_off') {
    const v = Number(extra.discountValue) || 10;
    return { ar: `خصم ${v}₪`, he: `הנחה ${v}₪` };
  }
  return { ar: '', he: '' };
}

const newSegmentId = () => `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;


function pickLocalizedName(nameField, lang) {
  if (nameField == null) return '';
  if (typeof nameField === 'string') return nameField.trim();
  if (typeof nameField === 'object') {
    const v = nameField[lang];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * Price for wheel free-item coupon:
 * meal base price + first select (size) option value — no listing every size as a separate product.
 */
export function resolveFirstVariationPrice(item) {
  let price = Number(item?.price) || 0;
  const options = Array.isArray(item?.options) ? item.options : [];
  const sizeGroup = options.find(
    (o) => o?.type === 'select' && Array.isArray(o.values) && o.values.length > 0
  );
  if (sizeGroup) {
    const first = sizeGroup.values[0];
    price += Number(first?.price) || 0;
  }
  return Math.max(0, price);
}

function firstVariationLabel(item) {
  const options = Array.isArray(item?.options) ? item.options : [];
  const sizeGroup = options.find(
    (o) => o?.type === 'select' && Array.isArray(o.values) && o.values.length > 0
  );
  if (!sizeGroup) return null;
  const first = sizeGroup.values[0];
  const he = pickLocalizedName(first?.label || first?.name, 'he') || pickLocalizedName(first?.label || first?.name, 'ar');
  const ar = pickLocalizedName(first?.label || first?.name, 'ar') || he;
  if (!he && !ar) return null;
  return { he: he || ar, ar: ar || he };
}

/**
 * One row per menu product (not per size/option).
 * Dedupes identical AR+HE names (keeps first).
 * Excludes hidden (`available === false`), order-blocked (`unavailable === true`),
 * and items in hidden categories.
 */
export function flattenMenuItems(menuData) {
  const itemsObj = menuData?.items || {};
  const categories = Array.isArray(menuData?.categories) ? menuData.categories : [];
  const hiddenCategoryIds = new Set(
    categories.filter((c) => c && c.hidden === true).map((c) => c.id)
  );
  const out = [];
  const seenNameKeys = new Set();

  Object.entries(itemsObj).forEach(([categoryId, list]) => {
    if (!Array.isArray(list)) return;
    if (hiddenCategoryIds.has(categoryId)) return;

    list.forEach((item) => {
      if (!item || !item.id) return;

      // Hidden from menu
      if (item.available === false) return;
      // Visible but not orderable
      if (item.unavailable === true) return;
      // Still timed-hidden
      if (item.hideUntil && item.available === false) return;

      const nameAr =
        pickLocalizedName(item.name, 'ar') ||
        pickLocalizedName(item.name, 'he') ||
        String(item.id);
      const nameHe =
        pickLocalizedName(item.name, 'he') ||
        pickLocalizedName(item.name, 'ar') ||
        String(item.id);

      // Collapse duplicate "size as separate meal" rows with the same bilingual name
      const nameKey = `${nameAr}|${nameHe}`.toLowerCase();
      if (seenNameKeys.has(nameKey)) return;
      seenNameKeys.add(nameKey);

      const variation = firstVariationLabel(item);
      const price = resolveFirstVariationPrice(item);

      out.push({
        categoryId,
        itemId: item.id,
        nameAr,
        nameHe,
        name: nameHe || nameAr,
        price,
        available: true,
        firstVariationHe: variation?.he || null,
        firstVariationAr: variation?.ar || null,
        hasVariations: Boolean(variation),
      });
    });
  });

  return out.sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'));
}

export function normalizeLuckyWheelForSave(wheel) {
  const segments = (Array.isArray(wheel?.segments) ? wheel.segments : [])
    .map((s) => {
      const type = s.type || 'none';
      const weight = Math.max(0, Number(s.weight) || 0);
      if (weight <= 0) return null;
      const base = {
        id: s.id || newSegmentId(),
        type,
        weight,
        label: {
          ar: s.label?.ar || '',
          he: s.label?.he || '',
        },
      };
      if (s.maxWins != null && Number(s.maxWins) > 0) {
        base.maxWins = Math.floor(Number(s.maxWins));
      }
      if (type === 'points') base.points = Math.max(0, Number(s.points) || 0);
      if (type === 'percent_off') {
        base.discountValue = Math.min(100, Math.max(0, Number(s.discountValue) || 0));
        if (s.maxDiscountAmount != null && Number(s.maxDiscountAmount) > 0) {
          base.maxDiscountAmount = Number(s.maxDiscountAmount);
        }
      }
      if (type === 'fixed_off') {
        base.discountValue = Math.max(0, Number(s.discountValue) || 0);
      }
      if (type === 'free_item') {
        base.itemId = s.itemId || '';
        base.categoryId = s.categoryId || '';
        base.itemName = s.itemName || s.label?.ar || s.label?.he || '';
        base.itemPrice = Math.max(0, Number(s.itemPrice) || 0);
        if (!base.itemId) return null;
      }
      return base;
    })
    .filter(Boolean);

  return {
    enabled: !!wheel?.enabled,
    spinCostPoints: Math.max(0, Math.floor(Number(wheel?.spinCostPoints) || 10)),
    cooldownHours: Math.max(0, Number(wheel?.cooldownHours) >= 0 ? Number(wheel.cooldownHours) : 24),
    prizeExpiryDays: Math.max(
      0.5,
      Number(wheel?.prizeExpiryDays) > 0 ? Number(wheel.prizeExpiryDays) : 14
    ),
    segments,
  };
}

/**
 * Collapsible Lucky Wheel admin editor — simple for typical restaurant owners.
 * Controlled via `value` / `onChange` (parent owns form.luckyWheel).
 */
export default function LuckyWheelSettingsSection({
  activeBusinessId,
  value,
  onChange,
  open,
  onToggle,
}) {
  const [menuItems, setMenuItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const wheel = value || DEFAULT_LUCKY_WHEEL;

  useEffect(() => {
    if (!activeBusinessId || !open) return;
    let cancelled = false;
    (async () => {
      setItemsLoading(true);
      try {
        const snap = await getDoc(doc(db, 'menus', activeBusinessId));
        if (!cancelled && snap.exists()) {
          setMenuItems(flattenMenuItems(snap.data()));
        } else if (!cancelled) {
          setMenuItems([]);
        }
      } catch (e) {
        console.warn('[LuckyWheel] Failed to load menu items:', e);
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId, open]);

  const totalWeight = useMemo(
    () => (wheel.segments || []).reduce((s, seg) => s + (Number(seg.weight) || 0), 0),
    [wheel.segments]
  );

  const filteredMenuItems = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (m) =>
        m.nameHe.toLowerCase().includes(q) ||
        m.nameAr.toLowerCase().includes(q) ||
        m.itemId.toLowerCase().includes(q)
    );
  }, [menuItems, productFilter]);

  const menuOptionsForSegment = (seg) => {
    if (!seg?.itemId) return filteredMenuItems;
    const selected = menuItems.find((m) => m.itemId === seg.itemId);
    if (!selected) return filteredMenuItems;
    if (filteredMenuItems.some((m) => m.itemId === seg.itemId)) return filteredMenuItems;
    return [selected, ...filteredMenuItems];
  };

  const update = (patch) => onChange({ ...wheel, ...patch });

  const updateSegment = (index, patch) => {
    const segments = [...(wheel.segments || [])];
    segments[index] = { ...segments[index], ...patch };
    update({ segments });
  };

  const removeSegment = (index) => {
    const segments = [...(wheel.segments || [])];
    segments.splice(index, 1);
    update({ segments });
  };

  const addSegment = (type = 'free_item') => {
    const segments = [...(wheel.segments || [])];
    const base = {
      id: newSegmentId(),
      type,
      weight: 15,
      label: defaultLabelsForType(type, { points: 5, discountValue: 10 }),
    };
    if (type === 'points') base.points = 5;
    if (type === 'percent_off' || type === 'fixed_off') base.discountValue = 10;
    segments.push(base);
    update({ segments });
  };

  const changeSegmentType = (index, type) => {
    const seg = wheel.segments[index] || {};
    const patch = {
      type,
      label:
        type === 'free_item' && seg.itemId
          ? seg.label
          : defaultLabelsForType(type, {
              points: seg.points || 5,
              discountValue: seg.discountValue || 10,
            }),
    };
    if (type === 'points' && seg.points == null) patch.points = 5;
    if ((type === 'percent_off' || type === 'fixed_off') && seg.discountValue == null) {
      patch.discountValue = 10;
    }
    if (type !== 'free_item') {
      patch.itemId = '';
      patch.categoryId = '';
      patch.itemName = '';
      patch.itemPrice = 0;
    }
    updateSegment(index, patch);
  };

  const selectItem = (index, itemId) => {
    const item = menuItems.find((m) => m.itemId === itemId);
    if (!item) {
      updateSegment(index, {
        itemId: '',
        categoryId: '',
        itemName: '',
        itemPrice: 0,
        label: { ar: '', he: '' },
      });
      return;
    }
    updateSegment(index, {
      itemId: item.itemId,
      categoryId: item.categoryId,
      itemName: item.nameAr || item.nameHe,
      itemPrice: item.price,
      label: { ar: item.nameAr, he: item.nameHe },
    });
  };

  return (
    <div style={{ marginTop: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          color: '#007bff',
          fontWeight: 600,
          fontSize: 15,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          marginBottom: 8,
          gap: 6,
          padding: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
        }}
      >
        גלגל מזל
        <span style={{ fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
            הלקוח מסובב את הגלגל ומקבל פרס. הוסיפו פרסים בלחיצה — השמות נטענים מהתפריט אוטומטית.
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 14,
              padding: '10px 12px',
              background: wheel.enabled ? '#e8f5e9' : '#f5f5f5',
              borderRadius: 10,
              border: `1px solid ${wheel.enabled ? '#c8e6c9' : '#e0e0e0'}`,
            }}
          >
            <input
              type="checkbox"
              checked={!!wheel.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            {wheel.enabled ? 'הגלגל פעיל באפליקציה' : 'הפעל את גלגל המזל'}
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              marginBottom: 14,
              opacity: wheel.enabled ? 1 : 0.55,
              pointerEvents: wheel.enabled ? 'auto' : 'none',
            }}
          >
            <SimpleField
              label="עלות סיבוב (נקודות)"
              type="number"
              min={0}
              value={wheel.spinCostPoints}
              onChange={(v) => update({ spinCostPoints: v })}
            />
            <SimpleField
              label="המתנה בין סיבובים (שעות)"
              type="number"
              min={0}
              step="0.5"
              value={wheel.cooldownHours}
              onChange={(v) => update({ cooldownHours: v })}
            />
            <SimpleField
              label="תוקף הפרס (ימים)"
              type="number"
              min={0.5}
              step={0.5}
              value={wheel.prizeExpiryDays}
              onChange={(v) => update({ prizeExpiryDays: v })}
            />
          </div>

          <div style={{ marginBottom: 10, opacity: wheel.enabled ? 1 : 0.55, pointerEvents: wheel.enabled ? 'auto' : 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
              פרסים על הגלגל ({(wheel.segments || []).length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SEGMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => addSegment(t.value)}
                  style={{
                    ...btnChip,
                    background: t.value === 'free_item' ? '#e3f2fd' : '#fff',
                    borderColor: t.value === 'free_item' ? '#90caf9' : '#ddd',
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {(wheel.segments || []).length < 2 && (
            <div style={{ fontSize: 12, color: '#c62828', marginBottom: 10 }}>
              הוסיפו לפחות 2 פרסים כדי שהגלגל יעבוד.
            </div>
          )}

          {(wheel.segments || []).map((seg, index) => {
            const isFreeItem = seg.type === 'free_item';
            const selectedProduct = menuItems.find((m) => m.itemId === seg.itemId);
            const chance =
              totalWeight > 0
                ? (((Number(seg.weight) || 0) / totalWeight) * 100).toFixed(0)
                : '0';
            const preset = chancePresetForWeight(seg.weight);
            const typeMeta = SEGMENT_TYPES.find((t) => t.value === seg.type) || SEGMENT_TYPES[0];

            return (
              <div
                key={seg.id || index}
                style={{
                  border: '1px solid #eceff1',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                  background: '#fafbfc',
                  opacity: wheel.enabled ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={seg.type}
                      disabled={!wheel.enabled}
                      onChange={(e) => changeSegmentType(index, e.target.value)}
                      style={{ ...inputStyle(!wheel.enabled), minWidth: 0, maxWidth: '100%', fontWeight: 600 }}
                    >
                      {SEGMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.emoji} {t.label}
                        </option>
                      ))}
                    </select>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1565c0',
                        background: '#e3f2fd',
                        padding: '6px 10px',
                        borderRadius: 20,
                      }}
                    >
                      סיכוי ~{chance}%
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!wheel.enabled}
                    onClick={() => removeSegment(index)}
                    style={{ ...btnSecondary, color: '#c62828', borderColor: '#ffcdd2' }}
                  >
                    מחק
                  </button>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>כמה נפוץ הפרס?</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CHANCE_PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        disabled={!wheel.enabled}
                        onClick={() => updateSegment(index, { weight: p.weight })}
                        style={{
                          ...btnChip,
                          background: preset === p.key ? '#007aff' : '#fff',
                          color: preset === p.key ? '#fff' : '#333',
                          borderColor: preset === p.key ? '#007aff' : '#ddd',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isFreeItem && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 6 }}>
                      בחרו מוצר מהתפריט
                    </div>
                    <input
                      type="search"
                      placeholder="חיפוש…"
                      value={productFilter}
                      disabled={!wheel.enabled || itemsLoading}
                      onChange={(e) => setProductFilter(e.target.value)}
                      style={{
                        ...inputStyle(!wheel.enabled),
                        width: '100%',
                        marginBottom: 6,
                      }}
                    />
                    <select
                      value={seg.itemId || ''}
                      disabled={!wheel.enabled || itemsLoading}
                      onChange={(e) => selectItem(index, e.target.value)}
                      style={{ ...inputStyle(!wheel.enabled), width: '100%' }}
                    >
                      <option value="">
                        {itemsLoading ? 'טוען…' : 'בחרו מוצר'}
                      </option>
                      {menuOptionsForSegment(seg).map((m) => (
                        <option key={`${m.categoryId}_${m.itemId}`} value={m.itemId}>
                          {m.nameHe}
                          {m.nameAr && m.nameAr !== m.nameHe ? ` · ${m.nameAr}` : ''}
                          {` · ₪${m.price}`}
                        </option>
                      ))}
                    </select>
                    {selectedProduct && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          background: '#e8f5e9',
                          borderRadius: 8,
                          fontSize: 13,
                          color: '#2e7d32',
                          lineHeight: 1.45,
                        }}
                      >
                        <strong>{selectedProduct.nameHe}</strong>
                        {selectedProduct.nameAr !== selectedProduct.nameHe
                          ? ` · ${selectedProduct.nameAr}`
                          : ''}
                        {` · קופון ₪${seg.itemPrice || selectedProduct.price}`}
                        {selectedProduct.hasVariations
                          ? ` · גודל: ${selectedProduct.firstVariationHe || selectedProduct.firstVariationAr}`
                          : ''}
                      </div>
                    )}
                  </div>
                )}

                {seg.type === 'points' && (
                  <SimpleField
                    label="כמה נקודות יקבלו?"
                    type="number"
                    min={0}
                    value={seg.points ?? ''}
                    disabled={!wheel.enabled}
                    onChange={(v) =>
                      updateSegment(index, {
                        points: v,
                        label: defaultLabelsForType('points', { points: v }),
                      })
                    }
                  />
                )}

                {(seg.type === 'percent_off' || seg.type === 'fixed_off') && (
                  <SimpleField
                    label={seg.type === 'percent_off' ? 'אחוז הנחה' : 'סכום הנחה (₪)'}
                    type="number"
                    min={0}
                    value={seg.discountValue ?? ''}
                    disabled={!wheel.enabled}
                    onChange={(v) =>
                      updateSegment(index, {
                        discountValue: v,
                        label: defaultLabelsForType(seg.type, { discountValue: v }),
                      })
                    }
                  />
                )}

                {seg.type === 'none' && (
                  <div style={{ fontSize: 12, color: '#888' }}>
                    מוצג כלקוח כ־«{seg.label?.he || typeMeta.label}»
                  </div>
                )}

                {showAdvanced && !isFreeItem && seg.type !== 'none' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>תווית עברית</div>
                      <input
                        dir="rtl"
                        value={seg.label?.he || ''}
                        disabled={!wheel.enabled}
                        onChange={(e) =>
                          updateSegment(index, { label: { ...seg.label, he: e.target.value } })
                        }
                        style={{ ...inputStyle(!wheel.enabled), width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>تسمية عربية</div>
                      <input
                        dir="rtl"
                        value={seg.label?.ar || ''}
                        disabled={!wheel.enabled}
                        onChange={(e) =>
                          updateSegment(index, { label: { ...seg.label, ar: e.target.value } })
                        }
                        style={{ ...inputStyle(!wheel.enabled), width: '100%' }}
                      />
                    </div>
                  </div>
                )}

                {showAdvanced && (
                  <div style={{ marginTop: 10 }}>
                    <SimpleField
                      label="מקס׳ זכיות לפרס זה (אופציונלי)"
                      type="number"
                      min={0}
                      value={seg.maxWins ?? ''}
                      disabled={!wheel.enabled}
                      onChange={(v) =>
                        updateSegment(index, {
                          maxWins: v === '' ? undefined : v,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              marginTop: 4,
            }}
          >
            {showAdvanced ? 'הסתר הגדרות מתקדמות ▲' : 'הגדרות מתקדמות ▼'}
          </button>
        </div>
      )}
    </div>
  );
}

function SimpleField({ label, type = 'text', value, onChange, min, step, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</span>
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(disabled)}
      />
    </div>
  );
}

const inputStyle = (disabled) => ({
  height: 40,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid #e0e0e0',
  fontSize: 14,
  background: disabled ? '#f5f5f5' : '#fff',
  textAlign: 'right',
  boxSizing: 'border-box',
});

const btnSecondary = {
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const btnChip = {
  height: 36,
  padding: '0 12px',
  borderRadius: 20,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};
