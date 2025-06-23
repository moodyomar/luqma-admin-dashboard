// File: src/components/OptionsEditor.jsx
import React, { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';


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

  const handleDeleteValue = (optionIndex, valIndex) => {
    const updatedOptions = [...options];
    updatedOptions[optionIndex].values.splice(valIndex, 1);
    onChange(updatedOptions);
  };
  const handleDeleteAllValues = (optionIndex) => {
    const confirmed = window.confirm('هل أنت متأكد أنك تريد حذف هذا الخيار بالكامل؟');
    if (!confirmed) return;

    const updatedOptions = [...options];
    updatedOptions.splice(optionIndex, 1); // نحذف الخيار كليًا
    onChange(updatedOptions);
  };


  const handleAddOption = () => {
    const isSelect = newOptionType === 'select';

    const newOption = {
      type: newOptionType,
      label: {
        ar: '',
        he: '',
      },
      values: [
        {
          label: { ar: '', he: '' },
          value: `opt_${Date.now()}`,
          extra: isSelect ? 0 : undefined, // يجعلها undefined بدل عدم الوجود إطلاقًا
        },
      ],
    };

    // احذف الـ extra إذا مش من نوع select (تجنّب undefined في الفايربيس)
    if (!isSelect) {
      delete newOption.values[0].extra;
    }

    onChange([...options, newOption]);
  };


  const handleDeleteOption = (index) => {
    const updated = [...options];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleDeleteAllOptions = () => {
    if (confirm('هل أنت متأكد من حذف كل الإضافات؟')) {
      onChange([]);
    }
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
                  <div key={valIndex} className="value-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      placeholder="كم زياده؟"
                      value={val.extra || 0}
                      onChange={(e) => handleExtraChange(index, valIndex, e.target.value)}
                    />

                    <button
                      onClick={() => handleDeleteValue(index, valIndex)}
                      style={{
                        backgroundColor: '#d9534f',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                  <button
                    className="add-value-btn"
                    onClick={() => handleAddValue(index)}
                    style={{
                      backgroundColor: 'rgb(40, 167, 69)',
                      color: '#fff',
                      border: 'none',
                      width: 140,
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    ضيف خيار
                  </button>

                  <button className="add-value-btn"
                    onClick={() => handleDeleteAllValues(index)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      width: 140,
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}>
                    حذف كل الخيارات
                  </button>
                </div>

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
