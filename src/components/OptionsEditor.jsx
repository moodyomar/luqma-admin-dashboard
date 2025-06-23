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

  const [showValues, setShowValues] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState({});

  const toggleOption = (index) => {
    setExpandedOptions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="options-section">
      {options.map((option, index) => (
        <div key={index} className="option-card">
          <div className="option-header">
            <strong>نوع الاضافه:</strong> <span style={{ color: 'green', fontWeight: '700' }}>{option.type === 'multi' ? 'خيارات متعدده' : 'خيار واحد'}</span>
          </div>

          <div className="option-labels">
            <label>
              اختر السؤال الي يبين للزبون
              <input
                value={option.label?.ar || defaultLabels[option.type]?.ar}
                onChange={(e) => handleLabelChange(index, 'ar', e.target.value)}
              />
            </label>
            <label>
              בחר את השאלה שתופיע ללקוח
              <input
                value={option.label?.he || defaultLabels[option.type]?.he}
                onChange={(e) => handleLabelChange(index, 'he', e.target.value)}
              />
            </label>
          </div>

          <div className="option-wrapper" style={{ marginBottom: 16 }}>
            <div className="btn-row-right">
              <button
                onClick={() => toggleOption(index)}
                style={{
                  direction: 'rtl',
                  backgroundColor: '#f4f4f4',
                  padding: '6px 12px',
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  cursor: 'pointer',
                  marginBottom: 8
                }}
              >
                {expandedOptions[index] ? '🔽 إخفاء الإضافات' : '➕ عرض الإضافات'}
              </button>
            </div>

            {expandedOptions[index] && (
              <div className="option-values">
                <strong style={{ direction: 'rtl' }}>الاضافات | האפשריות</strong>

                {option.values.map((val, valIndex) => (
                  <div key={valIndex} className="value-row">
                    <input
                      placeholder="مثلا: صغير/كبير"
                      value={val.label.ar}
                      onChange={(e) => handleValueChange(index, valIndex, 'ar', e.target.value)}
                    />
                    <input
                      placeholder="דוגמה: קטן/גדול"
                      value={val.label.he}
                      onChange={(e) => handleValueChange(index, valIndex, 'he', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="كم زياده الدفع عليها ₪"
                      value={val.extra || ''}
                      onChange={(e) => handleExtraChange(index, valIndex, e.target.value)}
                    />
                  </div>
                ))}

                <button className="add-value-btn" onClick={() => handleAddValue(index)}>
                  ضيف | הוסף
                </button>
              </div>
            )}

          </div>

        </div>
      ))}

      <div className="option-add-section">
        <label className='optionsLabel'>הוסף עוד | زيد بعد اضافات:</label>
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
