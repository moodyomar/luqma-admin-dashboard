import OptionsEditor from './OptionsEditor';
import { FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';

const MealCard = ({ meal, categoryId, index, onChange, onDelete, expanded, onToggle, allMealsInCategory, dragHandle, onMoveCategory, categories, onChangeInstant }) => {
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
      <div
        className="meal-card-header"
        style={{
          background: meal.available === false ? '#f5f5f5' : '#fff',
          opacity: meal.available === false ? 0.5 : 1,
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
            <span style={{ fontSize: 18, color: '#888' }}>{expanded ? '⌃' : '⌄'}</span>
          </div>
          <span style={{ color: '#666', fontSize: 13 }}>₪{meal.price || '0'}</span>
        </div>
        {/* Drag and hide (eye) buttons grouped on the left (RTL) */}
        <div style={{ display: 'flex', alignItems: 'center'}}>
          {dragHandle ? (
            <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <button className="icon-square-btn" tabIndex={-1} style={{ border: 'none', background: 'none', boxShadow: 'none', cursor: 'grab' }}>
                {dragHandle()}
              </button>
            </div>
          ) : null}
          <button
            className="icon-square-btn eye"
            onClick={() => onChangeInstant
              ? onChangeInstant(categoryId, index, { ...meal, available: meal.available === false ? true : false })
              : onChange({ ...meal, available: meal.available === false ? true : false })
            }
            title={meal.available === false ? 'הצג מנה' : 'הסתר מנה'}
          >
            {meal.available === false ? <FiEyeOff /> : <FiEye />}
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
          {/* Modern meal settings row: 2 rows, 3 columns */}
          <div className="meal-settings-row">
            {/* Row 1 */}
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
            {/* Row 2 */}
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
            <input
              type="text"
              className="meal-settings-input"
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
        </div>
      )}
    </div>
  );
};

export default MealCard;