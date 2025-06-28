import { useEffect, useState } from 'react';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import brand from '../constants/brandConfig';
import './styles.css';

const BusinessManagePage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    deliveryEstimate: '',
    isOpen: true,
    workingHours: { open: '', close: '' },
    contact: { instagram: '', phone: '', website: '' },
  });

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'menus', brand.id);
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
        setForm({
          deliveryEstimate: data.deliveryEstimate || '',
          isOpen: typeof data.isOpen === 'boolean' ? data.isOpen : true,
          workingHours: { open, close },
          contact,
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
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', brand.id);
    try {
      await updateDoc(ref, {
        'config.deliveryEstimate': Number(form.deliveryEstimate),
        'config.isOpen': form.isOpen,
        'config.workingHours': form.workingHours,
        'config.contact': form.contact,
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
    <div style={{ maxWidth: 440, margin: '40px auto', padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #e0e0e0', display: 'flex', flexDirection: 'column', gap: 32 }}>
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
        {/* First row: Delivery time and store status */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 2 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>זמן משלוח משוער (בדקות)</label>
            <input
              type="number"
              name="deliveryEstimate"
              value={form.deliveryEstimate}
              onChange={handleChange}
              min={1}
              placeholder="30"
              style={{
                width: '135px',
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
            <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2 }}>סטטוס חנות</label>
            <label
              style={{
                width: '135px',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '0 12px',
                boxSizing: 'border-box',
              }}
            >
              <input
                type="checkbox"
                name="isOpen"
                checked={form.isOpen}
                onChange={handleChange}
                style={{ width: 20, height: 20, accentColor: '#007aff', marginLeft: 4 }}
              />
              {form.isOpen ? 'פתוח' : 'סגור'}
            </label>
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
                width: '135px',
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
                width: '135px',
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
      </div>
      {/* Contact info section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <h3 style={{ fontWeight: 600, color: '#007bff', marginBottom: 14, fontSize: 18 }}>פרטי יצירת קשר</h3>
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
      </div>
      {/* Action buttons side by side */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 18, justifyContent: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="loginButton primary"
          style={{ fontSize: 18, padding: '12px 28px', borderRadius: 8, minWidth: 120 }}
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
        <button
          onClick={() => window.location.href = '/meals'}
          className="loginButton secondary"
          style={{ fontSize: 16, padding: '10px 24px', borderRadius: 8, minWidth: 120 }}
        >
          חזרה
        </button>
      </div>
    </div>
  );
};

export default BusinessManagePage; 