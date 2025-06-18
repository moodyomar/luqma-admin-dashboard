import React, { useState } from 'react';

const CategoryManager = ({ categories, onChange }) => {
  const [form, setForm] = useState({ id: '', nameAr: '', nameHe: '', icon: '' });
  const [isEditing, setIsEditing] = useState(false);

  const handleInput = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ id: '', nameAr: '', nameHe: '', icon: '' });
    setIsEditing(false);
  };

  const handleAddOrUpdate = () => {
    const updated = [...(Array.isArray(categories) ? categories : [])];
    const index = updated.findIndex((c) => c.id === form.id);
    const newCategory = {
      id: form.id,
      icon: form.icon,
      name: { ar: form.nameAr, he: form.nameHe },
    };

    if (index >= 0) updated[index] = newCategory;
    else updated.push(newCategory);

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

  const safeCategories = categories || [];

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8, marginBottom: 30 }}>
      <h4>📂 ניהול קטגוריות</h4>
      <input placeholder="מזהה קטגוריה" value={form.id} onChange={(e) => handleInput('id', e.target.value)} disabled={isEditing} />
      <input placeholder="اسم القسم بالعربي" value={form.nameAr} onChange={(e) => handleInput('nameAr', e.target.value)} />
      <input placeholder="שם קטגוריה בעברית" value={form.nameHe} onChange={(e) => handleInput('nameHe', e.target.value)} />
      <input placeholder="קישור תמונה" value={form.icon} onChange={(e) => handleInput('icon', e.target.value)} />

      <div style={{ marginTop: 10 }}>
        <button onClick={handleAddOrUpdate}>{isEditing ? 'עדכון' : 'הוספת'} קטגוריה</button>
        {isEditing && <button onClick={resetForm} style={{ marginLeft: 10 }}>Cancel</button>}
      </div>

      <hr style={{ margin: '20px 0' }} />

      {safeCategories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 10 }}>
          <div className='categoriesControlsWrapper'>
            <strong>{cat.id}</strong> - {cat.name.ar} | {cat.name.he}
            <div className="categoriesBtnsControl">
              <button onClick={() => handleEdit(cat)} style={{ marginRight: 10 }}>עריכה</button>
              <button onClick={() => handleDelete(cat.id)} style={{ marginRight: 5, color: 'red' }}>מחיקה</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryManager;
