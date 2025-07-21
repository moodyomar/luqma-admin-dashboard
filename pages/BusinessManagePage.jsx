import { useEffect, useState } from 'react';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import brandConfig from '../constants/brandConfig';
import './styles.css';

const BusinessManagePage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    deliveryFee: '',
    isOpen: true,
    workingHours: { open: '', close: '' },
    contact: { instagram: '', phone: '', website: '' },
    prepTimeOptions: [], // new field
    storeStatusMode: 'auto', // NEW FIELD
  });
  const [newPrepValue, setNewPrepValue] = useState('');
  const [newPrepUnit, setNewPrepUnit] = useState('minutes');
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'menus', brandConfig.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        // Try to get working hours from config if available
        let open = data.workingHours?.open || '';
        let close = data.workingHours?.close || '';
        if (data.config?.workingHours) {
          open = data.config.workingHours.open || open;
          close = data.config.workingHours.close || close;
        }
        // Get contact from config if available
        const contact = {
          email: data.config?.contact?.email || data.contact?.email || '',
          instagram: data.config?.contact?.instagram || data.contact?.instagram || '',
          phone: data.config?.contact?.phone || data.contact?.phone || '',
          website: data.config?.contact?.website || data.contact?.website || '',
        };
        // Get prepTimeOptions from config if available
        const prepTimeOptions = data.config?.prepTimeOptions || [];
        // Get deliveryFee from config if available
        const deliveryFee = data.config?.deliveryFee ?? '';
        // Get storeStatusMode from config if available
        const storeStatusMode = data.config?.storeStatusMode || 'auto';
        setForm({
          deliveryFee,
          isOpen: typeof data.isOpen === 'boolean' ? data.isOpen : true,
          workingHours: { open, close },
          contact,
          prepTimeOptions,
          storeStatusMode, // NEW
        });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'isOpen') {
      setForm((prev) => ({ ...prev, isOpen: checked }));
    } else if (name === 'open' || name === 'close') {
      setForm((prev) => ({
        ...prev,
        workingHours: { ...prev.workingHours, [name]: value },
      }));
    } else if (["email", "instagram", "phone", "website"].includes(name)) {
      setForm((prev) => ({
        ...prev,
        contact: { ...prev.contact, [name]: value },
      }));
    } else if (name === 'deliveryFee') {
      setForm((prev) => ({ ...prev, deliveryFee: value }));
    } else if (name === 'storeStatusMode') {
      setForm((prev) => ({ ...prev, storeStatusMode: value }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Add prep time option
  const addPrepTimeOption = () => {
    if (!newPrepValue || isNaN(Number(newPrepValue)) || Number(newPrepValue) <= 0) return;
    setForm(prev => ({
      ...prev,
      prepTimeOptions: [...(prev.prepTimeOptions || []), { value: Number(newPrepValue), unit: newPrepUnit }]
    }));
    setNewPrepValue('');
  };
  // Remove prep time option
  const removePrepTimeOption = (idx) => {
    setForm(prev => ({
      ...prev,
      prepTimeOptions: prev.prepTimeOptions.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', brandConfig.id);
    try {
      await updateDoc(ref, {
        'config.deliveryFee': Number(form.deliveryFee),
        'config.isOpen': form.isOpen,
        'config.workingHours': form.workingHours,
        'config.contact': form.contact,
        'config.prepTimeOptions': form.prepTimeOptions,
        'config.storeStatusMode': form.storeStatusMode, // NEW
      });
      alert('✅ נשמר בהצלחה!');
    } catch (err) {
      console.error('❌ Error saving business settings:', err);
      alert('❌ שגיאה בשמירה.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>טוען...</p>;

  return (
    <div style={{ maxWidth: 440, margin: '10px auto', padding: 20, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #e0e0e0', display: 'flex', flexDirection: 'column', gap: 15 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 8, fontWeight: 700, color: '#222' }}>ניהול עסק</h2>
      {/* Modern compact upper section */}
      <div
        style={{
          background: '#f7f8fa',
          borderRadius: 16,
          boxShadow: '0 1px 4px #f0f0f0',
          marginBottom: 8,
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          direction: 'rtl',
        }}
      >
        {/* First row: Delivery fee and store status */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 2 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>דמי משלוח ברירת מחדל (₪)</label>
            <input
              type="number"
              name="deliveryFee"
              value={form.deliveryFee}
              onChange={handleChange}
              min={0}
              placeholder="0"
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 16,
                background: '#fff',
                textAlign: 'right',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>حالة المتجر</label>
            <select
              name="storeStatusMode"
              value={form.storeStatusMode}
              onChange={handleChange}
              style={{
                height: 44,
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 16,
                background: '#fff',
                textAlign: 'right',
                boxSizing: 'border-box',
                width: '100%',
                padding: '0 12px',
                marginBottom: 8,
              }}
            >
              <option value="auto">تلقائي (حسب ساعات العمل)</option>
              <option value="open">مفتوح الآن</option>
              <option value="busy">مشغول حالياً</option>
              <option value="closed">مغلق الآن</option>
            </select>
          </div>
        </div>
        {/* Second row: Opening and closing times */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>שעת פתיחה</label>
            <input
              type="time"
              name="open"
              value={form.workingHours.open}
              onChange={handleChange}
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 16,
                background: '#fff',
                textAlign: 'right',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>שעת סגירה</label>
            <input
              type="time"
              name="close"
              value={form.workingHours.close}
              onChange={handleChange}
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 16,
                background: '#fff',
                textAlign: 'right',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        {/* Prep time options row - moved to last row, styled */}
        <div style={{ marginTop: 18, width: '100%' }}>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, display: 'block' }}>אפשרויות זמן הכנה</label>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6, marginRight: 2 }}>
            הוסף כל אפשרות שתרצה לקביעת זמן הכנת הזמנה, אחת בכל פעם. נתן דקות, שעות, וימים. תוכל להסיר אפשרות בלחיצה על ×.
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0', width: '100%', justifyContent: 'center', alignItems: 'center', rowGap: 10
          }}>
            {(form.prepTimeOptions || []).map((opt, idx) => (
              <span key={idx} style={{ background: '#e0e0e0', borderRadius: 8, padding: '2px 8px', display: 'flex', alignItems: 'center', fontSize: 14, justifyContent: 'center', minWidth: 60, margin: '0 2px' }}>
                {opt.value} {opt.unit === 'minutes' ? 'דקות' : opt.unit === 'hours' ? 'שעה' : 'יום'}
                <button onClick={() => removePrepTimeOption(idx)} style={{ marginRight: 6, background: 'none', border: 'none', color: '#e00', fontWeight: 700, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, width: '100%', justifyContent: 'space-between', paddingRight: 2, paddingLeft: 2 }}>
            <input
              type="number"
              min={1}
              value={newPrepValue}
              onChange={e => setNewPrepValue(e.target.value)}
              placeholder="מספר"
              style={{ width: '90px', height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 16, background: '#fff', textAlign: 'right', boxSizing: 'border-box' }}
            />
            <select value={newPrepUnit} onChange={e => setNewPrepUnit(e.target.value)} style={{ width: '100px', height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 16, background: '#fff', textAlign: 'right', boxSizing: 'border-box' }}>
              <option value="minutes">דקות</option>
              <option value="hours">שעות</option>
              <option value="days">ימים</option>
            </select>
            <button
              onClick={addPrepTimeOption}
              disabled={
                !newPrepValue ||
                isNaN(Number(newPrepValue)) ||
                Number(newPrepValue) <= 0 ||
                (form.prepTimeOptions || []).some(opt => opt.value === Number(newPrepValue) && opt.unit === newPrepUnit) ||
                (form.prepTimeOptions || []).length >= 6
              }
              style={{ width: '90px', height: 44, borderRadius: 10, background: '#007aff', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!newPrepValue || isNaN(Number(newPrepValue)) || Number(newPrepValue) <= 0 || (form.prepTimeOptions || []).some(opt => opt.value === Number(newPrepValue) && opt.unit === newPrepUnit) || (form.prepTimeOptions || []).length >= 6) ? 0.5 : 1 }}
            >הוסף</button>
          </div>
          {(form.prepTimeOptions || []).length >= 6 && (
            <div style={{ color: '#e00', fontSize: 13, marginTop: 4, textAlign: 'center' }}>מקסימום 6 אפשרויות</div>
          )}
        </div>
      </div>
      {/* Contact info section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowContact(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 6,
          }}
        >
          {showContact ? 'הסתר פרטי יצירת קשר' : 'הצג פרטי יצירת קשר'}
          <span style={{ fontSize: 18 }}>{showContact ? '▲' : '▼'}</span>
        </button>
        {showContact && (
          <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אינסטגרם:
            <input
              type="text"
              name="instagram"
              value={form.contact.instagram}
              onChange={handleChange}
              placeholder="@yourbusiness"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            טלפון:
            <input
              type="text"
              name="phone"
              value={form.contact.phone}
              onChange={handleChange}
              placeholder="04-000-0000"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אתר אינטרנט:
            <input
              type="text"
              name="website"
              value={form.contact.website}
              onChange={handleChange}
              placeholder="https://yourwebsite.com"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אימייל:
            <input
              type="email"
              name="email"
              value={form.contact.email}
              onChange={handleChange}
              placeholder="info@yourbusiness.com"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
        </div>
          </>
        )}
      </div>
      {/* Action buttons side by side */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 18, justifyContent: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="loginButton primary"
          style={{ fontSize: 18, padding: '6px 20px', borderRadius: 8, minWidth: 120 }}
        >
          {saving ? 'שומר...' : 'שמור'}
        </button>
        <button
          onClick={() => window.location.href = '/meals'}
          className="loginButton secondary"
          style={{ fontSize: 16, padding: '6px 20px', borderRadius: 8, minWidth: 120 }}
        >
          חזרה
        </button>
      </div>
    </div>
  );
};

export default BusinessManagePage; 