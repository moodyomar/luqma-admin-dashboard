import React, { useState } from 'react';

const CategoryManager = ({ categories = [], onChange }) => {
  const [form, setForm] = useState({ id: '', nameAr: '', nameHe: '', icon: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showHidden, setShowHidden] = useState(true);

  const handleInput = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ id: '', nameAr: '', nameHe: '', icon: '' });
    setIsEditing(false);
  };

  const handleAddOrUpdate = () => {
    const updated = [...categories];
    const index = updated.findIndex((c) => c.id === form.id);
    const newCategory = {
      id: form.id,
      icon: form.icon,
      name: { ar: form.nameAr, he: form.nameHe },
      hidden: false,
    };

    if (index >= 0) {
      updated[index] = { ...updated[index], ...newCategory };
    } else {
      updated.push(newCategory);
    }

    onChange(updated);
    resetForm();
  };

  const handleEdit = (cat) => {
    setForm({
      id: cat.id,
      nameAr: cat.name.ar,
      nameHe: cat.name.he,
      icon: cat.icon,
    });
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this category?')) {
      const updated = categories.filter((c) => c.id !== id);
      onChange(updated);
      resetForm();
    }
  };

  const handleHide = (id) => {
    const updated = categories.map((cat) =>
      cat.id === id ? { ...cat, hidden: !cat.hidden } : cat
    );
    onChange(updated);
  };

  const visibleCategories = showHidden ? categories : categories.filter((cat) => !cat.hidden);

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8, marginBottom: 130 }}>
      <div className="categoryAddWrapper">
        <h4>📂 הוספת קטגוריה חדשה</h4>
        <div className="row" >
          <input placeholder="שם קטגוריה בעברית" value={form.nameHe} onChange={(e) => handleInput('nameHe', e.target.value)} />
          <input placeholder="اسم القسم بالعربي" value={form.nameAr} onChange={(e) => handleInput('nameAr', e.target.value)} />
        </div>
        <div className="row" >
          <input placeholder="מזהה קטגוריה" value={form.id} onChange={(e) => handleInput('id', e.target.value)} disabled={isEditing} />
          <input placeholder="קישור תמונה" value={form.icon} onChange={(e) => handleInput('icon', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleAddOrUpdate}>
          {isEditing ? 'עדכון' : 'הוספת'} קטגוריה
        </button>
        {isEditing && (
          <button onClick={resetForm} style={{ marginLeft: 10 }}>
            ביטול
          </button>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          הצג גם קטגוריות מוסתרות
        </label>
      </div>

      <hr style={{ margin: '20px 0' }} />

      {visibleCategories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 10 }}>
          <div className="categoriesControlsWrapper">
            {cat.name.ar} | {cat.name.he}
            {cat.hidden && (
              <span style={{ marginRight: 8, color: 'gray', fontSize: 12 }}>מוסתרת</span>
            )}
            <div className="categoriesBtnsControl">
              <button onClick={() => handleEdit(cat)} style={{ marginRight: 10 }}>
                עריכה
              </button>
              <button onClick={() => handleHide(cat.id)} style={{ marginRight: 5, color: 'blue' }}>
                {cat.hidden ? 'הצג' : 'הסתר'}
              </button>
              <button onClick={() => handleDelete(cat.id)} style={{ marginRight: 5, color: 'red' }}>
                מחק
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryManager;
