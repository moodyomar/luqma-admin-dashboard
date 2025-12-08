import OptionsEditor from './OptionsEditor';
import { FiTrash2, FiEye, FiEyeOff, FiCopy, FiChevronDown, FiChevronUp, FiImage } from 'react-icons/fi';
import { useState } from 'react';
import HideMealModal from './HideMealModal';

const MealCard = ({ meal, categoryId, index, onChange, onDelete, expanded, onToggle, allMealsInCategory, allMealsData, dragHandle, onMoveCategory, categories, onChangeInstant, onDuplicate, onHideUntilTomorrow, onMarkUnavailable }) => {
  const [imagesExpanded, setImagesExpanded] = useState(false);
  const [showHideModal, setShowHideModal] = useState(false);

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

  // Check if any images are set
  const hasImages = meal?.image || meal?.image2 || meal?.image3;

  return (
    <div className="meal-card" style={{ border: '1px solid #ddd', borderRadius: 8, marginBottom: 8 }}>
      {/* Collapsed Header */}
      <div
        className="meal-card-header"
        style={{
          background: meal.available === false || meal.unavailable === true ? '#f5f5f5' : '#fff',
          opacity: meal.available === false || meal.unavailable === true ? 0.5 : 1,
          transition: 'all 0.2s',
        display: 'flex',
          flexDirection: 'row-reverse', // RTL: image right, buttons left
        alignItems: 'center',
        justifyContent: 'space-between',
          borderRadius: 10,
          boxShadow: '0 1px 3px #eee',
          padding: '6px 10px',
        minHeight: 56,
        }}
      >
        {/* Meal image at the far right (RTL) */}
        {meal.image && (
          <img src={meal.image} alt="meal" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', margin: '0 6px 0 0' }} />
        )}
        {/* Centered text block */}
        <div
          onClick={onToggle}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            textAlign: 'center',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <strong style={{ fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{meal.name?.ar || '—'}</strong>
            {meal.preorderHours && (
              <span style={{ 
                fontSize: 11, 
                background: '#ff9800', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: 4,
                fontWeight: 600
              }}>
                ⏰ {meal.preorderHours}h
              </span>
            )}
            {meal.unavailable === true && (
              <span style={{ 
                fontSize: 10, 
                background: '#9e9e9e', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: 4,
                fontWeight: 600
              }} title="غير متاح - يظهر لكن لا يمكن طلبه">
                ⚠️
              </span>
            )}
            {meal.hideUntil && meal.available === false && (
              <span style={{ 
                fontSize: 10, 
                background: '#4CAF50', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: 4,
                fontWeight: 600
              }} title="سيتم إظهاره تلقائياً غداً الساعة 7 صباحاً">
                🔄
              </span>
            )}
            <span style={{ fontSize: 18, color: '#888' }}>{expanded ? '⌃' : '⌄'}</span>
          </div>
          <span style={{ color: '#666', fontSize: 13 }}>₪{meal.price || '0'}</span>
        </div>
        {/* Drag and hide (eye) buttons grouped on the left (RTL) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {dragHandle ? (
            <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <button className="icon-square-btn" tabIndex={-1} style={{ border: 'none', background: 'none', boxShadow: 'none', cursor: 'grab' }}>
                {dragHandle()}
              </button>
            </div>
          ) : null}
          <button
            className="icon-square-btn eye"
            onClick={() => {
              // If unhiding (available is false or unavailable is true), do it directly
              if (meal.available === false || meal.unavailable === true) {
                const updated = { ...meal, available: true };
                // Remove hideUntil and unavailable if they exist
                if (updated.hideUntil) {
                  delete updated.hideUntil;
                }
                if (updated.unavailable) {
                  delete updated.unavailable;
                }
                if (onChangeInstant) {
                  onChangeInstant(categoryId, index, updated);
                } else {
                  onChange(updated);
                }
              } else {
                // If hiding, show modal
                setShowHideModal(true);
              }
            }}
            title={meal.available === false || meal.unavailable === true ? 'הצג מנה' : 'הסתר מנה'}
          >
            {meal.available === false || meal.unavailable === true ? <FiEyeOff /> : <FiEye />}
          </button>
          <button
            className="icon-square-btn"
            onClick={() => onDuplicate && onDuplicate(meal, index)}
            title="שכפל מנה"
            style={{ color: '#007bff' }}
          >
            <FiCopy />
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="meal-expanded-body" style={{ padding: '8px 0 0 0', border: 'none', background: 'none', boxShadow: 'none', margin: 0 }}>
          {/* Category select and options header row */}
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', direction: 'rtl', marginBottom: 12, gap: 12 }}>
            {/* Options header (collapsible) */}
            <h3 
              style={{ 
                direction: 'rtl', 
                margin: 0, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onClick={() => {
                // If OptionsEditor exposes toggleAllOptions, call it via ref or prop
                // For now, just a placeholder
              }}
            >
              <span>الاعدادات:</span>
            </h3>
            {/* Move to category select and delete button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {categories && categories.length > 1 && (
                <select
                  value={categoryId}
                  onChange={e => onMoveCategory && onMoveCategory(e.target.value)}
                  style={{
                    minWidth: 90,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    background: '#fafbfc',
                    fontSize: 14,
                    direction: 'rtl',
                    color: '#333',
                    marginRight: 4,
                    cursor: 'pointer',
                  }}
                  title="העבר קטגוריה"
                >
                  <option value={categoryId} disabled>
                    انقل لقسم اخر
                  </option>
                  {categories.filter(c => c.id !== categoryId).map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name?.ar || cat.name?.he ||  'קטגוריה'}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="icon-square-btn trash"
                onClick={onDelete}
                title="מחק מנה"
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
          {/* Compact meal settings: Name, Price, Description */}
          <div className="meal-settings-row">
            {/* Row 1: Name (AR/HE) + Price */}
            <input
              type="text"
              className="meal-settings-input"
              placeholder="اسم المنتج بالعربي"
              value={meal?.name?.ar || ''}
              onChange={(e) => handleFieldChange('name', 'ar', e.target.value)}
            />
            <input
              type="text"
              className="meal-settings-input"
              placeholder="שם המוצר בעברית"
              value={meal?.name?.he || ''}
              onChange={(e) => handleFieldChange('name', 'he', e.target.value)}
            />
            <input
              type="text"
              className="meal-settings-price-input"
              placeholder="המחיר | السعر"
              value={meal?.price || ''}
              onChange={(e) => handleFieldChange('price', null, e.target.value)}
            />
            {/* Row 2: Description (AR/HE) */}
            <input
              type="text"
              className="meal-settings-input"
              placeholder="الوصف بالعربي"
              value={meal?.description?.ar || ''}
              onChange={(e) => handleFieldChange('description', 'ar', e.target.value)}
            />
            <input
              type="text"
              className="meal-settings-input"
              placeholder="התיאור בעברית"
              value={meal?.description?.he || ''}
              onChange={(e) => handleFieldChange('description', 'he', e.target.value)}
            />
            {/* Row 3: Preorder Hours */}
            <input
              type="number"
              className="meal-settings-input"
              placeholder="ساعات الطلب المسبق | שעות הזמנה מראש"
              value={meal?.preorderHours || ''}
              onChange={(e) => {
                const value = e.target.value;
                const updated = { ...meal };
                if (value === '' || value === '0') {
                  delete updated.preorderHours;
                } else if (!isNaN(value) && Number(value) > 0) {
                  updated.preorderHours = Number(value);
                }
                onChange(updated);
              }}
              style={{ gridColumn: '1 / -1' }}
            />
          </div>

          {/* Collapsible Images Section */}
          <div style={{
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            marginBottom: 12,
            backgroundColor: '#fafafa',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
          }}>
            <button
              onClick={() => setImagesExpanded(!imagesExpanded)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                direction: 'rtl',
                fontSize: 14,
                fontWeight: 600,
                color: '#333',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiImage style={{ fontSize: 16, color: '#666' }} />
                <span>إضافة الصور | הוספת תמונות</span>
                {hasImages && (
                  <span style={{
                    fontSize: 11,
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontWeight: 500
                  }}>
                    {[meal?.image, meal?.image2, meal?.image3].filter(Boolean).length}
                  </span>
                )}
              </div>
              {imagesExpanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>
            
            {imagesExpanded && (
              <div style={{
                padding: '12px 14px',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                backgroundColor: '#fff'
              }}>
                <input
                  type="text"
                  className="meal-settings-input"
                  placeholder="קישור תמונה ראשית | رابط الصورة الرئيسية"
                  value={meal?.image || ''}
                  onChange={(e) => handleFieldChange('image', null, e.target.value)}
                  style={{ width: '100%', margin: 0 }}
                />
                <input
                  type="text"
                  className="meal-settings-input"
                  placeholder="קישור תמונה שנייה (אופציונלי) | رابط الصورة الثانية (اختياري)"
                  value={meal?.image2 || ''}
                  onChange={(e) => handleFieldChange('image2', null, e.target.value)}
                  style={{ width: '100%', margin: 0 }}
                />
                <input
                  type="text"
                  className="meal-settings-input"
                  placeholder="קישור תמונה שלישית (אופציונלי) | رابط الصورة الثالثة (اختياري)"
                  value={meal?.image3 || ''}
                  onChange={(e) => handleFieldChange('image3', null, e.target.value)}
                  style={{ width: '100%', margin: 0 }}
                />
              </div>
            )}
          </div>
          {meal?.preorderHours && (
            <p style={{ fontSize: 12, color: '#ff9800', margin: '4px 0', textAlign: 'center', fontWeight: 600 }}>
              ⏰ يحتاج طلب مسبق {meal.preorderHours} ساعات | דורש הזמנה מראש {meal.preorderHours} שעות
            </p>
          )}

          <OptionsEditor
            options={meal?.options || []}
            onChange={handleOptionsChange}
            categoryId={categoryId}
            allMealsInCategory={allMealsInCategory}
            allMealsData={allMealsData}
            categories={categories}
          />
        </div>
      )}

      {/* Hide Meal Modal */}
      <HideMealModal
        visible={showHideModal}
        onClose={() => setShowHideModal(false)}
        mealName={meal.name?.ar || meal.name?.he || ''}
        onMarkUnavailable={async () => {
          setShowHideModal(false); // Close modal first
          if (onMarkUnavailable) {
            try {
              const mealId = meal.id || meal.uid || `temp_${Date.now()}`;
              console.log('🔄 [MealCard] Calling onMarkUnavailable with:', { categoryId, mealId, mealName: meal.name?.ar });
              await onMarkUnavailable(categoryId, mealId, meal);
            } catch (error) {
              console.error('❌ [MealCard] Error marking meal as unavailable:', error);
            }
          } else {
            console.warn('⚠️ [MealCard] onMarkUnavailable prop not provided');
            // Fallback if onMarkUnavailable not provided
            const updated = { ...meal, unavailable: true, available: true };
            // Remove hideUntil if it exists
            if (updated.hideUntil) {
              delete updated.hideUntil;
            }
            if (onChangeInstant) {
              try {
                await onChangeInstant(categoryId, meal.id, updated);
              } catch (error) {
                console.error('Error updating meal:', error);
              }
            } else {
              onChange(updated);
            }
          }
        }}
        onHidePermanent={() => {
          const updated = { ...meal, available: false };
          // Remove hideUntil and unavailable if they exist (permanent hide)
          if (updated.hideUntil) {
            delete updated.hideUntil;
          }
          if (updated.unavailable) {
            delete updated.unavailable;
          }
          if (onChangeInstant) {
            onChangeInstant(categoryId, index, updated);
          } else {
            onChange(updated);
          }
        }}
        onHideUntilTomorrow={() => {
          if (onHideUntilTomorrow) {
            onHideUntilTomorrow(categoryId, index, meal);
          } else {
            // Fallback if onHideUntilTomorrow not provided
            const updated = { ...meal, available: false };
            // Remove unavailable flag when hiding
            if (updated.unavailable) {
              delete updated.unavailable;
            }
            if (onChangeInstant) {
              onChangeInstant(categoryId, index, updated);
            } else {
              onChange(updated);
            }
          }
        }}
      />
    </div>
  );
};

export default MealCard;