import React, { useMemo, useState } from 'react';

function mealLabel(m) {
  return (
    (m.name?.ar && String(m.name.ar).trim()) ||
    (m.name?.he && String(m.name.he).trim()) ||
    '—'
  );
}

/**
 * Edit subcategories + link meals (supermarket). Categories persist via onChangeSubs;
 * meal.subcategoryId via onMealSubcategoryChange(mealId, subId|null).
 */
export default function CategorySubcategoriesPanel({
  cat,
  meals = [],
  onChangeSubs,
  onMealSubcategoryChange,
}) {
  const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
  const [id, setId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameHe, setNameHe] = useState('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const sortedMeals = useMemo(
    () =>
      [...(Array.isArray(meals) ? meals : [])].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
      ),
    [meals],
  );

  const add = () => {
    const trimmedId = id.trim();
    if (!trimmedId || !nameAr.trim() || !nameHe.trim()) {
      window.alert('أدخل المعرف واسم العربية والعبرية | מלא מזהה, ערבית ועברית');
      return;
    }
    if (subs.some((s) => s.id === trimmedId)) {
      window.alert('هذا المعرف مستخدم بالفعل | המזהה כבר קיים');
      return;
    }
    onChangeSubs([
      ...subs,
      {
        id: trimmedId,
        name: { ar: nameAr.trim(), he: nameHe.trim() },
        order: subs.length,
      },
    ]);
    setId('');
    setNameAr('');
    setNameHe('');
  };

  const remove = (sid) => {
    if (
      !window.confirm(
        'حذف هذا القسم الفرعي؟ سيتم إزالة ربطه من المنتجات تلقائياً عند الحفظ.\nלמחוק תת-קטגוריה? שיוך מוצרים ינוקה אוטומטית.',
      )
    )
      return;
    onChangeSubs(subs.filter((s) => s.id !== sid).map((s, i) => ({ ...s, order: i })));
  };

  const setMealSub = (meal, subId, checked) => {
    if (!onMealSubcategoryChange) return;
    const current = meal.subcategoryId != null && meal.subcategoryId !== ''
      ? String(meal.subcategoryId)
      : '';
    if (checked) {
      if (current !== String(subId)) {
        onMealSubcategoryChange(meal.id, String(subId));
      }
    } else if (current === String(subId)) {
      onMealSubcategoryChange(meal.id, null);
    }
  };

  return (
    <div
      style={{
        marginBottom: 12,
        marginTop: 4,
        padding: isMobile ? '10px' : '12px',
        background: '#f0f7ff',
        borderRadius: 8,
        border: '1px solid #b8d4f0',
        width: '100%',
        boxSizing: 'border-box',
        direction: 'rtl',
      }}
    >
      <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, marginBottom: 8, color: '#1a53a8' }}>
        أقسام فرعية (سوبرماركت) | תתי-קטגוריות (סופר)
      </div>
      <p
        style={{
          fontSize: 11,
          color: '#2e7d32',
          margin: '0 0 10px',
          lineHeight: 1.45,
          background: '#f1f8f4',
          padding: '8px 10px',
          borderRadius: 6,
        }}
      >
        أنشئ الأقسام الفرعية أدناه، ثم حدّد المنتجات بعلامة ✓ تحت كل قسم. بدون علامة = يظهر المنتج تحت «الكل» في
        التطبيق. الحفظ فوري عند تغيير التحديد.
        <br />
        צרו תתי-קטגוריות, ואז סמנו ✓ ליד מוצרים בכל תת-קטגוריה. ללא סימון = המוצר מופיע תחת «הכל». השמירה מיידית.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: isMobile ? 'stretch' : 'flex-end',
        }}
      >
        <input
          placeholder="معرف فرعي (إنجليزي) | מזהה (אנגלית)"
          value={id}
          onChange={(e) => setId(e.target.value)}
          style={{ flex: 1, minWidth: 100, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
        />
        <input
          placeholder="اسم فرعي عربي"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          style={{ flex: 1, minWidth: 100, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
        />
        <input
          placeholder="שם תת-קטגוריה בעברית"
          value={nameHe}
          onChange={(e) => setNameHe(e.target.value)}
          style={{ flex: 1, minWidth: 100, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#1a73e8',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + إضافة | הוסף
        </button>
      </div>

      {subs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#4a6fa5',
              marginBottom: 6,
            }}
          >
            الأقسام الفرعية | תתי-קטגוריות ({subs.length})
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {subs.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 6px 4px 8px',
                  background: '#fff',
                  border: '1px solid #b8cce8',
                  borderRadius: 999,
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                  fontSize: 12,
                  maxWidth: isMobile ? '100%' : 'none',
                }}
              >
                <code
                  style={{
                    fontSize: 10,
                    fontFamily: 'ui-monospace, monospace',
                    background: '#e8f0fb',
                    padding: '2px 5px',
                    borderRadius: 4,
                    color: '#1e4976',
                    flexShrink: 0,
                  }}
                >
                  {s.id}
                </code>
                <span
                  style={{
                    lineHeight: 1.2,
                    color: '#1a2b4a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: isMobile ? 200 : 180,
                  }}
                  title={`${s.name?.ar} / ${s.name?.he}`}
                >
                  {s.name?.ar} · {s.name?.he}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  title="حذف | מחיקה"
                  style={{
                    color: '#b91c1c',
                    fontSize: 18,
                    lineHeight: 1,
                    background: 'rgba(185, 28, 28, 0.08)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 5px',
                    borderRadius: 6,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 22,
                    minHeight: 22,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subs.length > 0 && onMealSubcategoryChange && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#153e75',
              marginBottom: 8,
            }}
          >
            منتجات تحت كل قسم فرعي | מוצרים לפי תת-קטגוריה
          </div>
          {sortedMeals.length === 0 ? (
            <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
              لا توجد منتجات في هذا القسم بعد. أضفها من «إدارة المنتجات».
              <br />
              אין מוצרים בקטגוריה. הוסיפו מ«ניהול מוצרים».
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '1fr'
                  : 'repeat(auto-fill, minmax(252px, 1fr))',
                gap: 8,
                alignItems: 'start',
              }}
            >
              {subs.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '6px 8px',
                    background: '#fff',
                    borderRadius: 10,
                    border: '1px solid #cfe2f7',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: '#1a53a8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                      paddingBottom: 4,
                      borderBottom: '1px solid #e8f0fa',
                    }}
                  >
                    <code
                      style={{
                        background: '#eef4fc',
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {s.id}
                    </code>
                    <span style={{ lineHeight: 1.25 }}>
                      {s.name?.ar} · {s.name?.he}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 2,
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {sortedMeals.map((meal) => {
                      const checked =
                        meal.subcategoryId != null &&
                        meal.subcategoryId !== '' &&
                        String(meal.subcategoryId) === String(s.id);
                      return (
                        <label
                          key={meal.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: '3px 5px',
                            borderRadius: 6,
                            background: checked ? '#e8f4fd' : 'transparent',
                            border: checked ? '1px solid #90caf9' : '1px solid transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setMealSub(meal, s.id, e.target.checked)}
                          />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}
                            title={`${mealLabel(meal)} · ₪${meal.price ?? '—'}`}
                          >
                            {mealLabel(meal)}
                            <span style={{ color: '#888', marginInlineStart: 4 }}>
                              ₪{meal.price ?? '—'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#555', margin: '10px 0 0', lineHeight: 1.4 }}>
        فعّل «وضع السوبرماركت» أعلى الصفحة إن لزم. تعديل الأقسام الفرعية يُحفظ مع زر حفظ الأقسام؛ ربط المنتجات يُحفظ فوراً.
      </p>
    </div>
  );
}
