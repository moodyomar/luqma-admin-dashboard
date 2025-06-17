// File: src/components/MealCard.jsx
import React from 'react';
import OptionsEditor from './OptionsEditor';

const MealCard = ({ meal, onChange, onDelete, onSave }) => {
  const handleFieldChange = (field, lang, value) => {
    const updated = { ...meal };

    if (field === 'name' || field === 'description') {
      updated[field] = { ...updated[field], [lang]: value.trimStart() };
    } else {
      updated[field] = value.trimStart();
    }

    onChange(updated);
  };

  const handleOptionsChange = (updatedOptions) => {
    onChange({ ...meal, options: updatedOptions });
  };

  return (
    <div style={{
      padding: 12,
      border: '1px solid #ccc',
      borderRadius: 8,
      marginBottom: 14,
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text"
          placeholder="اسم المنتج بالعربي"
          value={meal?.name?.ar || ''}
          onChange={(e) => handleFieldChange('name', 'ar', e.target.value)}
        />
        <input
          type="text"
          placeholder="שם המוצר בעברית"
          value={meal?.name?.he || ''}
          onChange={(e) => handleFieldChange('name', 'he', e.target.value)}
        />
        <input
          type="text"
          placeholder="המחיר | السعر"
          value={meal?.price || ''}
          onChange={(e) => handleFieldChange('price', null, e.target.value)}
        />
        <input
          type="text"
          placeholder="الوصف بالعربي"
          value={meal?.description?.ar || ''}
          onChange={(e) => handleFieldChange('description', 'ar', e.target.value)}
        />
        <input
          type="text"
          placeholder="התיאור בעברית"
          value={meal?.description?.he || ''}
          onChange={(e) => handleFieldChange('description', 'he', e.target.value)}
        />
        <input
          type="text"
          placeholder="קישור תמונה | אם אין לדלג"
          value={meal?.image || ''}
          onChange={(e) => handleFieldChange('image', null, e.target.value)}
        />
      </div>

      {meal?.image && (
        <img
          src={meal.image}
          alt="meal preview"
          style={{ width: 100, height: 'auto', marginTop: 10, borderRadius: 6 }}
        />
      )}

      <OptionsEditor
        options={meal?.options || []}
        onChange={handleOptionsChange}
      />

      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <button
          onClick={onDelete}
          style={{
            backgroundColor: '#ff4444',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          מחק | حذف
        </button>

        {onSave && (
          <button
            onClick={onSave}
            style={{
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            שמור | حفظ
          </button>
        )}
      </div>
    </div>
  );
};

export default MealCard;
