// File: src/components/OptionsEditor.jsx
import React, { useState } from 'react';

const defaultLabels = {
    select: {
        ar: 'اختر الحجم',
        he: 'בחר גודל',
    },
    multi: {
        ar: 'إضافات',
        he: 'תוספות',
    },
};

const OptionsEditor = ({ options = [], onChange }) => {
    const [newOptionType, setNewOptionType] = useState('select');

    const handleLabelChange = (index, lang, value) => {
        const updated = [...options];
        updated[index].label[lang] = value;
        onChange(updated);
    };

    const handleValueChange = (optionIndex, valueIndex, lang, value) => {
        const updated = [...options];
        updated[optionIndex].values[valueIndex].label[lang] = value;
        onChange(updated);
    };

    const handleExtraChange = (optionIndex, valueIndex, value) => {
        const updated = [...options];
        updated[optionIndex].values[valueIndex].extra = parseFloat(value) || 0;
        onChange(updated);
    };

    const handleAddValue = (optionIndex) => {
        const updated = [...options];
        updated[optionIndex].values.push({
            label: { ar: '', he: '' },
            value: `opt_${Date.now()}`,
            extra: updated[optionIndex].type === 'select' ? 0 : undefined,
        });
        onChange(updated);
    };

    const handleAddOption = () => {
        const newOption = {
            type: newOptionType,
            label: { ...defaultLabels[newOptionType] },
            values: [
                {
                    label: { ar: '', he: '' },
                    value: `opt_${Date.now()}`,
                    ...(newOptionType === 'select' ? { extra: 0 } : {}),
                },
            ],
        };
        onChange([...options, newOption]);
    };

   return (
  <div className="options-section">
    <h4>اضافات | אפשריות</h4>

    {options.map((option, index) => (
      <div key={index} className="option-card">
        <div className="option-header">
          <strong>Type:</strong> {option.type}
        </div>

        <div className="option-labels">
          <label>
            Arabic Label:
            <input
              value={option.label?.ar || defaultLabels[option.type]?.ar}
              onChange={(e) => handleLabelChange(index, 'ar', e.target.value)}
            />
          </label>
          <label>
            Hebrew Label:
            <input
              value={option.label?.he || defaultLabels[option.type]?.he}
              onChange={(e) => handleLabelChange(index, 'he', e.target.value)}
            />
          </label>
        </div>

        <div className="option-values">
          <strong>الاضافات | האפשריות</strong>
          {option.values.map((val, valIndex) => (
            <div key={valIndex} className="value-row">
              <input
                placeholder="Arabic Value"
                value={val.label.ar}
                onChange={(e) => handleValueChange(index, valIndex, 'ar', e.target.value)}
              />
              <input
                placeholder="Hebrew Value"
                value={val.label.he}
                onChange={(e) => handleValueChange(index, valIndex, 'he', e.target.value)}
              />
              <input
                type="number"
                placeholder="Extra ₪"
                value={val.extra || ''}
                onChange={(e) => handleExtraChange(index, valIndex, e.target.value)}
              />
            </div>
          ))}

          <button className="add-value-btn" onClick={() => handleAddValue(index)}>
            ضيف | הוסף
          </button>
        </div>
      </div>
    ))}

    <div className="option-add-section">
      <label><strong>הוסף אפשרות | زيد اضافه:</strong></label>
      <div className="optionsWrapper">
        <select
          value={newOptionType}
          onChange={(e) => setNewOptionType(e.target.value)}
        >
          <option value="select">حجم | גודל</option>
          <option value="multi">اضافات | תוספות</option>
        </select>
        <button onClick={handleAddOption}>اضافه | הוספה</button>
      </div>
    </div>
  </div>
);

};

export default OptionsEditor;
