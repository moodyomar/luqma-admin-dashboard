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
    <div className="meal-card">
      <div className="meal-header-row">
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
          className="price-input"
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
      <div className="meal-image-wrapper">
        {meal?.image && (
          <img
            src={meal.image}
            alt="meal preview"
          />
        )}
      </div>

      <OptionsEditor
        options={meal?.options || []}
        onChange={handleOptionsChange}
      />

      <div className="meal-card-buttons">
        <button
          onClick={onDelete}
          className="delete-btn"
        >
          מחק | حذف
        </button>

        {onSave && (
          <button
            onClick={onSave}
            className="save-btn"
          >
            שמור | حفظ
          </button>
        )}
      </div>
    </div>
  );
};

export default MealCard;
