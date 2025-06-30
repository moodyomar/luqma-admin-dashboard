import OptionsEditor from './OptionsEditor';
import { FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';

const MealCard = ({ meal, categoryId, index, onChange, onDelete, expanded, onToggle, allMealsInCategory, dragHandle, onMoveCategory, categories }) => {
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
        textAlign: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        minHeight: 56,
        position: 'relative',
      }}>
        {/* Drag handle (if present) */}
        {dragHandle ? (
          <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dragHandle()}
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
              <span>تفاصيل واعدادات المنتج</span>
            </h3>
            {/* Icon buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={onDelete}
                title="حذف المنتج"
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 20,
                  transition: 'background 0.2s',
                  padding: 0,
                }}
              >
                <FiTrash2 />
              </button>
              <button
                onClick={() =>
                  onChange({ ...meal, available: meal.available === false ? true : false })
                }
                title={meal.available === false ? 'اظهار المنتج' : 'اخفاء المنتج'}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: meal.available !== false ? '#28a745' : '#222',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 20,
                  transition: 'background 0.2s',
                  padding: 0,
                }}
              >
                {meal.available !== false ? <FiEye /> : <FiEyeOff />}
              </button>
            </div>
          </div>
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
        </div>
      )}
    </div>
  );
};

export default MealCard;