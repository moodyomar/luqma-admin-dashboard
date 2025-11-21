// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import brandConfig from '../constants/brandConfig';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import AudioUnlocker, { getSharedAudio } from '../src/components/AudioUnlocker';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from '../src/contexts/AuthContext';
import './styles.css';
import { IoMdCheckmark, IoMdCheckmarkCircleOutline, IoMdClose, IoMdRestaurant, IoMdBicycle } from 'react-icons/io';

// Normalize deliveryDateTime into a Date instance
const getScheduledDate = (dateTime) => {
  if (!dateTime) return null;
  try {
    if (dateTime?.toDate && typeof dateTime.toDate === 'function') {
      return dateTime.toDate();
    }
    if (dateTime instanceof Date) {
      return dateTime;
    }
    const parsed = new Date(dateTime);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.warn('Error parsing deliveryDateTime:', error);
    return null;
  }
};

// Helper function to check if an order is a future/scheduled order
const isFutureOrder = (order) => {
  if (!order.deliveryDateTime) return false;
  if (order.status !== 'pending') return false; // Only pending orders can be future orders
  
  const scheduledTime = getScheduledDate(order.deliveryDateTime);
  if (!scheduledTime) return false;

  return scheduledTime > new Date();
};

const pluralizeAr = (value, singular, plural) => (value === 1 ? singular : plural);
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

const formatFutureOrderMeta = (deliveryDateTime) => {
  const scheduled = getScheduledDate(deliveryDateTime);
  if (!scheduled) return null;

  const dateStr = scheduled.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const timeStr = scheduled.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const diff = scheduled.getTime() - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  let relativeLabel = null;
  if (diff > 0) {
    const days = Math.floor(diff / dayMs);
    const hours = Math.floor((diff % dayMs) / hourMs);
    const minutes = Math.floor((diff % hourMs) / minuteMs);

    if (days > 0) {
      const hoursPart = hours > 0 ? ` و ${formatNumber(hours)} ${pluralizeAr(hours, 'ساعة', 'ساعات')}` : '';
      relativeLabel = `يبدأ خلال ${formatNumber(days)} ${pluralizeAr(days, 'يوم', 'أيام')}${hoursPart}`;
    } else if (hours > 0) {
      const minutesPart = minutes > 0 ? ` و ${formatNumber(minutes)} ${pluralizeAr(minutes, 'دقيقة', 'دقائق')}` : '';
      relativeLabel = `يبدأ خلال ${formatNumber(hours)} ${pluralizeAr(hours, 'ساعة', 'ساعات')}${minutesPart}`;
    } else if (minutes > 0) {
      relativeLabel = `يبدأ خلال ${formatNumber(minutes)} ${pluralizeAr(minutes, 'دقيقة', 'دقائق')}`;
    } else {
      relativeLabel = 'يبدأ خلال أقل من دقيقة';
    }
  } else {
    relativeLabel = 'حان وقت التحضير';
  }

  return { dateStr, timeStr, relativeLabel, scheduled };
};

