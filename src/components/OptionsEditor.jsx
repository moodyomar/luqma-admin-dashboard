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
    <div style={{ marginTop: 20 }}>
      <h4>Options</h4>
      {options.map((option, index) => (
        <div key={index} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
          <strong>Type:</strong> {option.type}<br />
          <label>Arabic Label:</label>
          <input
            value={option.label?.ar || defaultLabels[option.type]?.ar}
            onChange={(e) => handleLabelChange(index, 'ar', e.target.value)}
          />
          <label>Hebrew Label:</label>
          <input
            value={option.label?.he || defaultLabels[option.type]?.he}
            onChange={(e) => handleLabelChange(index, 'he', e.target.value)}
          />

          <div style={{ marginTop: 10 }}>
            <strong>Values:</strong>
            {option.values.map((val, valIndex) => (
              <div key={valIndex} style={{ marginBottom: 8 }}>
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
            <button onClick={() => handleAddValue(index)} style={{ marginTop: 5 }}>
              + Add Value
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12, borderTop: '1px dashed #ccc', paddingTop: 12 }}>
        <label><strong>New Option Type: </strong></label>
        <select
          value={newOptionType}
          onChange={(e) => setNewOptionType(e.target.value)}
          style={{ marginRight: 10 }}
        >
          <option value="select">Size (select one)</option>
          <option value="multi">Extras (multi-choice)</option>
        </select>
        <button onClick={handleAddOption}>Add Option</button>
      </div>
    </div>
  );
};

export default OptionsEditor;
