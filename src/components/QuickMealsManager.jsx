import { useEffect, useState } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import SimpleSortableMealsList from './SimpleSortableMealsList';
import { FiX } from 'react-icons/fi';

const QuickMealsManager = ({ isOpen, onClose }) => {
  const [mealsData, setMealsData] = useState({ categories: [], items: {} });
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
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
          width: window.innerWidth <= 768 ? '100%' : '500px',
          maxWidth: '90vw',
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
                // Filter out hidden categories and categories with 0 meals
                return category && !category.hidden && meals && meals.length > 0;
              })
              .map(([categoryId, meals]) => {
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
                    <h3
                      onClick={() => {
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [categoryId]: !prev[categoryId],
                        }));
                      }}
                      style={{
                        cursor: 'pointer',
                        color: '#333',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        padding: '8px 12px',
                        background: '#f0f0f0',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                      }}
                    >
                      <span style={{ color: '#666', fontWeight: 500 }}>
                        ({meals.length})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {getCategoryName(categoryId, 'he')}
                        </div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {getCategoryName(categoryId, 'ar')}
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: '#888' }}>
                        {expandedCategories[categoryId] ? '⌃' : '⌄'}
                      </span>
                    </h3>

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

