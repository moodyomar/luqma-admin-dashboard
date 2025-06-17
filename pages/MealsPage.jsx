import { useEffect, useState, } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import MealCard from '../src/components/MealCard';
import NewMealForm from '../src/components/NewMealForm';
import brand from '../constants/brandConfig';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

const MealsPage = () => {
  const [mealsData, setMealsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
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

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 5 }}>
      <h2 style={{textAlign:'center'}}>ממשק עדכון מוצרים לאפלקציה</h2>

      {Object.entries(mealsData.items).map(([categoryId, meals]) => (
        <div key={categoryId} style={{ marginTop: 30, borderBottom: '1px solid #ccc', paddingBottom: 20 }}>
          <h3
            onClick={() =>
              setExpandedCategories((prev) => ({
                ...prev,
                [categoryId]: !prev[categoryId],
              }))
            }
            style={{ cursor: 'pointer', color: '#007bff' }}
          >
            {expandedCategories[categoryId] ? '▾ ' : '▸ '}القسم | הקטגוריה: {categoryId}
          </h3>

          {expandedCategories[categoryId] && (
            <>
              <NewMealForm
                categoryId={categoryId}
                onAdd={(catId, meal) => {
                  const updated = { ...mealsData.items };
                  updated[catId] = [...(updated[catId] || []), meal];
                  setMealsData({ ...mealsData, items: updated });
                }}
              />
              {meals.map((meal, index) => (
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
      ))}

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
