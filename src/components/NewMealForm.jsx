import { useState } from 'react';

const NewMealForm = ({ categoryId, onAdd, visible, setVisible }) => {
    const [form, setForm] = useState({
        nameAr: '',
        nameHe: '',
        price: '',
        descAr: '',
        descHe: '',
        image: '',
        available: true,
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
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
            name: { ar: form.nameAr, he: form.nameHe },
            price: form.price,
            description: { ar: form.descAr || '', he: form.descHe || '' },
            image: form.image || '',
            available: form.available,
            order: 0,
        };

        onAdd(categoryId, newMeal);
        setForm({
            nameAr: '', nameHe: '', price: '',
            descAr: '', descHe: '', image: '',
            available: true
        });
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div style={{
            border: '1px dashed #aaa',
            padding: 10,
            borderRadius: 10,
            backgroundColor: '#fafafa',
            maxWidth: 500,
            marginTop: 10,
            direction: 'rtl'
        }}>
            <h4 style={{ marginBottom: 12, textAlign: 'center' }}>
                اضافه منتج جديد ل <strong>{categoryId}</strong>
            </h4>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 5,
            }}>
                <input placeholder="اسم المنتج/وجبه" value={form.nameAr} onChange={(e) => handleChange('nameAr', e.target.value)} />
                <input placeholder="שם מוצר/מנה" value={form.nameHe} onChange={(e) => handleChange('nameHe', e.target.value)} />
                <input placeholder="سعر | מחיר" value={form.price} onChange={(e) => handleChange('price', e.target.value)} />
                <input placeholder="لينك صوره | לינק תמונה" value={form.image} onChange={(e) => handleChange('image', e.target.value)} />
                <input placeholder="وصف المنتج/وجبه" value={form.descAr} onChange={(e) => handleChange('descAr', e.target.value)} />
                <input placeholder="תיאור מוצר/מנה" value={form.descHe} onChange={(e) => handleChange('descHe', e.target.value)} />
              
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <button
                    onClick={handleSubmit}
                    style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '6px 18px',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 'bold'
                    }}>
                    اضافه | הוספה
                </button>
                <button
                    onClick={() => setVisible(false)}
                    style={{
                        backgroundColor: '#e74c3c',
                        color: '#fff',
                        padding: '6px 18px',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 'bold'
                    }}>
                    الغاء | בטל
                </button>
            </div>
        </div>
    );
};

export default NewMealForm;
