// File: src/components/OptionsEditor.jsx
import React, { useState, useLayoutEffect } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableOptionCard from './SortableOptionCard';
import SortableOptionValueRow from './SortableOptionValueRow';


const defaultLabels = {
  select: {
    ar: 'اختر الحجم',
    he: 'בחר גודל',
  },
  multi: {
    ar: 'اختار الإضافات',
    he: 'בחר תוספות',
  },
  input: {
    ar: 'اكتب طلبك هنا',
    he: 'כתוב כאן בקשה',
  },
};

const displayAsTypes = [
  { value: 'text', label: 'نص/كتابه' },
  { value: 'color', label: 'الوان' },
  // Future: { value: 'image', label: 'صورة' },
];

const OptionsEditor = ({ options = [], onChange, categoryId, allMealsInCategory, allMealsData, categories }) => {
  const [newOptionType, setNewOptionType] = useState('select');
  const [expandedOptions, setExpandedOptions] = useState({});
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isOptionsExpanded, setIsOptionsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  /**
   * Stable ids: _sortId on each option (admin-only), and value.value on each choice row for inner DnD.
   * _sortId is stripped on Firebase save; value.value is kept (required for cart / limits).
   */
  useLayoutEffect(() => {
    if (!options?.length) return;
    const needsSortId = options.some((o) => !o._sortId);
    const needsValueIds = options.some(
      (o) => Array.isArray(o.values) && o.values.some((v) => !v.value)
    );
    if (!needsSortId && !needsValueIds) return;
    onChange(
      options.map((opt, oidx) => {
        let o = opt;
        if (!o._sortId) {
          o = { ...o, _sortId: `opt_${Date.now()}_${oidx}_${Math.random().toString(36).slice(2, 11)}` };
        }
        if (Array.isArray(o.values) && o.values.some((v) => !v.value)) {
          o = {
            ...o,
            values: o.values.map((v, vi) =>
              v.value
                ? v
                : { ...v, value: `opt_val_${Date.now()}_${vi}_${Math.random().toString(36).slice(2, 11)}` }
            ),
          };
        }
        return o;
      })
    );
  }, [options, onChange]);

  const optionDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const innerValueDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleOptionsDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = options.findIndex((o) => o._sortId === active.id);
    const newIndex = options.findIndex((o) => o._sortId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(options, oldIndex, newIndex));
  };

  const handleOptionValuesDragEnd = (optionIndex) => (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const vals = [...(options[optionIndex]?.values || [])];
    const oldIndex = vals.findIndex((v) => String(v.value) === String(active.id));
    const newIndex = vals.findIndex((v) => String(v.value) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const updated = [...options];
    updated[optionIndex] = {
      ...updated[optionIndex],
      values: arrayMove(vals, oldIndex, newIndex),
    };
    onChange(updated);
  };

  const handleLabelChange = (index, lang, value) => {
    const updated = [...options];
    updated[index].label[lang] = value;
    onChange(updated);
  };

  const handleInputPlaceholderChange = (index, lang, value) => {
    const updated = [...options];
    if (!updated[index].inputPlaceholder) {
      updated[index].inputPlaceholder = { ar: '', he: '' };
    }
    updated[index].inputPlaceholder[lang] = value;
    onChange(updated);
  };

  const handleInputSettingChange = (index, field, value) => {
    const updated = [...options];
    updated[index][field] = value;
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

  const handleDisplayAsChange = (optionIndex, value) => {
    const updated = [...options];
    updated[optionIndex].displayAs = value;
    // If switching to color, remove image fields from values
    if (value === 'color') {
      updated[optionIndex].values = updated[optionIndex].values.map(val => ({
        ...val,
        color: val.color || '#000000', // default to black if not set
        image: undefined,
      }));
    } else {
      updated[optionIndex].values = updated[optionIndex].values.map(val => ({
        ...val,
        color: undefined,
      }));
    }
    onChange(updated);
  };

  const handleColorChange = (optionIndex, valueIndex, color) => {
    const updated = [...options];
    updated[optionIndex].values[valueIndex].color = color;
    onChange(updated);
  };

  const handleAddValue = (optionIndex) => {
    if (options[optionIndex]?.type === 'input') return;
    const updated = [...options];
    const option = updated[optionIndex];
    updated[optionIndex].values.push({
      label: { ar: '', he: '' },
      value: `opt_${Date.now()}`,
      extra: option.type === 'select' ? 0 : undefined,
      image: option.displayAs === 'color' ? undefined : '',
      color: option.displayAs === 'color' ? '#000000' : undefined,
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

  const handleAddOption = (type) => {
    const newOption = {
      _sortId: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type: type,
      label: {
        ar: '',
        he: '',
      },
      values: [],
      required: false,
      max: null,
      allChecked: false,
      limitsBySelectValue: {},
      displayAs: type === 'select' ? 'text' : type === 'multi' ? 'text' : undefined,
      inputPlaceholder: { ar: '', he: '' },
      inputMaxLength: 80,
    };
    if (type === 'input') {
      newOption.values = [];
    }
    onChange([...options, newOption]);
    setShowAddOptionModal(false);
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

  const toggleOption = (sortId) => {
    setExpandedOptions((prev) => ({
      ...prev,
      [sortId]: !prev[sortId],
    }));
  };

  const toggleAllOptions = () => {
    setIsOptionsExpanded(!isOptionsExpanded);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleCopyFromMeal = (sourceMeal) => {
    if (sourceMeal.options && sourceMeal.options.length > 0) {
      // Deep copy the options to ensure they are completely independent
      const deepCopiedOptions = sourceMeal.options.map((option, optIndex) => {
        // Generate unique timestamp for each option to ensure unique IDs
        const baseTimestamp = Date.now() + optIndex;
        
        return {
          ...option,
          _sortId: `opt_${baseTimestamp}_${optIndex}_${Math.random().toString(36).substr(2, 9)}`,
          displayAs: option.displayAs || 'text',
          // Deep copy label object
          label: {
            ar: option.label?.ar || '',
            he: option.label?.he || '',
          },
          // Deep copy inputPlaceholder if it exists
          inputPlaceholder: option.inputPlaceholder ? {
            ar: option.inputPlaceholder.ar || '',
            he: option.inputPlaceholder.he || '',
          } : { ar: '', he: '' },
          // Deep copy limitsBySelectValue if it exists
          limitsBySelectValue: option.limitsBySelectValue ? {
            ...Object.keys(option.limitsBySelectValue).reduce((acc, key) => {
              acc[key] = option.limitsBySelectValue[key];
              return acc;
            }, {})
          } : {},
          // Deep copy values array with new unique IDs
          values: option.values.map((value, valIndex) => ({
            ...value,
            // Generate new unique value ID using timestamp + random + indices
            value: `opt_${baseTimestamp}_${valIndex}_${Math.random().toString(36).substr(2, 9)}`,
            // Deep copy label object for each value
            label: {
              ar: value.label?.ar || '',
              he: value.label?.he || '',
            },
            // Copy primitive values
            extra: value.extra || (option.type === 'select' ? 0 : undefined),
            image: value.image || (option.displayAs === 'color' ? undefined : ''),
            color: value.color || (option.displayAs === 'color' ? '#000000' : undefined),
          }))
        };
      });
      onChange(deepCopiedOptions);
      setShowCopyModal(false);
    }
  };

  const handleSelectMeal = (meal) => {
    setSelectedMeal(meal);
    setSelectedOptions([]); // Reset selection
    setShowCopyModal(false);
    setShowOptionsModal(true);
  };

  const handleOptionToggle = (optionIndex) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionIndex)) {
        return prev.filter(i => i !== optionIndex);
      } else {
        return [...prev, optionIndex];
      }
    });
  };

  const handleCopySelectedOptions = () => {
    if (selectedOptions.length > 0 && selectedMeal) {
      // Deep copy the selected options to ensure they are completely independent
      const baseTimestamp = Date.now();
      const optionsToCopy = selectedOptions.map((selectedIndex, copyIndex) => {
        const option = selectedMeal.options[selectedIndex];
        // Generate unique timestamp for each option to ensure unique IDs
        const optionTimestamp = baseTimestamp + copyIndex;
        
        return {
          ...option,
          _sortId: `opt_${optionTimestamp}_${copyIndex}_${Math.random().toString(36).substr(2, 9)}`,
          displayAs: option.displayAs || 'text',
          // Deep copy label object
          label: {
            ar: option.label?.ar || '',
            he: option.label?.he || '',
          },
          // Deep copy inputPlaceholder if it exists
          inputPlaceholder: option.inputPlaceholder ? {
            ar: option.inputPlaceholder.ar || '',
            he: option.inputPlaceholder.he || '',
          } : { ar: '', he: '' },
          // Deep copy limitsBySelectValue if it exists
          limitsBySelectValue: option.limitsBySelectValue ? {
            ...Object.keys(option.limitsBySelectValue).reduce((acc, key) => {
              acc[key] = option.limitsBySelectValue[key];
              return acc;
            }, {})
          } : {},
          // Deep copy values array with new unique IDs
          values: option.values.map((value, valIndex) => ({
            ...value,
            // Generate new unique value ID using timestamp + random + indices
            value: `opt_${optionTimestamp}_${valIndex}_${Math.random().toString(36).substr(2, 9)}`,
            // Deep copy label object for each value
            label: {
              ar: value.label?.ar || '',
              he: value.label?.he || '',
            },
            // Copy primitive values
            extra: value.extra || (option.type === 'select' ? 0 : undefined),
            image: value.image || (option.displayAs === 'color' ? undefined : ''),
            color: value.color || (option.displayAs === 'color' ? '#000000' : undefined),
          }))
        };
      });
      const newOptions = [...options, ...optionsToCopy];
      onChange(newOptions);
      setShowOptionsModal(false);
      setSelectedMeal(null);
      setSelectedOptions([]);
    }
  };

  const handleSelectAllOptions = () => {
    if (selectedMeal && selectedMeal.options) {
      setSelectedOptions(selectedMeal.options.map((_, index) => index));
    }
  };

  const handleDeselectAllOptions = () => {
    setSelectedOptions([]);
  };

  return (
    <div className="options-editor">
      <hr style={{ 
        border: 'none', 
        height: '1px', 
        background: 'linear-gradient(to right, transparent, #ddd, transparent)', 
        margin: '16px 0' 
      }} />
      
      <div style={{ marginBottom: 16 }}>
        <h3 
          style={{ 
            direction: 'rtl', 
            margin: 0, 
            marginBottom: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
          onClick={toggleAllOptions}
        >
          <span>{isOptionsExpanded ? '🔽' : '➕'}</span>
          الإضافات والخيارات
          {options.length > 0 && (
            <span style={{
              fontSize: 13,
              backgroundColor: '#28a745',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 600,
              minWidth: 24,
              textAlign: 'center'
            }}>
              {options.length}
            </span>
          )}
        </h3>
        
        {isOptionsExpanded && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowCopyModal(true)}
              style={{
                backgroundColor: '#17a2b8',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              نسخ اضافات
            </button>
            <button
              onClick={() => setShowAddOptionModal(true)}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              إضافة خيار جديد
            </button>
          </div>
        )}
        {isOptionsExpanded && options.length > 1 && (
          <p
            style={{
              fontSize: 12,
              color: '#666',
              margin: '10px 0 4px',
              direction: 'rtl',
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            ⋮⋮ اسحب المقبض لإعادة ترتيب الإضافات — نفس الترتيب يظهر للزبون في التطبيق.
          </p>
        )}
      </div>

      {isOptionsExpanded && (
        <>
          {/* Copy Modal - Select Meal */}
          {showCopyModal && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}
              onClick={() => setShowCopyModal(false)}
            >
              <div 
                style={{
                  background: '#fff',
                  padding: 24,
                  borderRadius: 12,
                  maxWidth: 600,
                  maxHeight: '80vh',
                  overflow: 'auto',
                  direction: 'rtl'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>اختر وجبة لنسخ الإضافات منها</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    // Get all meals with options from all categories
                    const allMealsWithOptions = [];
                    
                    if (allMealsData && categories) {
                      // Group meals by category
                      categories.forEach(category => {
                        const categoryMeals = allMealsData[category.id] || [];
                        const mealsWithOptions = categoryMeals.filter(meal => meal.options && meal.options.length > 0);
                        
                        if (mealsWithOptions.length > 0) {
                          allMealsWithOptions.push({
                            category,
                            meals: mealsWithOptions
                          });
                        }
                      });
                    }

                    if (allMealsWithOptions.length === 0) {
                      return (
                        <div style={{
                          padding: '24px 16px',
                          textAlign: 'center',
                          background: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: 8,
                          color: '#6c757d'
                        }}>
                          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                            لا توجد وجبات مع إضافات للنسخ
                          </div>
                          <div style={{ fontSize: 14 }}>
                            أضف أول وجبة مع إضافات لنسخها مستقبلاً
                          </div>
                        </div>
                      );
                    }

                    return allMealsWithOptions.map(({ category, meals }) => {
                      const isExpanded = expandedCategories[category.id] === true; // Default to collapsed
                      
                      return (
                        <div key={category.id} style={{ marginBottom: 8 }}>
                          <div 
                            onClick={() => toggleCategory(category.id)}
                            style={{ 
                              fontSize: 15, 
                              fontWeight: 600, 
                              marginBottom: 8,
                              color: '#007bff',
                              padding: '8px 12px',
                              background: '#e7f3ff',
                              borderRadius: 6,
                              borderRight: '4px solid #007bff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s ease',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#d0e7ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#e7f3ff';
                            }}
                          >
                            <span>{category.name?.ar || category.name?.he || 'قسم'}</span>
                            <span style={{ 
                              fontSize: 18, 
                              transition: 'transform 0.2s ease',
                              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                            }}>
                              ▼
                            </span>
                          </div>
                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 8 }}>
                              {meals.map((meal, index) => (
                                <button
                                  key={meal.id || index}
                                  onClick={() => handleSelectMeal(meal)}
                                  style={{
                                    padding: '12px 16px',
                                    border: '1px solid #ddd',
                                    borderRadius: 8,
                                    background: '#f8f9fa',
                                    cursor: 'pointer',
                                    textAlign: 'right',
                                    fontSize: 14,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#e9ecef';
                                    e.currentTarget.style.borderColor = '#adb5bd';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f8f9fa';
                                    e.currentTarget.style.borderColor = '#ddd';
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                    {meal.name?.ar || meal.name?.he || 'وجبة بدون اسم'}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    {meal.options?.length || 0} إضافات متاحة
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                  <button
                    onClick={() => setShowCopyModal(false)}
                    style={{
                      padding: '10px 24px',
                      border: '1px solid #dc3545',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      minWidth: 100
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#dc3545';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fff';
                      e.target.style.color = '#dc3545';
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Option Type Modal */}
          {showAddOptionModal && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}
              onClick={() => setShowAddOptionModal(false)}
            >
              <div 
                style={{
                  background: '#fff',
                  padding: 32,
                  borderRadius: 12,
                  maxWidth: 400,
                  direction: 'rtl',
                  textAlign: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: 24 }}>اختر نوع الإضافة</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  <button
                    onClick={() => handleAddOption('select')}
                    style={{
                      padding: '16px 24px',
                      border: '2px solid #007bff',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#007bff',
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#007bff';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fff';
                      e.target.style.color = '#007bff';
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>اختيار واحد</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>مثل: الحجم، النوع</div>
                  </button>
                  
                  <button
                    onClick={() => handleAddOption('multi')}
                    style={{
                      padding: '16px 24px',
                      border: '2px solid #28a745',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#28a745',
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#28a745';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fff';
                      e.target.style.color = '#28a745';
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>متعدد الاختيارات</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>مثل: الإضافات، التوابل</div>
                  </button>
                  
                  <button
                    onClick={() => handleAddOption('input')}
                    style={{
                      padding: '16px 24px',
                      border: '2px solid #ff9800',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#ff9800',
                      cursor: 'pointer',
                      fontSize: 16,
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#ff9800';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fff';
                      e.target.style.color = '#ff9800';
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>حقل نصّي</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>مثل: كتابة اسم أو ملاحظة</div>
                  </button>
                </div>

                <button
                  onClick={() => setShowAddOptionModal(false)}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid #6c757d',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#6c757d',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#6c757d';
                    e.target.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#fff';
                    e.target.style.color = '#6c757d';
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Options Selection Modal */}
          {showOptionsModal && selectedMeal && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1001
              }}
              onClick={() => {
                setShowOptionsModal(false);
                setSelectedMeal(null);
                setSelectedOptions([]);
              }}
            >
              <div 
                style={{
                  background: '#fff',
                  padding: 24,
                  borderRadius: 12,
                  maxWidth: 600,
                  maxHeight: 500,
                  overflow: 'auto',
                  direction: 'rtl'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>
                  اختر الإضافات من: {selectedMeal.name?.ar || selectedMeal.name?.he || 'وجبة بدون اسم'}
                </h3>
                
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={handleSelectAllOptions}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#218838';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#28a745';
                    }}
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={handleDeselectAllOptions}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#5a6268';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#6c757d';
                    }}
                  >
                    إلغاء التحديد
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedMeal.options?.map((option, index) => (
                    <div key={index} style={{
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 12,
                      background: selectedOptions.includes(index) ? '#e3f2fd' : '#fff',
                      transition: 'all 0.2s ease'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(index)}
                          onChange={() => handleOptionToggle(index)}
                          style={{ width: 18, height: 18 }}
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            {option.label?.ar || option.label?.he || 'خيار بدون اسم'}
                          </div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {option.values?.length || 0} قيم متاحة
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                  <button
                    onClick={handleCopySelectedOptions}
                    disabled={selectedOptions.length === 0}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: selectedOptions.length > 0 ? '#28a745' : '#ccc',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      minWidth: 120
                    }}
                    onMouseEnter={(e) => {
                      if (selectedOptions.length > 0) {
                        e.target.style.backgroundColor = '#218838';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedOptions.length > 0) {
                        e.target.style.backgroundColor = '#28a745';
                      }
                    }}
                  >
                    نسخ المحدد ({selectedOptions.length})
                  </button>
                  <button
                    onClick={() => {
                      setShowOptionsModal(false);
                      setSelectedMeal(null);
                      setSelectedOptions([]);
                    }}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #dc3545',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      minWidth: 100
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#dc3545';
                      e.target.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#fff';
                      e.target.style.color = '#dc3545';
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          <DndContext
            sensors={optionDragSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleOptionsDragEnd}
          >
            <SortableContext
              items={options.map((o, i) => o._sortId || `pending-${i}`)}
              strategy={verticalListSortingStrategy}
            >
          {options.map((option, index) => (
            <SortableOptionCard
              key={option._sortId || `pending-${index}`}
              id={option._sortId || `pending-${index}`}
            >
              <div className="option-header">
                <strong>نوع الاضافه:</strong>{' '}
                <span style={{ color: 'green', fontWeight: '700' }}>
                  {option.type === 'multi'
                    ? 'خيارات متعدده'
                    : option.type === 'input'
                      ? 'حقل نصّي'
                      : 'خيار واحد'}
                </span>
                {option.type !== 'input' && (
                  <span style={{ marginInlineStart: 12 }}>
                    <label style={{ fontWeight: 500 }}>
                      <span style={{ marginInlineEnd: 4 }}>عرض كـ:</span>
                      <select
                        value={option.displayAs || 'text'}
                        onChange={e => handleDisplayAsChange(index, e.target.value)}
                        style={{ padding: '2px 4px',width: '115px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                      >
                        {displayAsTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </label>
                  </span>
                )}
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
                  בחר השאלה שתופיע ללקוח
                  <input
                    value={option.label?.he || defaultLabels[option.type]?.he}
                    onChange={(e) => handleLabelChange(index, 'he', e.target.value)}
                  />
                </label>
              </div>

              <div className="option-wrapper" style={{ marginBottom: 0 }}>
                {option.type !== 'input' ? (
                  <>
                    <div className="btn-row-right">
                      <button
                        type="button"
                        onClick={() => toggleOption(option._sortId || `pending-${index}`)}
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
                        {expandedOptions[option._sortId || `pending-${index}`]
                          ? '🔽 إخفاء الإضافات'
                          : '➕ عرض الإضافات'}
                      </button>
                      <div className="required-extra-label" style={{ marginTop: 8 }}>
                        <label>
                          <span style={{ marginInlineStart: 6 }}>خيار أجباري</span>
                          <input
                            type="checkbox"
                            checked={option.required || false}
                            onChange={(e) => {
                              handleAdvancedChange(index, 'required', e.target.checked);
                            }} />
                        </label>
                      </div>
                    </div>

                    {expandedOptions[option._sortId || `pending-${index}`] && (
                      <div className="option-values">
                        <strong style={{ direction: 'rtl' }}>الاضافات | האפשריות</strong>
                        {(option.values || []).length > 1 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#888',
                              marginTop: 6,
                              marginBottom: 4,
                              direction: 'rtl',
                            }}
                          >
                            ⋮⋮ اسحب المقبض لترتيب الصفوف — نفس الترتيب في التطبيق.
                          </div>
                        )}

                        <DndContext
                          sensors={innerValueDragSensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleOptionValuesDragEnd(index)}
                        >
                          <SortableContext
                            items={(option.values || []).map((v) => String(v.value))}
                            strategy={verticalListSortingStrategy}
                          >
                            {(option.values || []).map((val, valIndex) => (
                              <SortableOptionValueRow key={val.value} id={String(val.value)}>
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
                                {option.displayAs === 'color' ? (
                                  <>
                                    <input
                                      type="color"
                                      value={val.color || '#000000'}
                                      onChange={(e) => handleColorChange(index, valIndex, e.target.value)}
                                      style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
                                      title="اختر اللون"
                                    />
                                    <span style={{ width: 60, fontSize: 12, color: '#555' }}>{val.color || '#000000'}</span>
                                  </>
                                ) : (
                                  <input
                                    style={{ minWidth: 85 }}
                                    type="url"
                                    placeholder="رابط الصورة"
                                    value={val.image || ''}
                                    onChange={(e) => handleImageChange(index, valIndex, e.target.value)}
                                  />
                                )}
                                <input
                                  style={{ maxWidth: 100, minWidth: 70, width: 100 }}
                                  type="number"
                                  placeholder="كم زياده؟"
                                  value={val.extra || 0}
                                  onChange={(e) => handleExtraChange(index, valIndex, e.target.value)}
                                />
                                <button
                                  type="button"
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
                              </SortableOptionValueRow>
                            ))}
                          </SortableContext>
                        </DndContext>

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
                  </>
                ) : (
                  <div className="option-values" style={{ direction: 'rtl' }}>
                    <div className="required-extra-label" style={{ marginBottom: 12 }}>
                      <label>
                        <span style={{ marginInlineStart: 6 }}>الحقل مطلوب؟</span>
                        <input
                          type="checkbox"
                          checked={option.required || false}
                          onChange={(e) => {
                            handleAdvancedChange(index, 'required', e.target.checked);
                          }} />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <input
                        style={{ flex: 1 }}
                        placeholder="Placeholder بالعربي (مثلاً: اكتب الاسم هنا)"
                        value={option.inputPlaceholder?.ar || ''}
                        onChange={(e) => handleInputPlaceholderChange(index, 'ar', e.target.value)}
                      />
                      <input
                        style={{ flex: 1 }}
                        placeholder="Placeholder בעברית"
                        value={option.inputPlaceholder?.he || ''}
                        onChange={(e) => handleInputPlaceholderChange(index, 'he', e.target.value)}
                      />
                    </div>
                    <div style={{ maxWidth: 200, marginBottom: 12 }}>
                      <label>
                        طول النص المسموح (حروف):
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={option.inputMaxLength || ''}
                          onChange={(e) =>
                            handleInputSettingChange(
                              index,
                              'inputMaxLength',
                              e.target.value ? Math.min(200, Math.max(1, parseInt(e.target.value))) : null
                            )
                          }
                        />
                      </label>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      سيظهر هذا الحقل للمستخدم ليكتب أي نص يحتاجه (مثل كتابة اسم على الكيكة أو ملاحظة خاصة).
                    </div>
                  </div>
                )}
              </div>
            </SortableOptionCard>
          ))}
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
};

export default OptionsEditor;
