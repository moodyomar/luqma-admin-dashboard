import OptionsEditor from './OptionsEditor';

const MealCard = ({ meal, categoryId, index, onChange, onDelete, expanded, onToggle, allMealsInCategory }) => {
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
    <div className="meal-card" style={{ border: '1px solid #ddd', borderRadius: 8, marginBottom: 8 }}>
      {/* Collapsed Header */}
      <div className="meal-header-collapsed" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        direction: 'rtl',
        textAlign: 'right',
        justifyContent: 'space-between',
        padding: '0 8px',
        minHeight: 56,
        position: 'relative',
      }}>
        {/* Drag handle (if present) */}
        {typeof meal.dragHandle === 'function' ? (
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {meal.dragHandle()}
          </div>
        ) : null}
        {/* Main content (clickable to toggle) */}
        <div
          onClick={onToggle}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '0 8px',
            cursor: 'pointer',
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontSize: 17 }}>{meal.name?.ar || '—'}</strong>
            <span style={{ fontSize: 18, color: '#888' }}>{expanded ? '⌃' : '⌄'}</span>
          </div>
          <span style={{ color: '#666', fontSize: 13 }}>₪{meal.price || '0'}</span>
        </div>
        {/* Image */}
        {meal.image && (
          <img src={meal.image} alt="meal" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', margin: '0 8px' }} />
        )}
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="meal-expanded-body" style={{ padding: 16 }}>
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

          <OptionsEditor
            options={meal?.options || []}
            onChange={handleOptionsChange}
            categoryId={categoryId}
            allMealsInCategory={allMealsInCategory}
          />

          <div className="meal-card-buttons" style={{ marginTop: 12 }}>
            <button
              onClick={onDelete}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: 6,
                marginTop: 4,
                cursor: 'pointer',
                backgroundColor: '#d9534f',
                color: '#fff',
              }}
            >
              حذف المنتج
            </button>

            {meal.available !== false && meal.available !== true ? (
              <p style={{ fontSize: 13, color: 'gray' }}>❓ بدون حالة</p>
            ) : (
              <button
                onClick={() =>
                  onChange({ ...meal, available: meal.available === false ? true : false })
                }
                style={{
                  backgroundColor: meal.available === false ? '#28a745' : '#1F1F1F',
                  color: 'white',
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: 6,
                  marginTop: 4,
                  cursor: 'pointer',
                  marginInlineStart: 8,
                }}
              >
                {meal.available === false ? 'اظهار المنتج' : 'اخفاء المنتج'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MealCard;