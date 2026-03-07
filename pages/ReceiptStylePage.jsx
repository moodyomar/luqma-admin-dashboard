import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../src/contexts/AuthContext';
import { canAccessAdvancedSettings } from '../src/utils/advancedSettingsAccess';
import { Toaster, toast } from 'react-hot-toast';
import {
  getDefaultReceiptStyle,
  mergeWithDefaults,
  RECEIPT_STYLE_CONTROLS,
  FONT_OPTIONS,
} from '../constants/receiptStyleSchema';
import brandConfig from '../constants/brandConfig';
import './styles.css';

const ReceiptStylePage = () => {
  const navigate = useNavigate();
  const { user, activeBusinessId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState(() => getDefaultReceiptStyle());
  const previewContainerRef = useRef(null);

  const allowed = canAccessAdvancedSettings(user);
  useEffect(() => {
    if (!allowed) {
      navigate('/settings', { replace: true });
      return;
    }
  }, [allowed, navigate]);

  useEffect(() => {
    if (!activeBusinessId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const ref = doc(db, 'menus', activeBusinessId);
        const snap = await getDoc(ref);
        const data = snap.data();
        const saved = data?.config?.receiptStyle;
        if (saved && typeof saved === 'object') {
          setStyle(mergeWithDefaults(saved));
        }
      } catch (e) {
        console.error('Load receipt style:', e);
        toast.error('فشل تحميل شكل الإيصال');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeBusinessId]);

  const updateStyle = (key, value) => {
    setStyle((prev) => ({ ...prev, [key]: value }));
  };

  // Update CSS variable when fontFamily changes - this ensures preview updates immediately
  useEffect(() => {
    if (previewContainerRef.current) {
      const fontFamily = style.fontFamily || "'Tahoma', 'Arial', sans-serif";
      previewContainerRef.current.style.setProperty('--receipt-font-family', fontFamily);
    }
  }, [style.fontFamily]);

  const handleSave = async () => {
    if (!activeBusinessId) {
      toast.error('لا يوجد نشاط تجاري محدد');
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, 'menus', activeBusinessId);
      await updateDoc(ref, { 'config.receiptStyle': style });
      toast.success('تم حفظ شكل الإيصال — الطباعة التالية ستستخدم هذا الشكل');
    } catch (e) {
      console.error('Save receipt style:', e);
      toast.error('فشل الحفظ: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStyle(getDefaultReceiptStyle());
    toast.success('تم استعادة القيم الافتراضية');
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        جاري تحميل شكل الإيصال...
      </div>
    );
  }

  // Preview: lineHeight must be "32px" not 32 (CSS unitless = multiplier → 32×fontSize = huge)
  const px = (n) => `${Number(n)}px`;
  // Helper to ensure font-family overrides global CSS - use selected font exactly
  const getFontFamily = () => style.fontFamily || "'Tahoma', 'Arial', sans-serif";
  
  // Build container style - CSS variable will be set via useEffect and ref
  const receiptContainerStyle = {
    width: 384,
    padding: px(style.padding),
    fontSize: px(style.bodyFont),
    lineHeight: px(style.lineHeight),
    color: '#000',
    fontWeight: 700,
    textAlign: 'right',
    background: '#fff',
  };
  
  // Styles matching Java rendering exactly - font-family handled by CSS variable
  const lineStyle = { 
    fontSize: px(style.bodyFont), 
    fontWeight: 700, 
    margin: 0, 
    lineHeight: px(style.lineHeight), 
    textAlign: 'right'
  };
  const headerStyle = { 
    fontSize: px(style.headerFont), 
    fontWeight: 800, 
    margin: 0, 
    color: '#000', 
    lineHeight: px(style.lineHeight), 
    textAlign: 'right'
  };
  // Separator styles matching Java: 2px solid black, sepMargin spacing
  const sepStyle = { 
    borderTop: '2px solid #000', 
    marginTop: px(style.sepMargin || 15), 
    marginBottom: px(style.sepMargin || 15),
    height: 0
  };
  // Dashed separator matching Java: 1px dashed gray, sepMargin spacing
  const sepDashedStyle = { 
    borderTop: '1px dashed #666', 
    marginTop: px(style.sepMargin || 15), 
    marginBottom: px(style.sepMargin || 15),
    height: 0
  };
  // Empty gap matching Java exactly
  const emptyStyle = { 
    height: px(style.emptyGap), 
    margin: 0, 
    overflow: 'hidden',
    lineHeight: px(style.emptyGap)
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', direction: 'rtl' }}>
      <Toaster position="top-center" />
      <h1 style={{ marginBottom: 8, fontSize: 28, fontWeight: 700 }}>🧾 شكل الإيصال</h1>
      <p style={{ marginBottom: 24, color: '#666', fontSize: 14 }}>
        خصّص الخط والمسافات ثم اضغط <strong>«حفظ»</strong> — الشكل يُحفظ ويُطبَق على الطباعة الفعلية (H10) بحيث يطابق المعاينة.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 900 ? '1fr' : 'minmax(384px, auto) 1fr', gap: 32 }}>
        {/* Receipt preview — compact spacing like ReceiptStylePreview.html / printed */}
        <div style={{ background: '#fff', width: 384, boxShadow: '0 12px 40px rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', position: 'sticky', top: 24 }}>
          {/* Isolate preview from global CSS - use selected font exactly */}
          <div ref={previewContainerRef} style={receiptContainerStyle} className="receipt-preview-container">
            {/* Logo - matching Java rendering */}
            <div style={{ textAlign: 'center', marginBottom: px(style.logoSpacingAfter ?? 25) }}>
              <img src="/receipt_logo.png" alt="" style={{ maxWidth: px(style.logoMaxWidth ?? 150), height: 'auto', display: 'block', margin: '0 auto' }} onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            
            {/* Separator line matching Java: 2px solid black (matches "================================") */}
            <div style={sepStyle} />
            
            {/* Order header - matching buildReceiptText structure exactly */}
            <div style={lineStyle}>طلب رقم #a1b2c3</div>
            <div style={lineStyle}>06.03.2025, 14:35:22</div>
            
            {/* Dashed separator matching Java (matches "- - - - - - - - - - - - - - - -") */}
            <div style={sepDashedStyle} />
            
            {/* Empty line matching buildReceiptText */}
            <div style={emptyStyle} />
            
            {/* Customer info section */}
            <div style={headerStyle}>--- معلومات العميل ---</div>
            <div style={lineStyle}>الاسم: محمد أحمد</div>
            <div style={lineStyle}>الهاتف: 0501234567</div>
            
            {/* Dashed separator */}
            <div style={sepDashedStyle} />
            
            {/* Delivery details section */}
            <div style={headerStyle}>--- تفاصيل التوصيل ---</div>
            <div style={lineStyle}>نوع الطلب: استلام من المطعم</div>
            <div style={lineStyle}>طريقة الدفع: نقداً (كاش)</div>
            <div style={lineStyle}>عدد المنتجات: 1</div>
            
            {/* Dashed separator */}
            <div style={sepDashedStyle} />
            
            {/* Products section */}
            <div style={emptyStyle} />
            <div style={headerStyle}>--- تفاصيل المنتجات ---</div>
            <div style={emptyStyle} />
            <div style={lineStyle}>1. سلطة الجزر (M)</div>
            <div style={{ ...lineStyle, paddingRight: px(style.padding) }}>   الكمية: 1 × ₪48.00</div>
            <div style={emptyStyle} />
            
            {/* Separator before total */}
            <div style={sepStyle} />
            
            {/* Total amount - matching Java rendering exactly */}
            <div style={{ 
              border: '3px solid #000', 
              padding: `${px(style.lineHeight / 2)} ${px(style.padding)}`, 
              margin: `${px(style.sepMargin || 15)} 0`, 
              textAlign: 'center', 
              fontSize: px(style.totalFont), 
              fontWeight: 800, 
              background: '#f5f5f5', 
              lineHeight: px(style.lineHeight)
              // fontFamily handled by CSS variable
            }}>
              المبلغ الإجمالي: ₪172.00
            </div>
            
            {/* Separator after total */}
            <div style={sepStyle} />
            
            {/* Footer - matching Java rendering */}
            <div style={{ 
              textAlign: 'center', 
              marginTop: px(style.sepMargin || 15), 
              fontSize: px(style.footerFont), 
              fontWeight: 600, 
              lineHeight: px(style.lineHeight)
              // fontFamily handled by CSS variable
            }}>
              <div style={{ marginBottom: px(style.emptyGap / 2) }}>{(style.footerTextEn || 'Thank you for using {brandName} App').replace('{brandName}', brandConfig?.name || 'Luqma')}</div>
              <div>{(style.footerTextAr || 'شكراً لاستخدامكم تطبيق {brandName}').replace('{brandName}', brandConfig?.name || 'Luqma')}</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>🎛️ تخصيص الخط والمسافات</h2>

          {RECEIPT_STYLE_CONTROLS.map(({ key, label, min, max }) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#495057' }}>{label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={style[key]}
                  onChange={(e) => updateStyle(key, parseInt(e.target.value, 10))}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={style[key]}
                  onChange={(e) => updateStyle(key, Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
                  style={{ width: 64, padding: '8px 10px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14 }}
                />
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#495057' }}>الخط</label>
            <select
              value={style.fontFamily}
              onChange={(e) => updateStyle('fontFamily', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14 }}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#212529' }}>📝 نص التذييل (Footer Text)</h3>
            <p style={{ marginBottom: 16, fontSize: 12, color: '#6c757d' }}>
              يمكنك استخدام {'{brandName}'} كمتغير سيتم استبداله باسم العلامة التجارية تلقائياً.
            </p>
            
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#495057' }}>النص الإنجليزي (English Text)</label>
              <input
                type="text"
                value={style.footerTextEn || 'Thank you for using {brandName} App'}
                onChange={(e) => updateStyle('footerTextEn', e.target.value)}
                placeholder="Thank you for using {brandName} App"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#495057' }}>النص العربي (Arabic Text)</label>
              <input
                type="text"
                value={style.footerTextAr || 'شكراً لاستخدامكم تطبيق {brandName}'}
                onChange={(e) => updateStyle('footerTextAr', e.target.value)}
                placeholder="شكراً لاستخدامكم تطبيق {brandName}"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, direction: 'rtl', textAlign: 'right' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px solid #dee2e6' }}>
            <p style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#212529' }}>
              حفظ الشكل وتطبيقه على الطباعة
            </p>
            <p style={{ marginBottom: 16, fontSize: 12, color: '#6c757d' }}>
              عند الضغط على «حفظ»، يُخزَّن الشكل ويُرسَل إلى الطابعة (H10) عند كل طباعة — المطبوع يطابق المعاينة أعلاه.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '14px 28px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 17,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(40,167,69,0.35)',
                }}
              >
                {saving ? 'جاري الحفظ...' : '💾 حفظ (Save)'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '12px 24px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                إعادة القيم الافتراضية
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptStylePage;
