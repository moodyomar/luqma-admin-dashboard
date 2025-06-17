import { useEffect, useState } from 'react';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import brand from '../constants/brandConfig';

const MealsPage = () => {
  const [mealsData, setMealsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'menus', brandId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setMealsData(snap.data());
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', brand.id);
    await setDoc(ref, mealsData);
    setSaving(false);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h2>Meals Editor</h2>

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      <button onClick={() => signOut(auth)}>Logout</button>
      {Object.entries(mealsData.items).map(([categoryId, meals]) => (
        <div key={categoryId} style={{ marginTop: 30 }}>
          <h3>Category: {categoryId}</h3>
          {meals.map((meal, index) => (
            <div key={meal.id} style={{ marginBottom: 10, padding: 10, border: '1px solid #ccc' }}>
              <input
                type="text"
                value={meal.name.ar}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    name: { ...meal.name, ar: e.target.value },
                  })
                }
                placeholder="Arabic name"
              />
              <input
                type="text"
                value={meal.name.he}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    name: { ...meal.name, he: e.target.value },
                  })
                }
                placeholder="Hebrew name"
              />
              <input
                type="text"
                value={meal.price}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    price: e.target.value,
                  })
                }
                placeholder="Price"
              />
              <input
                type="text"
                value={meal.description?.ar || ''}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    description: { ...meal.description, ar: e.target.value },
                  })
                }
                placeholder="Arabic description"
              />

              <input
                type="text"
                value={meal.description?.he || ''}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    description: { ...meal.description, he: e.target.value },
                  })
                }
                placeholder="Hebrew description"
              />
              {meal.image && (
                <img src={meal.image} alt="" style={{ width: 100, marginTop: 8 }} />
              )}
              <input
                type="text"
                value={meal.image || ''}
                onChange={(e) =>
                  updateMeal(categoryId, index, {
                    ...meal,
                    image: e.target.value,
                  })
                }
                placeholder="Image URL"
              />

            </div>
          ))}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      <button onClick={() => signOut(auth)}>Logout</button>
    </div>
  );

  function updateMeal(categoryId, index, updatedMeal) {
    const updatedItems = { ...mealsData.items };
    updatedItems[categoryId][index] = updatedMeal;
    setMealsData({ ...mealsData, items: updatedItems });
  }
};

export default MealsPage;
