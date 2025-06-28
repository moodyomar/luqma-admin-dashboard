// File: src/components/OptionsEditor.jsx
import React, { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';


const defaultLabels = {
  select: {
    ar: 'اختر الحجم',
    he: 'בחר גודל',
  },
  multi: {
    ar: 'اختار الإضافات',
    he: 'בחר תוספות',
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

  const handleImageChange = (optionIndex, valueIndex, value) => {
    const updated = [...options];
    updated[optionIndex].values[valueIndex].image = value;
    onChange(updated);
  };

  const handleAddValue = (optionIndex) => {
    const updated = [...options];
    updated[optionIndex].values.push({
      label: { ar: '', he: '' },
      value: `opt_${Date.now()}`,
      extra: updated[optionIndex].type === 'select' ? 0 : undefined,
      image: '',
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

  const handleAdvancedChange = (optionIndex, field, value) => {
    const updated = [...options];

    updated[optionIndex] = {
      ...updated[optionIndex],
      [field]: value,
    };

    // 🧹 منطق إضافي: إذا اختار "الكل"، احذف max
    if (field === 'allChecked' && value === true) {
      delete updated[optionIndex].max;
    }

    onChange(updated);
  };

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
              <div className="required-extra-label" style={{ marginTop: 8 }}>
                <label>
                <span style={{ marginInlineStart: 6 }}>الحقل مطلوب؟</span>
                  <input
                    type="checkbox"
                    checked={option.required || false}
                    onChange={(e) => {
                      handleAdvancedChange(index, 'required', e.target.checked);
                    }}/>
                </label>
              </div>



            </div>

            {expandedOptions[index] && (
              <div className="option-values">
                <strong style={{ direction: 'rtl' }}>الاضافات | האפשריות</strong>

                {option.values.map((val, valIndex) => (
                  <div key={valIndex} className="value-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input style={{minWidth:70}}
                      placeholder="مثلا: صغير/كبير"
                      value={val.label.ar}
                      onChange={(e) => handleValueChange(index, valIndex, 'ar', e.target.value)}
                    />
                    <input style={{minWidth:70}}
                      placeholder="דוגמה: קטן/גדול"
                      value={val.label.he}
                      onChange={(e) => handleValueChange(index, valIndex, 'he', e.target.value)}
                    />
                    <input
                    style={{minWidth:20}}
                      type="number"
                      placeholder="كم زياده؟"
                      value={val.extra || 0}
                      onChange={(e) => handleExtraChange(index, valIndex, e.target.value)}
                    />
                    <input
                    style={{minWidth:80}}
                      type="url"
                      placeholder="رابط الصورة"
                      value={val.image || ''}
                      onChange={(e) => handleImageChange(index, valIndex, e.target.value)}
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

                {option.type === 'multi' && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', direction: 'rtl' }}>
                      إعدادات متقدمة للإضافات المتعددة
                    </summary>
                    <div className="advance-options">

                      {/* Set Max options to choose (limit user) */}
                      <div className="max-options" style={{ marginTop: 10 }}>
                        <label>
                          الحد الأقصى للاختيارات:
                          <input
                            type="number"
                            min="1"
                            value={option.max || ''}
                            onChange={(e) =>
                              handleAdvancedChange(index, 'max', parseInt(e.target.value) || null)
                            }
                            placeholder="مثلاً 2 أو 3 ماكسيموم"
                            disabled={option.allChecked} // ❌ Disable if allChecked is on
                          />
                        </label>

                        {option.allChecked && (
                          <div style={{ fontSize: 12, color: '#b33a3a', marginTop: 5 }}>
                            لا يمكنك تحديد حد أقصى للاختيارات عند تفعيل "اختيار الكل".
                          </div>
                        )}
                      </div>
                      {/* allCheck - let user mark all options as checked */}
                      <div className="all-checked-toggle" style={{ marginTop: 10 }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={option.allChecked || false}
                            onChange={(e) =>
                              handleAdvancedChange(index, 'allChecked', e.target.checked)
                            }
                          />
                          اختيار الكل افتراضياً
                        </label>
                      </div>
                    </div>
                    {/* limit option by size (like mansaf & salads limit) */}
                    <div className="limits-per-size" style={{ marginTop: 10, direction: 'rtl' }}>
                      <strong>حدد الحد الأقصى حسب الحجم:</strong>
                      {options.find(o => o.type === 'select')?.values?.map((size, sIndex) => (
                        <div key={sIndex} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 5 }}>
                          <span>{size.label?.ar || 'غير معروف'}</span>
                          <input style={{ width: 200 }}
                            type="number"
                            placeholder="كم خيار مسموح من فوق؟"
                            value={option.limitsBySelectValue?.[size.value] || ''}
                            onChange={(e) => {
                              const updated = [...options];
                              if (!updated[index].limitsBySelectValue) updated[index].limitsBySelectValue = {};
                              updated[index].limitsBySelectValue[size.value] = parseInt(e.target.value) || null;
                              onChange(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                )}


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
