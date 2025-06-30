import { useEffect, useRef, useState, } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import MealCard from '../src/components/MealCard';
import NewMealForm from '../src/components/NewMealForm';
import CategoryManager from '../src/components/CategoryManager';
import brand from '../constants/brandConfig';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import './styles.css'
import SortableMealsList from '../src/components/SortableMealsList';

const MealsPage = () => {
  const [mealsData, setMealsData] = useState({ categories: [], items: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showMeals, setShowMeals] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMeals, setExpandedMeals] = useState({});
  const [openFormCategory, setOpenFormCategory] = useState(null);
  const formRefs = useRef({});
  const categoryRefs = useRef({});

  const toggleMeal = (mealId) => {
    setExpandedMeals(prev => ({
      ...prev,
      [mealId]: !prev[mealId],
    }));
  };

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'menus', brand.id);
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
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login'); // or wherever your login page is
  };

  const updateMeal = (categoryId, index, updatedMeal) => {
    const updatedItems = { ...mealsData.items };
    updatedItems[categoryId][index] = updatedMeal;
    setMealsData({ ...mealsData, items: updatedItems });
  };

  const deleteMeal = (categoryId, index) => {
    if (!confirm('متأكد ودك تمحى هاض المنتج؟')) return;
    const updatedItems = { ...mealsData.items };
    updatedItems[categoryId].splice(index, 1);
    setMealsData({ ...mealsData, items: updatedItems });
  };

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', brand.id);

    const cleanedMealsData = {
      ...mealsData,
      items: Object.fromEntries(
        Object.entries(mealsData.items).map(([catId, meals]) => [
          catId,
          meals.map((meal) => {
            const cleanedOptions = (meal.options || []).map((opt) => {
              const cleanedValues = opt.values.map((val) => {
                const cleanVal = {
                  label: {
                    ar: val?.label?.ar || '',
                    he: val?.label?.he || '',
                  },
                  value: val?.value || `opt_${Date.now()}`,
                  extra: typeof val?.extra === 'number' ? val.extra : 0,
                  image: val?.image || '',
                };


                // ✅ فقط أضف extra إذا كان النوع 'select'
                if (opt.type === 'select') {
                  cleanVal.extra = typeof val?.extra === 'number' ? val.extra : 0;
                }

                return cleanVal;
              });

              return {
                type: opt?.type || 'multi',
                label: {
                  ar: opt?.label?.ar || '',
                  he: opt?.label?.he || '',
                },
                values: cleanedValues,

                // ✅ New Fields
                max: typeof opt.max === 'number' ? opt.max : null,
                allChecked: !!opt.allChecked,
                limitsBySelectValue: opt?.limitsBySelectValue || {},
                required: !!opt.required,
              };
            });

            return {
              ...meal,
              available: typeof meal.available === 'boolean' ? meal.available : true,
              name: {
                ar: meal?.name?.ar || '',
                he: meal?.name?.he || '',
              },
              description: {
                ar: meal?.description?.ar || '',
                he: meal?.description?.he || '',
              },
              price: !isNaN(Number(meal.price)) ? Number(meal.price) : 0,
              image: meal?.image || '',
              id: meal?.id || `id_${Date.now()}`,
              options: cleanedOptions,
            };
          }),
        ])
      ),
    };


    try {
      await setDoc(ref, cleanedMealsData);
      alert('✅ كل الشيفات انبسطوا، تم الحفظ بنجاح!');
    } catch (err) {
      console.error('❌ Firebase Save Error:', err);
      alert('❌ صار خطأ بالحفظ. راجع الكونسول.');
    } finally {
      setSaving(false);
    }
  };


  const getCategoryName = (id, lang) => {
    const cat = mealsData.categories?.find((c) => c.id === id);
    if (!cat) return id;
    if (lang === 'ar') return cat.name.ar;
    if (lang === 'he') return cat.name.he;
    return `${cat.name.ar} | ${cat.name.he}`; // fallback
  };

  const handleCategoriesChange = async (updatedCategories) => {
    setMealsData((prev) => ({ ...prev, categories: updatedCategories }));

    try {
      await updateDoc(doc(db, 'menus', 'luqma'), {
        categories: updatedCategories,
      });
    } catch (err) {
      console.error('🔥 Error updating categories:', err);
    }
  };


  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 2, marginBottom: 85 }}>
      <h2 style={{
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: '600',
        color: '#333',
        marginBottom: '24px',
      }}>
        ממשק ניהול התפריט לאפליקציה
      </h2>
      <div className="buttonsWrapper">
        <button
          onClick={() => setShowCategoryManager(prev => !prev)}
          style={{ marginBottom: 20 }}>
          {showCategoryManager ? 'סגור ניהול קטגוריות' : 'פתח ניהול קטגוריות'}
        </button>
        <button onClick={() => setShowMeals(prev => !prev)} style={{ marginBottom: 20 }}>
          {showMeals ? 'סגור ניהול מנות' : 'פתח ניהול מנות'}
        </button>
      </div>
      {showCategoryManager && <CategoryManager
        categories={mealsData.categories}
        onChange={async (updatedCategories) => {
          const updatedItems = { ...mealsData.items };

          // اضف مفتاح جديد إذا ما كان موجود
          updatedCategories.forEach((cat) => {
            if (!updatedItems[cat.id]) {
              updatedItems[cat.id] = [];
            }
          });

          // Update local state
          setMealsData({
            ...mealsData,
            categories: updatedCategories,
            items: updatedItems,
          });

          // 🔥 Update in Firestore (menus/luqma document)
          try {
            await updateDoc(doc(db, 'menus', 'luqma'), {
              categories: updatedCategories,
            });
            console.log('✅ Categories order saved to Firestore');
          } catch (err) {
            console.error('🔥 Failed to update categories in Firestore:', err);
          }
        }}
      />}
      {showMeals && (
        Object.entries(mealsData.items)
          .filter(([categoryId]) => {
            const category = mealsData.categories.find((c) => c.id === categoryId);
            return category && !category.hidden;
          })
          .map(([categoryId, meals]) => {
            // Sort meals by order (lowest first), fallback to Infinity if missing
            const sortedMeals = [...meals].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
            const filteredMeals = sortedMeals.filter((meal) =>
              meal.name.ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
              meal.name.he.toLowerCase().includes(searchTerm.toLowerCase())
            );

            return (
              <div
                key={categoryId}
                ref={el => categoryRefs.current[categoryId] = el}
                style={{ marginTop: 30, borderBottom: '1px solid #ccc', paddingBottom: 20, direction: 'ltr' }}
              >
                <h3
                  onClick={() => {
                    setExpandedCategories((prev) => {
                      const isOpening = !prev[categoryId];
                      const updated = { ...prev, [categoryId]: isOpening };
                      setTimeout(() => {
                        if (isOpening && categoryRefs.current[categoryId]) {
                          categoryRefs.current[categoryId].scrollIntoView({ behavior: 'smooth', block: 'start' });
                          setTimeout(() => {
                            window.scrollBy({ top: -30, behavior: 'smooth' });
                          }, 200);
                        }
                      }, 100);
                      return updated;
                    });
                  }}
                  style={{
                    cursor: 'pointer',
                    color: '#333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {/* Item count */}
                  <span style={{ color: '#666', fontWeight: 600 }}>({meals.length})</span>

                  {/* Text block */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ fontWeight: 500 }}>
                      הקטגוריה:{' '}
                      <span style={{ color: '#007bff', fontWeight: 600 }}>
                        {getCategoryName(categoryId, 'he')}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      القسم:{' '}
                      <span style={{ color: '#007bff', fontWeight: 600 }}>
                        {getCategoryName(categoryId, 'ar')}
                      </span>
                    </div>
                  </div>
                </h3>


                {expandedCategories[categoryId] && (
                  <>
                    <div style={{ display: 'flex', gap: 8, margin: '10px 0', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="ابحث عن منتج / חפש מנה"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: 6,
                          border: '1px solid #ccc',
                          fontSize: '14px',
                          direction: 'rtl'
                        }}
                      />
                      <button
                        onClick={() => {
                          if (openFormCategory === categoryId) {
                            setOpenFormCategory(null);
                          } else {
                            setOpenFormCategory(categoryId);
                            setTimeout(() => {
                              if (formRefs.current[categoryId]) {
                                formRefs.current[categoryId].scrollIntoView({ behavior: 'smooth', block: 'start' });
                                setTimeout(() => {
                                  window.scrollBy({ top: -30, behavior: 'smooth' });
                                }, 200);
                              }
                            }, 100);
                          }
                        }}
                        style={{
                          backgroundColor: 'rgb(40, 167, 69)',
                          color: 'white',
                          padding: '8px',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          direction: 'rtl',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px'
                        }}
                      >
                        ➕
                      </button>
                    </div>
                    <div ref={el => formRefs.current[categoryId] = el}>
                      <NewMealForm
                        categoryId={categoryId}
                        onAdd={(catId, meal) => {
                          const updated = { ...mealsData.items };
                          // Insert new meal at the start
                          const newMeals = [meal, ...(updated[catId] || [])];
                          // Reassign order for all meals
                          const orderedMeals = newMeals.map((m, idx) => ({ ...m, order: idx }));
                          updated[catId] = orderedMeals;
                          setMealsData({ ...mealsData, items: updated });
                        }}
                        visible={openFormCategory === categoryId}
                        setVisible={() => setOpenFormCategory(null)}
                      />
                    </div>
                    <SortableMealsList
                      meals={filteredMeals}
                      categoryId={categoryId}
                      onChangeMeal={(updatedMeal, idx) => {
                        const updated = [...mealsData.items[categoryId]];
                        updated[idx] = updatedMeal;
                        setMealsData({ ...mealsData, items: { ...mealsData.items, [categoryId]: updated } });
                      }}
                      onDeleteMeal={(idx) => deleteMeal(categoryId, idx)}
                      expandedMeals={expandedMeals}
                      onToggleMeal={toggleMeal}
                      allMealsInCategory={mealsData.items[categoryId]}
                      onReorder={async (reorderedMeals) => {
                        // Save new order to state and Firestore
                        const updated = { ...mealsData.items, [categoryId]: reorderedMeals };
                        setMealsData({ ...mealsData, items: updated });
                        try {
                          await updateDoc(doc(db, 'menus', brand.id), {
                            [`items.${categoryId}`]: reorderedMeals
                          });
                        } catch (err) {
                          alert('שגיאה בשמירת סדר המנות');
                        }
                      }}
                      categories={mealsData.categories}
                      onMoveCategory={async (meal, oldCategoryId, newCategoryId) => {
                        if (oldCategoryId === newCategoryId) return;
                        // Remove from old
                        const oldMeals = [...(mealsData.items[oldCategoryId] || [])].filter(m => m.id !== meal.id);
                        // Add to new (at end)
                        const newMeals = [...(mealsData.items[newCategoryId] || []), { ...meal }];
                        // Reassign order
                        const orderedOld = oldMeals.map((m, idx) => ({ ...m, order: idx }));
                        const orderedNew = newMeals.map((m, idx) => ({ ...m, order: idx }));
                        const updatedItems = {
                          ...mealsData.items,
                          [oldCategoryId]: orderedOld,
                          [newCategoryId]: orderedNew,
                        };
                        setMealsData({ ...mealsData, items: updatedItems });
                        // Save to Firestore
                        try {
                          await updateDoc(doc(db, 'menus', brand.id), {
                            [`items.${oldCategoryId}`]: orderedOld,
                            [`items.${newCategoryId}`]: orderedNew,
                          });
                        } catch (err) {
                          alert('שגיאה בהעברת המנה לקטגוריה חדשה');
                        }
                      }}
                    />
                  </>
                )}
              </div>
            );
          })
      )}

      <div className="loginButtons" style={{ gap: '10px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => window.location.href = '/manage'}
          className="loginButton secondary">
          ניהול זמינות
        </button>
        <button
          onClick={() => window.location.href = '/orders'}
          className="loginButton info">
          הזמנות נכנסות
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="loginButton primary">
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
        <button
          onClick={handleLogout}
          className="loginButton danger">
          התנתקות
        </button>
      </div>
    </div>
  );
};

export default MealsPage;
