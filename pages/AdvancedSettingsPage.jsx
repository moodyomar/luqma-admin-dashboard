import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../src/contexts/AuthContext';
import { canAccessAdvancedSettings } from '../src/utils/advancedSettingsAccess';
import { FiLock, FiCreditCard, FiSmartphone, FiSave, FiArrowRight } from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';
import './styles.css';

const DEFAULT_TRANZILA = {
  terminalName: '',
  password: '',
  publicApiKey: '',
  privateTerminal: '',
  apiUrl: 'https://api.tranzila.com/v1',
  currency: '1',
  environment: 'test',
  useHostedFields: true,
};

const DEFAULT_APPLE_PAY = {
  enabled: false,
  merchantId: '',
  currencyCode: 'ILS',
  countryCode: 'IL',
};

const AdvancedSettingsPage = () => {
  const navigate = useNavigate();
  const { user, activeBusinessId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enableVisa: false,
    tranzila: { ...DEFAULT_TRANZILA },
    applePay: { ...DEFAULT_APPLE_PAY },
  });
  const [showTranzilaSecrets, setShowTranzilaSecrets] = useState(false);

  const allowed = canAccessAdvancedSettings(user);

  useEffect(() => {
    if (!allowed) {
      navigate('/settings', { replace: true });
      return;
    }
  }, [allowed, navigate]);

  useEffect(() => {
    if (!allowed || !activeBusinessId) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const ref = doc(db, 'menus', activeBusinessId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const features = data?.config?.features || {};
          const payment = data?.config?.payment || {};
          const tranzila = { ...DEFAULT_TRANZILA, ...(payment.tranzila || {}) };
          const applePay = { ...DEFAULT_APPLE_PAY, ...(payment.applePay || {}) };
          setForm({
            enableVisa: features.enableVisa === true,
            tranzila,
            applePay: {
              ...applePay,
              enabled: applePay.enabled === true || applePay.enabled === 'true',
            },
          });
        }
      } catch (err) {
        console.error('AdvancedSettings fetch error:', err);
        toast.error('فشل تحميل الإعدادات');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [allowed, activeBusinessId]);

  const handleChange = (section, field, value) => {
    if (section === 'root') {
      setForm((prev) => ({ ...prev, [field]: value }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeBusinessId) return;
    setSaving(true);
    try {
      const ref = doc(db, 'menus', activeBusinessId);
      const snap = await getDoc(ref);
      const existingFeatures = snap.exists() ? snap.data()?.config?.features || {} : {};
      const mergedFeatures = { ...existingFeatures, enableVisa: form.enableVisa };

      await updateDoc(ref, {
        'config.features': mergedFeatures,
        'config.payment': {
          tranzila: {
            terminalName: form.tranzila.terminalName || null,
            password: form.tranzila.password || null,
            publicApiKey: form.tranzila.publicApiKey || null,
            privateTerminal: form.tranzila.privateTerminal || null,
            apiUrl: form.tranzila.apiUrl || DEFAULT_TRANZILA.apiUrl,
            currency: form.tranzila.currency || DEFAULT_TRANZILA.currency,
            environment: form.tranzila.environment || DEFAULT_TRANZILA.environment,
            useHostedFields: form.tranzila.useHostedFields,
          },
          applePay: {
            enabled: form.applePay.enabled,
            merchantId: form.applePay.merchantId || null,
            currencyCode: form.applePay.currencyCode || DEFAULT_APPLE_PAY.currencyCode,
            countryCode: form.applePay.countryCode || DEFAULT_APPLE_PAY.countryCode,
          },
        },
      });
      toast.success('تم حفظ الإعدادات المتقدمة');
    } catch (err) {
      console.error('AdvancedSettings save error:', err);
      toast.error('فشل الحفظ: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;
  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <Toaster position="top-center" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <FiLock size={22} color="#007AFF" />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '600', color: '#1d1d1f' }}>
          إعدادات متقدمة | Advanced Settings
        </h1>
      </div>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        تفعيل/إيقاف طرق الدفع وإدخال مفاتيح API. التغييرات تُطبق فوراً على التطبيق دون إعادة نشر.
      </p>
      <div style={{
        backgroundColor: '#e7f3ff',
        border: '1px solid #007AFF',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '24px',
        fontSize: '13px',
        color: '#004085'
      }}>
        <strong>كل الإعدادات من هذه الصفحة فقط — لا حاجة لإدخال شيء يدوياً في Firebase.</strong><br />
        تفعيل/إيقاف الخانات وملء الحقول ثم «حفظ الإعدادات» يخزن تلقائياً: config.features.enableVisa (بطاقة ائتمان)، config.payment.tranzila، config.payment.applePay. التطبيق يقرأ من Firebase فوراً.
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,122,255,0.3)' }}>
          <strong>لماذا الخانات غير مفعّلة والحقول فارغة؟</strong> هذه الصفحة تعرض فقط ما محفوظ في Firebase. إذا التطبيق يعمل حالياً بالدفع عبر ملف .env (في menu-app)، فـ Firebase لم يُحدَّث بعد — الخانات تبقى غير مفعّلة والحقول فارغة حتى تنسخ القيم من .env هنا، تفعّل الخانات، وتضغط «حفظ الإعدادات». بعد الحفظ، التطبيق سيقرأ من Firebase وستتزامن الإعدادات.
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Feature toggles */}
        <section style={{
          backgroundColor: '#fff',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCreditCard size={18} /> تفعيل طرق الدفع
          </h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={form.enableVisa}
              onChange={(e) => handleChange('root', 'enableVisa', e.target.checked)}
            />
            <span>بطاقة ائتمان (Tranzila) | Credit card</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.applePay.enabled}
              onChange={(e) => handleChange('applePay', 'enabled', e.target.checked)}
            />
            <span>Apple Pay</span>
          </label>
        </section>

        {/* Tranzila API keys */}
        <section style={{
          backgroundColor: '#fff',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCreditCard size={18} /> Tranzila (بطاقة ائتمان)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Terminal Name</label>
              <input
                type="text"
                value={form.tranzila.terminalName}
                onChange={(e) => handleChange('tranzila', 'terminalName', e.target.value)}
                placeholder="e.g. qbmedia"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Password (tranzilaPw)</label>
              <input
                type={showTranzilaSecrets ? 'text' : 'password'}
                value={form.tranzila.password}
                onChange={(e) => handleChange('tranzila', 'password', e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Public API Key</label>
              <input
                type={showTranzilaSecrets ? 'text' : 'password'}
                value={form.tranzila.publicApiKey}
                onChange={(e) => handleChange('tranzila', 'publicApiKey', e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Private Key (HMAC)</label>
              <input
                type={showTranzilaSecrets ? 'text' : 'password'}
                value={form.tranzila.privateTerminal}
                onChange={(e) => handleChange('tranzila', 'privateTerminal', e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
              <input
                type="checkbox"
                checked={showTranzilaSecrets}
                onChange={(e) => setShowTranzilaSecrets(e.target.checked)}
              />
              إظهار الحقول السرية
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Environment</label>
                <select
                  value={form.tranzila.environment}
                  onChange={(e) => handleChange('tranzila', 'environment', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
                >
                  <option value="test">Test</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>API URL</label>
                <input
                  type="text"
                  value={form.tranzila.apiUrl}
                  onChange={(e) => handleChange('tranzila', 'apiUrl', e.target.value)}
                  placeholder="https://api.tranzila.com/v1"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Apple Pay */}
        <section style={{
          backgroundColor: '#fff',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiSmartphone size={18} /> Apple Pay
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Merchant ID</label>
              <input
                type="text"
                value={form.applePay.merchantId}
                onChange={(e) => handleChange('applePay', 'merchantId', e.target.value)}
                placeholder="e.g. merchant.com.luqma"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Currency</label>
                <input
                  type="text"
                  value={form.applePay.currencyCode}
                  onChange={(e) => handleChange('applePay', 'currencyCode', e.target.value)}
                  placeholder="ILS"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#555' }}>Country</label>
                <input
                  type="text"
                  value={form.applePay.countryCode}
                  onChange={(e) => handleChange('applePay', 'countryCode', e.target.value)}
                  placeholder="IL"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: saving ? '#999' : '#007AFF',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <FiSave size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'transparent',
              color: '#007AFF',
              border: '1px solid #007AFF',
              borderRadius: '8px',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            <FiArrowRight size={18} /> العودة للإعدادات
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdvancedSettingsPage;
