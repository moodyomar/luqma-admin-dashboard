import { useEffect, useState } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import SimpleSortableMealsList from './SimpleSortableMealsList';
import { FiX, FiEye, FiEyeOff } from 'react-icons/fi';

const QuickMealsManager = ({ isOpen, onClose }) => {
  const [mealsData, setMealsData] = useState({ categories: [], items: {} });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingTimeVisibility, setEditingTimeVisibility] = useState(null); // categoryId being edited
  const [timeVisibilityForm, setTimeVisibilityForm] = useState({
    enabled: false,
    start: '',
    end: ''
  });
  const { activeBusinessId } = useAuth();

  useEffect(() => {
    if (!isOpen || !activeBusinessId) return;
    
    const fetchData = async () => {
      const ref = doc(db, 'menus', activeBusinessId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setMealsData(data);
        
        // Initialize all categories to collapsed (false)
        const initialExpanded = {};
        Object.keys(data.items).forEach((cat) => {
          initialExpanded[cat] = false;
        });
        setExpandedCategories(initialExpanded);
      }
      setLoading(false);
    };
    fetchData();
  }, [isOpen, activeBusinessId]);

  const getCategoryName = (id, lang) => {
    const cat = mealsData.categories?.find((c) => c.id === id);
    if (!cat) return id;
    if (lang === 'ar') return cat.name.ar;
    if (lang === 'he') return cat.name.he;
    return `${cat.name.ar} | ${cat.name.he}`;
  };

  const updateMealInstant = async (categoryId, mealId, updatedMeal) => {
    // Update local state immediately
    const categoryMeals = mealsData.items[categoryId] || [];
    const updated = categoryMeals.map(m => m.id === mealId ? updatedMeal : m);
    setMealsData({ ...mealsData, items: { ...mealsData.items, [categoryId]: updated } });

    // Update Firestore instantly
    try {
      await updateDoc(doc(db, 'menus', activeBusinessId), {
        [`items.${categoryId}`]: updated
      });
    } catch (err) {
      console.error('Error updating meal:', err);
      alert('خطأ في تحديث المادة');
    }
  };

  const handleReorder = async (categoryId, reorderedMeals) => {
    // Update local state
    const updated = { ...mealsData.items, [categoryId]: reorderedMeals };
    setMealsData({ ...mealsData, items: updated });
    
    // Save to Firestore
    try {
      await updateDoc(doc(db, 'menus', activeBusinessId), {
        [`items.${categoryId}`]: reorderedMeals
      });
    } catch (err) {
      console.error('Error reordering meals:', err);
      alert('خطأ في حفظ الترتيب');
    }
  };

  const handleToggleTimeVisibility = (categoryId) => {
    if (editingTimeVisibility === categoryId) {
      // Close if already open
      setEditingTimeVisibility(null);
      setTimeVisibilityForm({ enabled: false, start: '', end: '' });
    } else {
      // Open for this category
      const category = mealsData.categories.find((c) => c.id === categoryId);
      setEditingTimeVisibility(categoryId);
      setTimeVisibilityForm({
        enabled: category?.visibilityTime?.enabled || false,
        start: category?.visibilityTime?.start || '',
        end: category?.visibilityTime?.end || ''
      });
    }
  };

  const handleSaveTimeVisibility = async (categoryId) => {
    const updatedCategories = mealsData.categories.map((cat) => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          visibilityTime: timeVisibilityForm.enabled ? {
            enabled: true,
            start: timeVisibilityForm.start,
            end: timeVisibilityForm.end
          } : { enabled: false }
        };
      }
      return cat;
    });

    // Update local state
    setMealsData({ ...mealsData, categories: updatedCategories });

    // Save to Firestore
    try {
      await updateDoc(doc(db, 'menus', activeBusinessId), {
        categories: updatedCategories
      });
      setEditingTimeVisibility(null);
      setTimeVisibilityForm({ enabled: false, start: '', end: '' });
    } catch (err) {
      console.error('Error saving time visibility:', err);
      alert('خطأ في حفظ الإعدادات');
    }
  };

  const handleToggleHideCategory = async (categoryId) => {
    const updatedCategories = mealsData.categories.map((cat) => {
      if (cat.id === categoryId) {
        return { ...cat, hidden: !cat.hidden };
      }
      return cat;
    });

    // Update local state
    setMealsData({ ...mealsData, categories: updatedCategories });

    // Save to Firestore
    try {
      await updateDoc(doc(db, 'menus', activeBusinessId), {
        categories: updatedCategories
      });
    } catch (err) {
      console.error('Error toggling category visibility:', err);
      alert('خطأ في حفظ الإعدادات');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease',
        }}
      />
      
      {/* Slide-in Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: window.innerWidth <= 768 ? '100%' : (window.innerWidth <= 1024 ? '450px' : '500px'),
          maxWidth: '95vw',
          background: '#fff',
          zIndex: 9999,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8f9fa',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#333' }}>
            إدارة المأكولات
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#666',
              padding: '4px 8px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            paddingBottom: '80px',
          }}
        >
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              جاري التحميل...
            </p>
          ) : (
            Object.entries(mealsData.items)
              .filter(([categoryId, meals]) => {
                const category = mealsData.categories.find((c) => c.id === categoryId);
                // Show all categories (including hidden) so employees can manage them
                // Only filter out categories with 0 meals
                return category && meals && meals.length > 0;
              })
              .map(([categoryId, meals]) => {
                const category = mealsData.categories.find((c) => c.id === categoryId);
                // Sort meals by order
                const sortedMeals = [...meals].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
                
                return (
                  <div
                    key={categoryId}
                    style={{
                      marginBottom: 24,
                      borderBottom: '1px solid #e0e0e0',
                      paddingBottom: 16,
                    }}
                  >
                    {/* Category Header */}
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          cursor: 'pointer',
                          color: '#333',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: window.innerWidth <= 768 ? '6px 8px' : '8px 12px',
                          background: '#f0f0f0',
                          borderRadius: 8,
                          fontWeight: 600,
                          fontSize: window.innerWidth <= 768 ? 14 : 16,
                          gap: 8,
                          flexWrap: 'nowrap',
                        }}
                        onClick={() => {
                          setExpandedCategories((prev) => ({
                            ...prev,
                            [categoryId]: !prev[categoryId],
                          }));
                        }}
                      >
                        {/* Left side: Icons and count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <span style={{ color: '#666', fontWeight: 500, fontSize: window.innerWidth <= 768 ? 12 : 14, whiteSpace: 'nowrap' }}>
                            ({meals.length})
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleHideCategory(categoryId);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: category?.hidden ? '#999' : '#007bff',
                              minWidth: 20,
                              minHeight: 20,
                            }}
                            title={category?.hidden ? 'إظهار الفئة' : 'إخفاء الفئة'}
                          >
                            {category?.hidden ? <FiEyeOff size={window.innerWidth <= 768 ? 14 : 16} /> : <FiEye size={window.innerWidth <= 768 ? 14 : 16} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTimeVisibility(categoryId);
                            }}
                            style={{
                              background: editingTimeVisibility === categoryId ? '#007bff' : 'rgba(0,0,0,0.05)',
                              border: '1px solid ' + (editingTimeVisibility === categoryId ? '#007bff' : 'transparent'),
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: editingTimeVisibility === categoryId ? '#fff' : '#666',
                              fontSize: window.innerWidth <= 768 ? 10 : 12,
                              fontWeight: 500,
                              minWidth: 20,
                              minHeight: 20,
                            }}
                            title="إعدادات الوقت"
                          >
                            ⏰
                          </button>
                        </div>
                        {/* Center: Category names */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, minWidth: 0, margin: '0 8px' }}>
                          <div style={{ 
                            fontWeight: 500, 
                            fontSize: window.innerWidth <= 768 ? 12 : 14,
                            opacity: category?.hidden ? 0.5 : 1,
                            textDecoration: category?.hidden ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}>
                            {getCategoryName(categoryId, 'he')}
                            {category?.hidden && <span style={{ marginRight: 4, color: '#999', fontSize: 10 }}>(מסתיר)</span>}
                          </div>
                          <div style={{ 
                            fontWeight: 500, 
                            fontSize: window.innerWidth <= 768 ? 12 : 14,
                            opacity: category?.hidden ? 0.5 : 1,
                            textDecoration: category?.hidden ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}>
                            {getCategoryName(categoryId, 'ar')}
                            {category?.hidden && <span style={{ marginRight: 4, color: '#999', fontSize: 10 }}>(مخفي)</span>}
                          </div>
                          {category?.visibilityTime?.enabled && (
                            <div style={{ fontSize: window.innerWidth <= 768 ? 9 : 10, color: '#007bff', marginTop: 2, whiteSpace: 'nowrap' }}>
                              ⏰ {category.visibilityTime.start} - {category.visibilityTime.end}
                            </div>
                          )}
                        </div>
                        {/* Right side: Expand/collapse arrow */}
                        <span style={{ fontSize: window.innerWidth <= 768 ? 14 : 18, color: '#888', flexShrink: 0 }}>
                          {expandedCategories[categoryId] ? '⌃' : '⌄'}
                        </span>
                      </div>

                      {/* Time Visibility Settings */}
                      {editingTimeVisibility === categoryId && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: window.innerWidth <= 768 ? '10px' : '12px',
                            background: '#f8f9fa',
                            borderRadius: 8,
                            border: '1px solid #e0e0e0',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: window.innerWidth <= 768 ? '12px' : '14px', fontWeight: '500' }}>
                            <input
                              type="checkbox"
                              checked={timeVisibilityForm.enabled}
                              onChange={(e) => setTimeVisibilityForm({ ...timeVisibilityForm, enabled: e.target.checked })}
                              style={{ width: window.innerWidth <= 768 ? '16px' : '18px', height: window.innerWidth <= 768 ? '16px' : '18px', cursor: 'pointer' }}
                            />
                            <span>إظهار/إخفاء تلقائي حسب الوقت</span>
                          </label>
                          {timeVisibilityForm.enabled && (
                            <div style={{ display: 'flex', gap: '8px', flexDirection: window.innerWidth <= 768 ? 'column' : 'row', marginTop: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px', color: '#666', marginBottom: '4px', display: 'block' }}>من الساعة:</label>
                                <input
                                  type="time"
                                  value={timeVisibilityForm.start}
                                  onChange={(e) => setTimeVisibilityForm({ ...timeVisibilityForm, start: e.target.value })}
                                  style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 768 ? '6px' : '8px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: window.innerWidth <= 768 ? '13px' : '14px',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: window.innerWidth <= 768 ? '11px' : '12px', color: '#666', marginBottom: '4px', display: 'block' }}>إلى الساعة:</label>
                                <input
                                  type="time"
                                  value={timeVisibilityForm.end}
                                  onChange={(e) => setTimeVisibilityForm({ ...timeVisibilityForm, end: e.target.value })}
                                  style={{
                                    width: '100%',
                                    padding: window.innerWidth <= 768 ? '6px' : '8px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: window.innerWidth <= 768 ? '13px' : '14px',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {timeVisibilityForm.enabled && (
                            <div style={{ fontSize: window.innerWidth <= 768 ? '10px' : '11px', color: '#888', marginTop: '8px', lineHeight: '1.4' }}>
                              💡 سيتم إخفاء هذه الفئة تلقائياً خارج الوقت المحدد
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              onClick={() => handleSaveTimeVisibility(categoryId)}
                              style={{
                                flex: 1,
                                padding: window.innerWidth <= 768 ? '6px 10px' : '8px 12px',
                                background: '#007bff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: window.innerWidth <= 768 ? '12px' : '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => {
                                setEditingTimeVisibility(null);
                                setTimeVisibilityForm({ enabled: false, start: '', end: '' });
                              }}
                              style={{
                                flex: 1,
                                padding: window.innerWidth <= 768 ? '6px 10px' : '8px 12px',
                                background: '#6c757d',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: window.innerWidth <= 768 ? '12px' : '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Meals List */}
                    {expandedCategories[categoryId] && (
                      <SimpleSortableMealsList
                        meals={sortedMeals}
                        categoryId={categoryId}
                        onReorder={(reorderedMeals) => handleReorder(categoryId, reorderedMeals)}
                        onChangeMealInstant={updateMealInstant}
                      />
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
};

export default QuickMealsManager;

