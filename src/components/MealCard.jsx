import React from 'react';

const MealCard = ({ meal, onChange, onDelete }) => {
  const handleField = (field, lang, value) => {
    const trimmed = value.trimStart();
    const updated = { ...meal };

    if (field === 'name' || field === 'description') {
      updated[field][lang] = trimmed;
    } else {
      updated[field] = trimmed;
    }

    onChange(updated);
  };

  return (
    <div style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8, marginBottom: 10 }}>
      <input
        type="text"
        value={meal.name.ar}
        onChange={(e) => handleField('name', 'ar', e.target.value)}
        placeholder="Arabic Name"
      />
      <input
        type="text"
        value={meal.name.he}
        onChange={(e) => handleField('name', 'he', e.target.value)}
        placeholder="Hebrew Name"
      />
      <input
        type="text"
        value={meal.price}
        onChange={(e) => handleField('price', null, e.target.value)}
        placeholder="Price"
      />
      <input
        type="text"
        value={meal.description?.ar || ''}
        onChange={(e) => handleField('description', 'ar', e.target.value)}
        placeholder="Arabic Description"
      />
      <input
        type="text"
        value={meal.description?.he || ''}
        onChange={(e) => handleField('description', 'he', e.target.value)}
        placeholder="Hebrew Description"
      />
      <input
        type="text"
        value={meal.image || ''}
        onChange={(e) => handleField('image', null, e.target.value)}
        placeholder="Image URL"
      />

      {meal.image && (
        <img src={meal.image} alt="" style={{ width: 100, marginTop: 8 }} />
      )}

      <button
        onClick={onDelete}
        style={{
          marginTop: 10,
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 4,
        }}
      >
        Delete
      </button>
    </div>
  );
};

export default MealCard;
