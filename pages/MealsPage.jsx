import { useEffect, useState, } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import MealCard from '../src/components/MealCard';
import NewMealForm from '../src/components/NewMealForm';
import CategoryManager from '../src/components/CategoryManager';
import brand from '../constants/brandConfig';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

const MealsPage = () => {
  const [mealsData, setMealsData] = useState({ categories: [], items: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showMeals, setShowMeals] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!confirm('Are you sure you want to delete this meal?')) return;
    const updatedItems = { ...mealsData.items };
    updatedItems[categoryId].splice(index, 1);
    setMealsData({ ...mealsData, items: updatedItems });
  };

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', brand.id);
    await setDoc(ref, mealsData);
    setSaving(false);
    alert('✅ Changes saved to Firebase');
  };

  const getCategoryName = (id, lang) => {
    const cat = mealsData.categories?.find((c) => c.id === id);
    if (!cat) return id;
    if (lang === 'ar') return cat.name.ar;
    if (lang === 'he') return cat.name.he;
    return `${cat.name.ar} | ${cat.name.he}`; // fallback
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 5 }}>
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
          onChange={(updatedCategories) => {
            const updatedItems = { ...mealsData.items };

            // اضف مفتاح جديد إذا ما كان موجود
            updatedCategories.forEach((cat) => {
              if (!updatedItems[cat.id]) {
                updatedItems[cat.id] = [];
              }
            });
            setMealsData({
              ...mealsData,
              categories: updatedCategories,
              items: updatedItems,
            });
          }}
        />}
      {showMeals && (
        Object.entries(mealsData.items).map(([categoryId, meals]) => {
          const filteredMeals = meals.filter((meal) =>
            meal.name.ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
            meal.name.he.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div key={categoryId} style={{ marginTop: 30, borderBottom: '1px solid #ccc', paddingBottom: 20, direction: 'ltr' }}>
              <h3
                onClick={() =>
                  setExpandedCategories((prev) => ({
                    ...prev,
                    [categoryId]: !prev[categoryId],
                  }))
                }
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
                  <input
                    type="text"
                    placeholder="ابحث عن منتج / חפש מנה"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      margin: '10px 0',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      fontSize: '14px',
                      direction:'rtl'
                    }}
                  />

                  <NewMealForm
                    categoryId={categoryId}
                    onAdd={(catId, meal) => {
                      const updated = { ...mealsData.items };
                      updated[catId] = [...(updated[catId] || []), meal];
                      setMealsData({ ...mealsData, items: updated });
                    }}
                  />

                  {filteredMeals.map((meal, index) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      onChange={(updatedMeal) => updateMeal(categoryId, index, updatedMeal)}
                      onDelete={() => deleteMeal(categoryId, index)}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })
      )}

      <div className="loginButtons">
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
