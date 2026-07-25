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
  { value: 'none', label: 'נסה שוב / אין פרס' },
  { value: 'points', label: 'נקודות' },
  { value: 'percent_off', label: 'הנחה %' },
  { value: 'fixed_off', label: 'הנחה ₪' },
  { value: 'free_item', label: 'מוצר חינם' },
];

const newSegmentId = () => `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Flatten menus/{id}.items object → [{ categoryId, itemId, name, price }] */
export function flattenMenuItems(menuData) {
  const itemsObj = menuData?.items || {};
  const out = [];
  Object.entries(itemsObj).forEach(([categoryId, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (!item || !item.id) return;
      const name =
        (typeof item.name === 'object' ? item.name?.he || item.name?.ar : item.name) ||
        item.id;
      out.push({
        categoryId,
        itemId: item.id,
        name: String(name),
        price: Number(item.price) || 0,
        available: item.available !== false,
      });
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export function normalizeLuckyWheelForSave(wheel) {
  const segments = (Array.isArray(wheel?.segments) ? wheel.segments : [])
    .map((s, i) => {
      const type = s.type || 'none';
      const weight = Math.max(0, Number(s.weight) || 0);
      if (weight <= 0) return null;
      const base = {
        id: s.id || newSegmentId(),
        type,
        weight,
        label: {
          ar: s.label?.ar || s.label || '',
          he: s.label?.he || s.label || '',
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
        base.itemName = s.itemName || '';
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
 * Collapsible Lucky Wheel admin editor.
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

  const addSegment = (type = 'none') => {
    const segments = [...(wheel.segments || [])];
    const base = {
      id: newSegmentId(),
      type,
      weight: 10,
      label: { ar: '', he: '' },
    };
    if (type === 'points') base.points = 5;
    if (type === 'percent_off') base.discountValue = 10;
    if (type === 'fixed_off') base.discountValue = 10;
    segments.push(base);
    update({ segments });
  };

  const selectItem = (index, itemId) => {
    const item = menuItems.find((m) => m.itemId === itemId);
    if (!item) {
      updateSegment(index, { itemId: '', categoryId: '', itemName: '', itemPrice: 0 });
      return;
    }
    updateSegment(index, {
      itemId: item.itemId,
      categoryId: item.categoryId,
      itemName: item.name,
      itemPrice: item.price,
      label: {
        ar: item.name,
        he: item.name,
      },
    });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          color: '#007bff',
          fontWeight: 600,
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          marginBottom: 8,
          gap: 6,
          padding: 0,
        }}
      >
        גלגל מזל (Lucky Wheel)
        <span style={{ fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 12, lineHeight: 1.4 }}>
            לקוחות מסובבים את הגלגל תמורת נקודות. התוצאה נקבעת בשרת (לא באפליקציה) — מאובטח מפני רמאות.
            בחרו מוצרים מהתפריט כפרסים, הגדירו עלות סיבוב והמתנה בין סיבובים.
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={!!wheel.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
            הפעל גלגל מזל באפליקציה
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>עלות סיבוב (נקודות)</span>
              <input
                type="number"
                min={0}
                value={wheel.spinCostPoints}
                disabled={!wheel.enabled}
                onChange={(e) => update({ spinCostPoints: e.target.value })}
                style={inputStyle(!wheel.enabled)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>המתנה בין סיבובים (שעות)</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={wheel.cooldownHours}
                disabled={!wheel.enabled}
                onChange={(e) => update({ cooldownHours: e.target.value })}
                style={inputStyle(!wheel.enabled)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>תוקף פרס / קופון (ימים)</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={wheel.prizeExpiryDays}
                disabled={!wheel.enabled}
                onChange={(e) => update({ prizeExpiryDays: e.target.value })}
                style={inputStyle(!wheel.enabled)}
              />
              <span style={{ fontSize: 11, color: '#888' }}>
                לדוגמה: 2 = 48 שעות · 7 = שבוע · 14 = שבועיים
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
              מקטעי הגלגל ({(wheel.segments || []).length}) · משקל כולל {totalWeight || 0}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={!wheel.enabled} onClick={() => addSegment('free_item')} style={btnSecondary}>
                + מוצר
              </button>
              <button type="button" disabled={!wheel.enabled} onClick={() => addSegment('none')} style={btnSecondary}>
                + מקטע
              </button>
            </div>
          </div>

          {(wheel.segments || []).length < 2 && (
            <div style={{ fontSize: 12, color: '#c62828', marginBottom: 8 }}>
              נדרשים לפחות 2 מקטעים עם משקל &gt; 0 כדי להפעיל את הגלגל.
            </div>
          )}

          {(wheel.segments || []).map((seg, index) => (
            <div
              key={seg.id || index}
              style={{
                border: '1px solid #eee',
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                background: '#fafafa',
                opacity: wheel.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <select
                  value={seg.type}
                  disabled={!wheel.enabled}
                  onChange={(e) => updateSegment(index, { type: e.target.value })}
                  style={{ ...inputStyle(!wheel.enabled), minWidth: 140 }}
                >
                  {SEGMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  title="משקל (הסתברות יחסית)"
                  placeholder="משקל"
                  value={seg.weight}
                  disabled={!wheel.enabled}
                  onChange={(e) => updateSegment(index, { weight: e.target.value })}
                  style={{ ...inputStyle(!wheel.enabled), width: 90 }}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="מקס׳ זכיות (אופציונלי)"
                  value={seg.maxWins ?? ''}
                  disabled={!wheel.enabled}
                  onChange={(e) =>
                    updateSegment(index, {
                      maxWins: e.target.value === '' ? undefined : e.target.value,
                    })
                  }
                  style={{ ...inputStyle(!wheel.enabled), width: 140 }}
                />
                <button
                  type="button"
                  disabled={!wheel.enabled}
                  onClick={() => removeSegment(index)}
                  style={{ ...btnSecondary, color: '#c62828' }}
                >
                  מחק
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  placeholder="תווית עברית"
                  value={seg.label?.he || ''}
                  disabled={!wheel.enabled}
                  onChange={(e) =>
                    updateSegment(index, { label: { ...seg.label, he: e.target.value } })
                  }
                  style={{ ...inputStyle(!wheel.enabled), flex: 1, minWidth: 120 }}
                />
                <input
                  placeholder="تسمية عربية"
                  value={seg.label?.ar || ''}
                  disabled={!wheel.enabled}
                  onChange={(e) =>
                    updateSegment(index, { label: { ...seg.label, ar: e.target.value } })
                  }
                  style={{ ...inputStyle(!wheel.enabled), flex: 1, minWidth: 120 }}
                />
              </div>

              {seg.type === 'points' && (
                <input
                  type="number"
                  min={0}
                  placeholder="נקודות לזכייה"
                  value={seg.points ?? ''}
                  disabled={!wheel.enabled}
                  onChange={(e) => updateSegment(index, { points: e.target.value })}
                  style={{ ...inputStyle(!wheel.enabled), width: 160 }}
                />
              )}
              {(seg.type === 'percent_off' || seg.type === 'fixed_off') && (
                <input
                  type="number"
                  min={0}
                  placeholder={seg.type === 'percent_off' ? 'אחוז הנחה' : 'סכום הנחה ₪'}
                  value={seg.discountValue ?? ''}
                  disabled={!wheel.enabled}
                  onChange={(e) => updateSegment(index, { discountValue: e.target.value })}
                  style={{ ...inputStyle(!wheel.enabled), width: 160 }}
                />
              )}
              {seg.type === 'free_item' && (
                <div>
                  <select
                    value={seg.itemId || ''}
                    disabled={!wheel.enabled || itemsLoading}
                    onChange={(e) => selectItem(index, e.target.value)}
                    style={{ ...inputStyle(!wheel.enabled), width: '100%', maxWidth: 420 }}
                  >
                    <option value="">{itemsLoading ? 'טוען מוצרים…' : 'בחר מוצר מהתפריט'}</option>
                    {menuItems.map((m) => (
                      <option key={`${m.categoryId}_${m.itemId}`} value={m.itemId}>
                        {m.name} · ₪{m.price}{m.available ? '' : ' (לא זמין)'}
                      </option>
                    ))}
                  </select>
                  {seg.itemId && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      קופון חד־פעמי בסכום ₪{seg.itemPrice || 0} יונפק למשתמש בזכייה
                    </div>
                  )}
                </div>
              )}

              {totalWeight > 0 && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                  סיכוי משוער: {(((Number(seg.weight) || 0) / totalWeight) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
