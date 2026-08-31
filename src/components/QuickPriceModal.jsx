import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import {
  findSizeOptionIndex,
  getBasePrice,
  getMealPriceEntries,
  applyMealPrices,
} from '../../utils/mealPricing';

const QuickPriceModal = ({ visible, meal, onClose, onSave }) => {
  const [basePrice, setBasePrice] = useState('');
  const [sizeEdits, setSizeEdits] = useState([]);

  const hasSizes = findSizeOptionIndex(meal) !== -1;
  const entries = getMealPriceEntries(meal);

  useEffect(() => {
    if (!visible) return;
    setBasePrice(String(getBasePrice(meal)));
    setSizeEdits(
      hasSizes
        ? entries.map((entry) => ({
            price: String(entry.price),
            labelAr: entry.labelAr,
            labelHe: entry.labelHe,
          }))
        : [],
    );
    // Re-seed the form whenever a different meal opens the modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, meal?.id]);

  if (!visible) return null;

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #ccc',
    fontSize: 16,
    direction: 'ltr',
    textAlign: 'center',
    boxSizing: 'border-box',
  };

  const handleSave = () => {
    onSave(applyMealPrices(meal, basePrice, sizeEdits));
    onClose();
  };

  const updateSizeField = (idx, field, value) => {
    setSizeEdits((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        direction: 'rtl',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#666',
            padding: 4,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <FiX />
        </button>

        <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600, color: '#333', textAlign: 'right' }}>
          تعديل الأسعار | עדכון מחירים
        </h3>
        <p style={{ margin: '0 0 18px 0', fontSize: 14, color: '#666', textAlign: 'right' }}>
          {meal?.name?.ar || meal?.name?.he || ''}
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 600 }}>
            السعر الأساسي | מחיר בסיס
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            style={inputStyle}
          />
        </label>

        {hasSizes && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 10, fontWeight: 600 }}>
              الأحجام والأسعار | גדלים ומחירים
            </div>
            {entries.map((entry, idx) => (
              <div
                key={entry.key}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                  background: '#fafafa',
                }}
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={sizeEdits[idx]?.labelAr ?? ''}
                    onChange={(e) => updateSizeField(idx, 'labelAr', e.target.value)}
                    placeholder={`الحجم بالعربي (${idx + 1})`}
                    style={{ ...inputStyle, direction: 'rtl', textAlign: 'right', fontSize: 14 }}
                  />
                  <input
                    type="text"
                    value={sizeEdits[idx]?.labelHe ?? ''}
                    onChange={(e) => updateSizeField(idx, 'labelHe', e.target.value)}
                    placeholder="הגודל בעברית"
                    style={{ ...inputStyle, direction: 'rtl', textAlign: 'right', fontSize: 14 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#666' }}>السعر | מחיר</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={sizeEdits[idx]?.price ?? ''}
                    onChange={(e) => updateSizeField(idx, 'price', e.target.value)}
                    style={{ ...inputStyle, width: 110, flexShrink: 0 }}
                  />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
              الأسعار هنا نهائية كما يراها العميل، وسيتم حساب الفرق عن السعر الأساسي تلقائياً.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#28a745',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            حفظ | שמור
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 16px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: '#f5f5f7',
              color: '#444',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickPriceModal;
