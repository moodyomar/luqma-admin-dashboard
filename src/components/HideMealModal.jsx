import { FiX, FiClock, FiEyeOff, FiAlertCircle } from 'react-icons/fi';

const HideMealModal = ({ visible, onClose, onMarkUnavailable, onHidePermanent, onHideUntilTomorrow, mealName }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          direction: 'rtl',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: '#666',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FiX />
        </button>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 18,
            fontWeight: 600,
            color: '#333',
            textAlign: 'right',
          }}
        >
          إخفاء المادة | הסתרת פריט
        </h3>

        {/* Meal name */}
        {mealName && (
          <p
            style={{
              margin: '0 0 20px 0',
              fontSize: 14,
              color: '#666',
              textAlign: 'right',
            }}
          >
            {mealName}
          </p>
        )}

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Mark as unavailable (NEW) */}
          <button
            onClick={async () => {
              if (onMarkUnavailable) {
                await onMarkUnavailable();
              }
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: '2px solid #9e9e9e',
              backgroundColor: '#f5f5f5',
              color: '#424242',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              transition: 'all 0.2s',
              textAlign: 'right',
              direction: 'rtl',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eeeeee';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FiAlertCircle style={{ fontSize: 20, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                تعطيل المادة (تظهر لكن غير متاحة)
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                סמן פריט כלא זמין (יוצג אבל לא ניתן להזמין)
              </div>
            </div>
          </button>

          {/* Hide until tomorrow */}
          <button
            onClick={() => {
              onHideUntilTomorrow();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: '2px solid #4CAF50',
              backgroundColor: '#f1f8f4',
              color: '#2e7d32',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              transition: 'all 0.2s',
              textAlign: 'right',
              direction: 'rtl',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e8f5e9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f8f4';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FiClock style={{ fontSize: 20, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                إخفاء حتى الغد الساعة 7 صباحاً
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                הסתר עד מחר בשעה 7
              </div>
            </div>
          </button>

          {/* Hide permanently */}
          <button
            onClick={() => {
              onHidePermanent();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 12,
              border: '2px solid #ff9800',
              backgroundColor: '#fff3e0',
              color: '#e65100',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              transition: 'all 0.2s',
              textAlign: 'right',
              direction: 'rtl',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffe0b2';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff3e0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FiEyeOff style={{ fontSize: 20, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                إخفاء دائم
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                הסתר לצמיתות
              </div>
            </div>
          </button>
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: '1px solid #e0e0e0',
            backgroundColor: '#f5f5f5',
            color: '#666',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#eeeeee';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
        >
          إلغاء | ביטול
        </button>
      </div>
    </div>
  );
};

export default HideMealModal;

