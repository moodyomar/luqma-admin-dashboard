import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import SortableCategoryCard from '../components/SortableCategoryCard'
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';


const CategoryManager = ({ categories = [], onChange }) => {
  const [form, setForm] = useState({ id: '', nameAr: '', nameHe: '', icon: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showHidden, setShowHidden] = useState(true);
  const [isOpen,setIsOpen] = useState(false);

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

const handleDragEnd = async (event) => {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const oldIndex = categories.findIndex((cat) => cat.id === active.id);
  const newIndex = categories.findIndex((cat) => cat.id === over.id);

  const reordered = arrayMove(categories, oldIndex, newIndex)
    .map((cat, index) => ({ ...cat, order: index }));

  // Update in parent state
  onChange(reordered);
};


  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  const visibleCategories = showHidden
    ? sortedCategories
    : sortedCategories.filter((cat) => !cat.hidden);

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8, marginBottom: 130 }}>
         <div className="categoryAddWrapper">
      <h4
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        📂 הוספת קטגוריה חדשה
        <span style={{ fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
      </h4>

      {isOpen && (
        <>
          <div className="row">
            <input
              placeholder="שם קטגוריה בעברית"
              value={form.nameHe}
              onChange={(e) => handleInput('nameHe', e.target.value)}
            />
            <input
              placeholder="اسم القسم بالعربي"
              value={form.nameAr}
              onChange={(e) => handleInput('nameAr', e.target.value)}
            />
          </div>
          <div className="row">
            <input
              placeholder="מזהה קטגוריה"
              value={form.id}
              onChange={(e) => handleInput('id', e.target.value)}
              disabled={isEditing}
            />
            <input
              placeholder="كישור תמונה"
              value={form.icon}
              onChange={(e) => handleInput('icon', e.target.value)}
            />
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
        </>
        
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

      <DndContext
        sensors={useSensors(useSensor(PointerSensor))}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleCategories.map(cat => cat.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleCategories.map((cat) => (
            <SortableCategoryCard
              key={cat.id}
              id={cat.id}
              cat={cat}
              onEdit={() => handleEdit(cat)}
              onHide={() => handleHide(cat.id)}
              onDelete={() => handleDelete(cat.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default CategoryManager;