const OrderCard = React.memo(({ order, orderTimers, startTimerForOrder, activeBusinessId }) => {

  const deliveryString = order.deliveryMethod === 'delivery' ? 'توصيل للبيت' : 
                        order.deliveryMethod === 'eat_in' ? 'اكل بالمطعم' : 'استلام بالمحل'
  const paymentString = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين'

  const [showPrepTime, setShowPrepTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const [prepTimeOptions, setPrepTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch prep time options from business config
  useEffect(() => {
    async function fetchPrepOptions() {
      const ref = doc(db, 'menus', brandConfig.id);
      const snap = await getDoc(ref);
      let options = snap.exists() && snap.data().config?.prepTimeOptions;
      if (!options || !Array.isArray(options) || options.length === 0) {
        options = [
          { value: 20, unit: 'minutes' },
          { value: 25, unit: 'minutes' },
          { value: 30, unit: 'minutes' },
          { value: 35, unit: 'minutes' },
          { value: 40, unit: 'minutes' }
        ];
      }
      setPrepTimeOptions(options);
      setSelectedTime(options[0]);
    }
    fetchPrepOptions();
  }, []);

  const buildReceiptHtml = (order) => {
    const orderId = (order.uid || order.id || '').slice(0, 6);
    const driver = order.deliveryMethod === 'delivery' && order.assignedDriverName
      ? `السائق: ${order.assignedDriverName}` : null;
    const addressBlock = order.deliveryMethod === 'delivery'
      ? `العنوان: ${order.address || 'غير محدد'}`
      : order.deliveryMethod === 'eat_in' && order.tableNumber
        ? `رقم الطاولة: ${order.tableNumber}`
        : 'نوع الطلب: استلام من المطعم';

    const items = (order.cart || []).map((item, index) => {
      const name = item.name?.ar || item.name || '';
      const qty = item.quantity || 1;
      const size = item.optionsText ? ` (${item.optionsText})` : '';
      const extras = Array.isArray(item.selectedExtras)
        ? item.selectedExtras
            .map(extra => (typeof extra === 'object' ? extra.label?.ar || '' : ''))
            .filter(Boolean)
        : [];

      return `
        <div class="item">
          <div class="item-header">
            <span>${index + 1} - ${name}${size}</span>
            <span>× ${qty}</span>
          </div>
          ${extras.length ? `<div class="item-extras">إضافات: ${extras.join('، ')}</div>` : ''}
          ${item.note ? `<div class="item-note">ملاحظة: ${item.note}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>إيصال الطلب</title>
      <style>
        @page { size: 58mm auto; margin: 4mm; }
        body { font-family: 'Cairo', 'Tahoma', sans-serif; margin: 0; padding: 0 4mm; direction: rtl; text-align: right; font-size: 13px; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 16px; margin: 4px 0; }
        .section { margin-bottom: 10px; }
        .section-title { font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
        .item { border-bottom: 1px dashed #ccc; padding: 6px 0; }
        .item:last-child { border-bottom: none; }
        .item-header { display: flex; justify-content: space-between; font-weight: bold; }
        .item-extras, .item-note { font-size: 12px; color: #444; margin-top: 2px; }
        .footer { text-align: center; margin-top: 12px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>طلب #${orderId}</h1>
        <div>${order.date || ''}</div>
      </div>
      <div class="section">
        <div>الاسم: ${order.name || 'غير محدد'}</div>
        <div>الهاتف: ${order.phone || 'غير محدد'}</div>
        <div>${driver || ''}</div>
        <div>${addressBlock}</div>
        ${order.extraNotes ? `<div>ملاحظات الموقع: ${order.extraNotes}</div>` : ''}
      </div>
      <div class="section">
        <div>طريقة التوصيل: ${deliveryString}</div>
        <div>الدفع: ${paymentString === 'اونلاين' ? 'مدفوع عبر الإنترنت' : paymentString}</div>
        <div>عدد المنتجات: ${order.cart?.length || 0}</div>
        <div>الإجمالي: ₪${order.total || order.price}</div>
      </div>
      <div class="section">
        <div class="section-title">تفاصيل الطلب</div>
        ${items || '<div>لا توجد منتجات</div>'}
      </div>
      ${order.note ? `
        <div class="section">
          <div class="section-title">ملاحظة الزبون</div>
          <div>${order.note}</div>
        </div>` : ''}
      <div class="footer">شكراً لاستخدامكم تطبيق لقمة</div>
    </body>
  </html>
`;
  };

  const buildReceiptText = (order) => {
    const shortId = (order.uid || order.id || '').toString().slice(0, 6);
    const lines = [];
    const money = (value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return '₪0.00';
      return `₪${num.toFixed(2)}`;
    };

    lines.push(`طلب رقم #${shortId}`);
    if (order.date) lines.push(`التاريخ: ${order.date}`);
    lines.push('');
    if (order.name) lines.push(`الاسم: ${order.name}`);
    if (order.phone) lines.push(`الهاتف: ${order.phone}`);
    if (order.assignedDriverName) lines.push(`السائق: ${order.assignedDriverName}`);
    if (order.deliveryMethod === 'delivery') {
      lines.push(`نوع الطلب: توصيل`);
      lines.push(`العنوان: ${order.address || 'غير محدد'}`);
    } else if (order.deliveryMethod === 'eat_in') {
      lines.push(`نوع الطلب: أكل بالمطعم`);
      if (order.tableNumber) lines.push(`رقم الطاولة: ${order.tableNumber}`);
    } else {
      lines.push(`نوع الطلب: استلام بالمحل`);
    }
    if (order.extraNotes) lines.push(`ملاحظات الموقع: ${order.extraNotes}`);
    if (order.paymentMethod) {
      const paymentLabel = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين';
      lines.push(`الدفع: ${paymentLabel}`);
    }
    lines.push(`عدد المنتجات: ${order.cart?.length || 0}`);
    lines.push(`الإجمالي: ${money(order.total || order.price || 0)}`);
    lines.push('');
    lines.push('--- تفاصيل الطلب ---');

    (order.cart || []).forEach((item, index) => {
      const name = item.name?.ar || item.name || `منتج ${index + 1}`;
      const qty = item.quantity || 1;
      const price = money(item.totalPrice || item.price || 0);
      const options = item.optionsText ? ` (${item.optionsText})` : '';
      lines.push(`${index + 1}. ${name}${options} × ${qty} - ${price}`);

      if (Array.isArray(item.selectedExtras) && item.selectedExtras.length) {
        const extras = item.selectedExtras
          .map(extra => (typeof extra === 'object' ? (extra.label?.ar || extra.label || '') : extra))
          .filter(Boolean);
        if (extras.length) {
          lines.push(`   إضافات: ${extras.join(', ')}`);
        }
      }

      if (item.note) {
        lines.push(`   ملاحظة: ${item.note}`);
      }
    });

    if (order.note) {
      lines.push('');
      lines.push(`ملاحظة الزبون: ${order.note}`);
    }

    lines.push('');
    lines.push(`الإجمالي النهائي: ${money(order.total || order.price || 0)}`);
    lines.push('');
    lines.push('شكراً لاستخدامكم تطبيق لقمة');

    return lines.join('\n');
  };

  const canUseNativePrinter = () =>
    typeof window !== 'undefined' &&
    window.PosPrinter &&
    typeof window.PosPrinter.printText === 'function';

  const handlePrint = (order) => {
    const receiptText = buildReceiptText(order);
    if (canUseNativePrinter()) {
      try {
        window.PosPrinter.printText(receiptText);
        return;
      } catch (err) {
        console.error('Native POS print failed', err);
      }
    }

    const receiptHtml = buildReceiptHtml(order);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      alert('الرجاء السماح بفتح النوافذ المنبثقة للطباعة.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    const triggerPrint = () => {
      try {
        printWindow.print();
      } catch (err) {
        console.error('Print error', err);
        alert('تعذر إرسال أمر الطباعة. الرجاء إعادة المحاولة.');
      }
    };
    if (printWindow.document.readyState === 'complete') {
      triggerPrint();
    } else {
      printWindow.onload = triggerPrint;
    }
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };

  // Accept order and set prep time
  const handleAcceptOrder = () => {
    setShowPrepTime(true);
  };

  const handleSetTimeAndAccept = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'menus', activeBusinessId, 'orders', order.id);
      await updateDoc(ref, {
        status: 'preparing',
        prepTimeMinutes: selectedTime.value,
        prepTimeUnit: selectedTime.unit,
        acceptedAt: new Date().toISOString(),
      });
      
      // Start the countdown timer
      const prepTimeMinutes = selectedTime.value;
      startTimerForOrder(order.id || order.uid, prepTimeMinutes);
      
      setShowPrepTime(false);
    } catch (err) {
      alert('שגיאה בעדכון ההזמנה.');
    } finally {
      setLoading(false);
    }
  };

  // Mark order as ready
  const handleOrderReady = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        status: 'ready',
        readyAt: new Date().toISOString(),
      });
    } catch (err) {
      alert('שגיאה בעדכון ההזמנה.');
    } finally {
      setLoading(false);
    }
  };

  // Mark order as out for delivery
  const handleOutForDelivery = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        status: 'out_for_delivery',
        outForDeliveryAt: new Date().toISOString(),
      });
    } catch (err) {
      alert('שגיאה בעדכון ההזמנה.');
    } finally {
      setLoading(false);
    }
  };



  // Enhanced status badge with colors and icons
  const getStatusBadge = () => {
    const statusConfig = {
      'pending': { text: 'جديد', color: '#007bff', icon: '💙', bgColor: '#e3f2fd' },
      'preparing': { text: 'قيد التحضير', color: '#ffc107', icon: '🟡', bgColor: '#fffbf0' },
      'ready': { text: 'جاهز', color: '#28a745', icon: '🟢', bgColor: '#f0fff4' },
      'out_for_delivery': { text: 'قيد التوصيل', color: '#17a2b8', icon: '🔵', bgColor: '#e0f7fa' },
      'delivered': { text: 'مكتمل', color: '#6c757d', icon: '⚫', bgColor: '#f8f9fa' },
      'completed': { text: 'مكتمل', color: '#6c757d', icon: '⚫', bgColor: '#f8f9fa' },
      'cancelled': { text: 'ملغي', color: '#dc3545', icon: '❌', bgColor: '#fee' }
    };

    const config = statusConfig[order.status] || statusConfig['pending'];
    
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: '12px',
        fontWeight: 'bold',
        border: `1px solid ${config.color}20`
      }}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </div>
    );
  };

  // Check if this is a new order (created in last 5 minutes)
  const isNewOrder = useMemo(() => {
    const orderTime = new Date(order.createdAt);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return orderTime > fiveMinutesAgo;
  }, [order.createdAt]);

  // Smart preparation time estimation based on order complexity
  const estimatedPrepTime = useMemo(() => {
    if (!order.items || order.items.length === 0) return 15;
    
    let totalTime = 0;
    order.items.forEach(item => {
      const quantity = item.quantity || 1;
      // Base time per item type (in minutes)
      const baseTime = item.name?.toLowerCase().includes('pizza') ? 20 :
                      item.name?.toLowerCase().includes('burger') ? 15 :
                      item.name?.toLowerCase().includes('salad') ? 10 :
                      item.name?.toLowerCase().includes('drink') ? 2 :
                      item.name?.toLowerCase().includes('appetizer') ? 8 : 12;
      
      totalTime += baseTime * quantity;
    });
    
    // Add complexity bonus
    if (order.items.length > 3) totalTime += 5;
    if (order.items.some(item => item.additions && item.additions.length > 2)) totalTime += 3;
    
    return Math.min(Math.max(totalTime, 10), 45); // Between 10-45 minutes
  }, [order.items]);

  const futureOrder = isFutureOrder(order);
  const futureMeta = useMemo(() => {
    if (!futureOrder) return null;
    return formatFutureOrderMeta(order.deliveryDateTime);
  }, [futureOrder, order.deliveryDateTime]);

  return (
    <div 
      className="order-card"
      style={{
        animation: isNewOrder ? 'pulse 2s ease-in-out infinite' : 'none',
        border: isNewOrder ? '2px solid #28a745' : '1px solid #ddd'
      }}
    >
      <div className="order-header">
        <div className="dateCol">
          <span className="order-date">{order.date}</span>
          <span className="order-id">#{(order.uid || order.id)?.slice(0, 6)}</span>
        </div>
        <div className="print-row">
          <button className="printingBtn" onClick={() => handlePrint(order)}>🖨️</button>
        </div>
      </div>

      {/* New Order Badge */}
      {isNewOrder && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#28a745',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold',
          animation: 'fadeOut 30s ease-out forwards'
        }}>
          جديد!
        </div>
      )}

      {/* Status Badge and Driver Name Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: futureOrder ? '6px' : '10px', flexWrap: 'wrap', gap: '8px' }}>
        {/* Status Badge + Future Badge Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {getStatusBadge()}
          {futureOrder && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#fff3cd',
              border: '1px solid #ffbb00',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#b37400'
            }}>
              <span>⏰</span>
              <span>طلب مستقبلي</span>
            </div>
          )}
        </div>
        {/* Driver Name - Left Side (Second) */}
        {order.deliveryMethod === 'delivery' && order.assignedDriverName && (
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: '#e8f5e9',
            border: '1px solid #4caf50',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2e7d32'
          }}>
            <span>🚗</span>
            <span>{order.assignedDriverName}</span>
            {order.assignedAt && (
              <span style={{ fontSize: '10px', color: '#666', marginRight: 2 }}>
                ({new Date(order.assignedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
        )}
      </div>

      {futureOrder && futureMeta && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderRadius: '14px',
          background: '#fff8e6',
          border: '1px dashed #ffc107',
          marginBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📅</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#b37400' }}>
                مجدول لـ {futureMeta.dateStr}
              </span>
              <span style={{ fontSize: '13px', color: '#555' }}>
                عند الساعة {futureMeta.timeStr}
              </span>
            </div>
          </div>
          {futureMeta.relativeLabel && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#ffe8ba',
              color: '#8a5a00',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              <span>⏳</span>
              <span>{futureMeta.relativeLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Countdown Timer */}
      {order.status === 'preparing' && estimatedPrepTime && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: orderTimers[order.id || order.uid] <= 300 ? '#ffebee' : '#e3f2fd', // Red if less than 5 min
          color: orderTimers[order.id || order.uid] <= 300 ? '#d32f2f' : '#1976d2', // Red if less than 5 min
          fontSize: '12px',
          fontWeight: 'bold',
          border: `1px solid ${orderTimers[order.id || order.uid] <= 300 ? '#ffcdd2' : '#bbdefb'}`,
          marginBottom: '10px',
          marginLeft: '10px'
        }}>
          <span>⏱️</span>
          <span>
            وقت متبقي: {orderTimers[order.id || order.uid] ? 
              `${Math.floor(orderTimers[order.id || order.uid] / 60)}:${String(orderTimers[order.id || order.uid] % 60).padStart(2, '0')}` : 
              `${estimatedPrepTime}:00`} دقيقة
          </span>
        </div>
      )}


      <div className="row">
        <div>
          <span className="label">👤</span>
          <span className="value">{order.name || '—'}</span>
        </div>
        <div>
          <span className="value" style={{ display: 'flex', alignItems: 'center' }}>
            {order.phone ? (
              <a href={`tel:${order.phone}`} style={{ color: '#007aff', textDecoration: 'none', fontWeight: 'inherit', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginLeft: 8 }}>📞</span>
                {order.phone.replace(/^\+/, '')}
              </a>
            ) : (
              <>
                <span style={{ marginLeft: 8 }}>📞</span>
                —
              </>
            )}
          </span>
        </div>
      </div>

      {/* Delivery and Payment in one row */}
      <div className="row">
        <div>
          <span className="label">🚚 التوصيل:</span>
          <span className="value">{deliveryString || '—'}</span>
        </div>
        <div>
          <span className="label">💳 {paymentString === 'اونلاين' ? 'وضع الطلب:' : 'الدفع:'}</span>
          <span className="value">{paymentString === 'اونلاين' ? 'مدفوع' : paymentString || '—'}</span>
        </div>
      </div>

      {/* Products and Price row */}
      <div className="row">
        <div>
          <span className="label">📦 عدد المنتجات:</span>
          <span className="value">{order.cart?.length || 0}</span>
        </div>
        <div>
          <span className="label">💰 السعر:</span>
          <span className="value order-price">₪{order.total || order.price}</span>
        </div>
      </div>

      {/* Show address for delivery orders */}
      {order.deliveryMethod === 'delivery' && (
        <p>
          <span className="label">📍 العنوان:</span>
          <span className="value">{order.address || '—'}</span>
        </p>
      )}

      {/* Show table number for eat-in orders */}
      {order.deliveryMethod === 'eat_in' && order.tableNumber && (
        <p>
          <span className="label">🪑 رقم الطاولة:</span>
          <span className="value">{order.tableNumber}</span>
        </p>
      )}

      {/* Show extraNotes for delivery orders */}
      {order.deliveryMethod === 'delivery' && order.extraNotes && (
        <p style={{ marginTop: -10, color: '#999', fontSize: 13 }}>
          📝 ملاحظات الموقع: {order.extraNotes}
        </p>
      )}

      {order.cart?.length > 0 && (
        <div className="order-meals">
          <p className="meals-title">تفاصيل الوجبات:</p>
          <ul>
            {order.cart.map((item, index) => (
              <li key={`${order.uid || order.id}-${index}-${item.uid || item.id || item.name || 'item'}`} className="meal-item" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                {item.image && (
                  <img
                    src={item.image}
                    alt="meal"
                    className="meal-image"
                    loading="lazy"
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {item.name?.ar || item.name} × {item.quantity}
                    {item.optionsText && <span style={{ color: '#666' }}> – {item.optionsText}</span>}
                  </div>
                  {Array.isArray(item.selectedExtras) && item.selectedExtras.length > 0 && (
                    <div style={{ fontSize: 13, color: '#999' }}>
                      إضافات:{' '}
                      {item.selectedExtras
                        .map(extra => {
                          if (typeof extra === 'object') {
                            return extra.label?.ar || extra.label || '';
                          }
                          return '';
                        })
                        .filter(Boolean)
                        .join('، ')}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.note && (
        <div style={{ marginTop: 20, padding: 12, background: '#f9f9f9', borderRadius: 6 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>📌 ملاحظة الزبون:</p>
          <p style={{ margin: 0, color: '#444' }}>{order.note}</p>
        </div>
      )}

      {/* Action buttons for order status */}
      {order.status === 'pending' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          {!showPrepTime ? (
            <button onClick={() => setShowPrepTime(true)} disabled={loading} style={{ fontWeight: 700, padding: '10px 28px', borderRadius: 8, background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}>
              <IoMdCheckmarkCircleOutline style={{ marginLeft: 8 }} />
              اقبل الطلب
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              <select value={JSON.stringify(selectedTime)} onChange={e => setSelectedTime(JSON.parse(e.target.value))} style={{ fontSize: 16, padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontWeight: 500 }}>
                {prepTimeOptions.map((opt, idx) => (
                  <option key={idx} value={JSON.stringify(opt)}>
                    {opt.value} {opt.unit === 'minutes' ? 'דקות' : opt.unit === 'hours' ? 'שעה' : 'יום'}
                  </option>
                ))}
              </select>
              <button onClick={handleSetTimeAndAccept} disabled={loading} style={{ fontWeight: 700, padding: '10px 28px', borderRadius: 8, background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}>
                <IoMdCheckmark style={{ marginLeft: 8 }} />
                تأكيد
              </button>
              <button onClick={() => setShowPrepTime(false)} disabled={loading} style={{ fontWeight: 600, padding: '10px 18px', borderRadius: 8, background: '#ccc', color: '#222', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                <IoMdClose style={{ marginLeft: 8 }} />
                إلغاء
              </button>
            </div>
          )}
        </div>
      )}
      {order.status === 'preparing' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleOrderReady} disabled={loading} style={{ fontWeight: 600, padding: '10px 28px', borderRadius: 8, background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}>
            <IoMdRestaurant style={{ marginLeft: 8 }} />
            الطلب جاهز
          </button>
        </div>
      )}
      {order.status === 'ready' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          {order.deliveryMethod === 'delivery' ? (
            <div style={{ 
              padding: '10px 20px', 
              background: '#f8f9fa', 
              color: '#6c757d', 
              borderRadius: 8, 
              fontSize: 16, 
              fontWeight: 500,
              border: '1px solid #dee2e6'
            }}>
              في انتظار السائق لبدء التوصيل
            </div>
          ) : order.deliveryMethod === 'eat_in' ? (
            <>
              <div style={{ 
                padding: '10px 20px', 
                background: '#f8f9fa', 
                color: '#6c757d', 
                borderRadius: 8, 
                fontSize: 16, 
                fontWeight: 500,
                border: '1px solid #dee2e6'
              }}>
                الطلب جاهز للطاولة {order.tableNumber} 🔔
              </div>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
                    await updateDoc(ref, {
                      status: 'delivered',
                      deliveredAt: new Date().toISOString(),
                    });
                  } catch (err) {
                    alert('שגיאה בעדכון ההזמנה.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{
                  fontWeight: 700,
                  padding: '10px 24px',
                  borderRadius: 8,
                  background: '#34C759',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  marginRight: 10,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                تم التوصيل للطاولة
              </button>
            </>
          ) : (
            <>
              <div style={{ 
                padding: '10px 20px', 
                background: '#f8f9fa', 
                color: '#6c757d', 
                borderRadius: 8, 
                fontSize: 16, 
                fontWeight: 500,
                border: '1px solid #dee2e6'
              }}>
                الطلب جاهز للاستلام 🔔
              </div>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
                    await updateDoc(ref, {
                      status: 'delivered',
                      deliveredAt: new Date().toISOString(),
                    });
                  } catch (err) {
                    alert('שגיאה בעדכון ההזמנה.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{
                  fontWeight: 700,
                  padding: '10px 24px',
                  borderRadius: 8,
                  background: '#34C759',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  marginRight: 10,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                تم الاستلام
              </button>
            </>
          )}
        </div>
      )}
      {/* Note: Delivery status is now managed by drivers */}
      {order.status === 'out_for_delivery' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            padding: '10px 20px', 
            background: '#f8f9fa', 
            color: '#6c757d', 
            borderRadius: 8, 
            fontSize: 16, 
            fontWeight: 500,
            border: '1px solid #dee2e6'
          }}>
            🚚 قيد التوصيل بواسطة السائق
          </div>
        </div>
      )}

    </div>
  );
});

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [prevOrdersCount, setPrevOrdersCount] = useState(0);
  const isFirstLoad = useRef(true); // 🟡 new flag
  const knownOrderIds = useRef(new Set()); // Track known order IDs to detect truly new orders
  const [viewType, setViewType] = useState('new'); // 'new', 'active', 'past', 'future'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'delivery', 'pickup', 'eat_in'
  const [searchTerm, setSearchTerm] = useState(''); // Search functionality
  const [orderTimers, setOrderTimers] = useState({}); // Track countdown timers for each order
  const { activeBusinessId } = useAuth();

  // Function to start a timer for an order
  const startTimerForOrder = (orderId, estimatedMinutes) => {
    setOrderTimers(prev => ({
      ...prev,
      [orderId]: estimatedMinutes * 60 // Convert minutes to seconds
    }));
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      return orderDateOnly.getTime() === today.getTime();
    });

    const activeOrders = orders.filter(order => !['delivered', 'completed', 'cancelled'].includes(order.status));
    const newOrdersLastHour = orders.filter(order => {
      const orderTime = new Date(order.createdAt);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return orderTime > oneHourAgo;
    });

    const totalSalesToday = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgPrepTime = todayOrders.length > 0 
      ? Math.round(todayOrders.reduce((sum, order) => sum + (order.prepTime || 15), 0) / todayOrders.length)
      : 15;

    return {
      totalSalesToday,
      activeOrdersCount: activeOrders.length,
      avgPrepTime,
      newOrdersLastHour: newOrdersLastHour.length
    };
  }, [orders]);


  useEffect(() => {
    if (!activeBusinessId) return;
    
    const unsubscribe = onSnapshot(
      collection(db, 'menus', activeBusinessId, 'orders'), (snapshot) => {
        const updatedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setOrders(updatedOrders);

        if (isFirstLoad.current) {
          // On first load, populate known order IDs without playing sound
          isFirstLoad.current = false;
          updatedOrders.forEach(order => {
            knownOrderIds.current.add(order.id);
          });
        } else {
          // Check for truly new orders by comparing order IDs
          const newOrders = updatedOrders.filter(order => {
            const isNewOrder = !knownOrderIds.current.has(order.id);
            if (isNewOrder) {
              knownOrderIds.current.add(order.id);
            }
            return isNewOrder;
          });

          // Only play sound and show toast if there are actually new orders
          if (newOrders.length > 0) {
            // Try to use the unlocked audio first, fallback to new Audio
            const unlockedAudio = getSharedAudio();
            if (unlockedAudio) {
              unlockedAudio.currentTime = 0;
              unlockedAudio.play().catch(err => {
                console.warn('Failed to play unlocked audio, trying fallback:', err);
                new Audio('/luqma.mp3').play().catch(console.warn);
              });
            } else {
              new Audio('/luqma.mp3').play().catch(console.warn);
            }
            
            toast.custom(() => (
              <div style={{
                background: '#fff8c4',
                padding: '14px 20px',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '16px',
                color: '#222',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                direction: 'rtl'
              }}>
                📦 طلب جديد وصل!
              </div>
            ), {
              duration: 7000 // or even longer like 10000 for 10s
            });
          }
        }

        setPrevOrdersCount(updatedOrders.length);
      });

    return () => unsubscribe();
  }, [activeBusinessId]);

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setOrderTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        Object.keys(newTimers).forEach(orderId => {
          if (newTimers[orderId] > 0) {
            newTimers[orderId] = newTimers[orderId] - 1;
          } else {
            delete newTimers[orderId]; // Remove completed timers
          }
        });
        return newTimers;
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Initialize timers for orders that are preparing
  useEffect(() => {
    const newTimers = {};
    const now = new Date();
    
    orders.forEach(order => {
      const orderId = order.id || order.uid;
      
      // Only start timer for orders that are preparing and don't already have a timer
      if (order.status === 'preparing' && !orderTimers[orderId]) {
        // Use the prep time that was set when order was accepted
        let prepTimeMinutes = order.prepTimeMinutes || 15; // default 15 minutes if not set
        
        // Calculate actual remaining time based on when order was accepted
        let remainingSeconds = prepTimeMinutes * 60;
        
        // If we have acceptedAt timestamp, calculate elapsed time
        if (order.acceptedAt || order.preparingStartedAt) {
          const startTime = new Date(order.acceptedAt || order.preparingStartedAt);
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          remainingSeconds = Math.max(0, (prepTimeMinutes * 60) - elapsedSeconds);
        }
        
        newTimers[orderId] = remainingSeconds;
      }
    });
    
    if (Object.keys(newTimers).length > 0) {
      setOrderTimers(prev => ({ ...prev, ...newTimers }));
    }
  }, [orders]);

  // Separate future orders from regular orders
  const { futureOrders, regularOrders } = useMemo(() => {
    const future = [];
    const regular = [];
    
    orders.forEach(order => {
      if (isFutureOrder(order)) {
        future.push(order);
      } else {
        regular.push(order);
      }
    });
    
    return { futureOrders: future, regularOrders: regular };
  }, [orders]);

  const sortedOrders = useMemo(() => {
    let filtered = [...regularOrders]; // Only work with regular orders (exclude future orders)
    
    // Apply delivery method filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => order.deliveryMethod === activeFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        // Search by customer name, phone, order ID, or items
        const nameMatch = order.name?.toLowerCase().includes(searchLower);
        const phoneMatch = order.phone?.includes(searchTerm);
        const idMatch = (order.uid || order.id)?.toLowerCase().includes(searchLower);
        const itemsMatch = order.cart?.some(item => 
          (item.name?.ar || item.name)?.toLowerCase().includes(searchLower)
        ) || order.items?.some(item => 
          item.name?.toLowerCase().includes(searchLower)
        );
        return nameMatch || phoneMatch || idMatch || itemsMatch;
      });
    }
    
    // Sort orders: prioritize by status for better workflow
    return filtered.sort((a, b) => {
      // Status priority (lower number = higher priority = shown first)
      const statusPriority = {
        'pending': 1,        // New orders - highest priority
        'preparing': 2,      // Being prepared - need attention
        'ready': 3,          // Ready for pickup - need driver
        'out_for_delivery': 4, // With driver - lowest priority for restaurant
        'delivered': 5,
        'completed': 5,
        'served': 5,
        'cancelled': 6
      };
      
      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;
      
      // If same status, sort by newest first
      if (priorityA === priorityB) {
        const timeA = new Date(a.createdAt);
        const timeB = new Date(b.createdAt);
        return timeB - timeA;
      }
      
      return priorityA - priorityB;
    });
  }, [regularOrders, activeFilter, searchTerm]);

  // Sort future orders by scheduled time (soonest first)
  const sortedFutureOrders = useMemo(() => {
    return futureOrders.sort((a, b) => {
      try {
        const getTime = (order) => {
          if (order.deliveryDateTime?.toDate) {
            return order.deliveryDateTime.toDate().getTime();
          }
          return new Date(order.deliveryDateTime).getTime();
        };
        return getTime(a) - getTime(b);
      } catch {
        return 0;
      }
    });
  }, [futureOrders]);

  const newOrders = sortedOrders.filter(order => order.status === 'pending');
  const activeOrders = sortedOrders.filter(order =>
    ['preparing', 'ready', 'active', 'out_for_delivery'].includes(order.status)
  );
  const pastOrders = sortedOrders.filter(order =>
    ['delivered', 'completed'].includes(order.status)
  );

  return (
    <div className="orders-container" style={{ 
      paddingBottom: window.innerWidth < 768 ? '20px' : '20px', // No extra space needed since bottom nav is hidden on orders page
      overflowX: 'hidden',
      maxWidth: '100%',
      paddingTop: '50px' // Perfect spacing from top bar
    }}>
      


      {/* View Toggle and Filter Buttons */}
      <div className="filter-buttons-container" style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        marginTop: '15px', // More extra space from top
        padding: '0 10px',
        overflowX: 'auto'
      }}>
        {/* All Orders */}
        <button
          onClick={() => setActiveFilter('all')}
          style={{
            padding: '6px 10px',
            borderRadius: '18px',
            border: activeFilter === 'all' ? '2px solid #007bff' : '1px solid #ddd',
            background: activeFilter === 'all' ? '#007bff' : 'white',
            color: activeFilter === 'all' ? 'white' : '#333',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            minWidth: '110px'
          }}
        >
          📊 كل الطلبات ({orders.length})
        </button>
        
        {/* Delivery */}
        <button
          onClick={() => setActiveFilter('delivery')}
          style={{
            padding: '6px 10px',
            borderRadius: '18px',
            border: activeFilter === 'delivery' ? '2px solid #28a745' : '1px solid #28a745',
            background: activeFilter === 'delivery' ? '#28a745' : 'white',
            color: activeFilter === 'delivery' ? 'white' : '#28a745',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            minWidth: '90px'
          }}
        >
          🚚 توصيل ({orders.filter(order => order.deliveryMethod === 'delivery' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
        
        {/* Pickup */}
        <button
          onClick={() => setActiveFilter('pickup')}
          style={{
            padding: '6px 10px',
            borderRadius: '18px',
            border: activeFilter === 'pickup' ? '2px solid #ffc107' : '1px solid #ffc107',
            background: activeFilter === 'pickup' ? '#ffc107' : 'white',
            color: activeFilter === 'pickup' ? 'white' : '#ffc107',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            minWidth: '90px'
          }}
        >
          🏪 استلام ({orders.filter(order => order.deliveryMethod === 'pickup' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
        
        {/* Eat-in */}
        <button
          onClick={() => setActiveFilter('eat_in')}
          style={{
            padding: '8px 10px',
            borderRadius: '20px',
            border: activeFilter === 'eat_in' ? '2px solid #17a2b8' : '1px solid #17a2b8',
            background: activeFilter === 'eat_in' ? '#17a2b8' : 'white',
            color: activeFilter === 'eat_in' ? 'white' : '#17a2b8',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            minWidth: '120px'
          }}
        >
          🍽️ اكل بالمطعم ({orders.filter(order => order.deliveryMethod === 'eat_in' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
      </div>

      {/* Advanced Search Bar */}
      <div style={{
        margin: '0 auto 20px auto',
        maxWidth: '500px',
        position: 'relative'
      }}>
        <input
          type="text"
          placeholder="🔍 البحث عن الطلبات (اسم العميل، رقم الهاتف، رقم الطلب، أو اسم الوجبة)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 20px 12px 45px',
            borderRadius: '25px',
            border: '2px solid #e0e0e0',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.3s ease',
            backgroundColor: '#f8f9fa'
          }}
          onFocus={(e) => e.target.style.borderColor = '#007bff'}
          onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#999'
            }}
          >
            ✕
          </button>
        )}
      </div>

      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <AudioUnlocker />
      
      
      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
          }
          @keyframes fadeOut {
            0% { opacity: 1; }
            90% { opacity: 1; }
            100% { opacity: 0; }
          }
          
          /* Hide scrollbars for filter buttons */
          .filter-buttons-container::-webkit-scrollbar {
            display: none;
          }
          
          .filter-buttons-container {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
      {viewType === 'new' ? (
        newOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات جديدة.</p>
        ) : (
          <div className="orders-grid">
            {newOrders.map((order, index) => (
              <OrderCard key={`new-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} />
            ))}
          </div>
        )
      ) : viewType === 'active' ? (
        activeOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات نشطة.</p>
        ) : (
          <div className="orders-grid">
            {activeOrders.map((order, index) => (
              <OrderCard key={`active-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} />
            ))}
          </div>
        )
      ) : viewType === 'future' ? (
        sortedFutureOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات مجدولة.</p>
        ) : (
          <div className="orders-grid">
            {sortedFutureOrders.map((order, index) => (
              <OrderCard key={`future-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} />
            ))}
          </div>
        )
      ) : (
        pastOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات سابقة.</p>
        ) : (
          <div className="orders-grid">
            {pastOrders.map((order, index) => (
              <OrderCard key={`past-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} />
            ))}
          </div>
        )
      )}
      
      {/* Bottom Status Tabs - Modern like bottom navigation */}
      <div className="bottom-status-tabs" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70px',
        borderTop: '1px solid #e5e5e7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 0',
        zIndex: 9999,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 -2px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={() => setViewType('new')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ position: 'relative' }}>
            <span style={{ 
              fontSize: '20px', 
              color: viewType === 'new' ? '#007AFF' : '#666'
            }}>
              📦
            </span>
            {newOrders.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#FF3B30',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
              }}>
                {newOrders.length > 9 ? '9+' : newOrders.length}
              </div>
            )}
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '500',
            color: viewType === 'new' ? '#007AFF' : '#666'
          }}>
            طلبات جديدة
          </span>
        </button>

        <button
          onClick={() => setViewType('active')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ position: 'relative' }}>
            <span style={{ 
              fontSize: '20px', 
              color: viewType === 'active' ? '#34C759' : '#666'
            }}>
              ⏳
            </span>
            {activeOrders.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#FF9500',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
              }}>
                {activeOrders.length > 9 ? '9+' : activeOrders.length}
              </div>
            )}
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '500',
            color: viewType === 'active' ? '#34C759' : '#666'
          }}>
            طلبات قيد التحضير
          </span>
        </button>

        <button
          onClick={() => setViewType('future')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ position: 'relative' }}>
            <span style={{ 
              fontSize: '20px', 
              color: viewType === 'future' ? '#4A90E2' : '#666'
            }}>
              📅
            </span>
            {sortedFutureOrders.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#4A90E2',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
              }}>
                {sortedFutureOrders.length > 9 ? '9+' : sortedFutureOrders.length}
              </div>
            )}
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '500',
            color: viewType === 'future' ? '#4A90E2' : '#666'
          }}>
            طلبات مجدولة
          </span>
        </button>

        <button
          onClick={() => setViewType('past')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ 
            fontSize: '20px', 
            color: viewType === 'past' ? '#8E8E93' : '#666'
          }}>
            ✅
          </span>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '500',
            color: viewType === 'past' ? '#8E8E93' : '#666'
          }}>
            طلبات سابقة
          </span>
        </button>
      </div>

      {/* Main Content Spacer for Bottom Tabs */}
      <div style={{ height: '80px' }} />
      
      <audio id="orderSound" preload="auto">
        <source src="/sounds/luqma.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default OrdersPage;
