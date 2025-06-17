import React, { useState } from 'react';

const NewMealForm = ({ categoryId, onAdd }) => {
  const [form, setForm] = useState({
    nameAr: '',
    nameHe: '',
    price: '',
    descAr: '',
    descHe: '',
    image: '',
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value.trimStart() }));
  };

  const handleSubmit = () => {
    if (!form.nameAr || !form.nameHe || !form.price) {
      alert('Please fill at least name and price');
      return;
    }

    const newMeal = {
      id: `m_${Date.now()}`, // or generateSlug(form.nameAr)
      name: { ar: form.nameAr, he: form.nameHe },
      price: form.price,
      description: { ar: form.descAr || '', he: form.descHe || '' },
      image: form.image || '',
    };

    onAdd(categoryId, newMeal);
    setForm({ nameAr: '', nameHe: '', price: '', descAr: '', descHe: '', image: '' });
  };

  return (
    <div style={{ marginTop: 20, padding: 10, borderTop: '1px dashed #999' }}>
      <h4>Add New Meal to <strong>{categoryId}</strong></h4>

      <input placeholder="Arabic Name" value={form.nameAr} onChange={(e) => handleChange('nameAr', e.target.value)} />
      <input placeholder="Hebrew Name" value={form.nameHe} onChange={(e) => handleChange('nameHe', e.target.value)} />
      <input placeholder="Price" value={form.price} onChange={(e) => handleChange('price', e.target.value)} />
      <input placeholder="Arabic Description" value={form.descAr} onChange={(e) => handleChange('descAr', e.target.value)} />
      <input placeholder="Hebrew Description" value={form.descHe} onChange={(e) => handleChange('descHe', e.target.value)} />
      <input placeholder="Image URL" value={form.image} onChange={(e) => handleChange('image', e.target.value)} />

      <button onClick={handleSubmit} style={{ marginTop: 8 }}>Add Meal</button>
    </div>
  );
};

export default NewMealForm;
