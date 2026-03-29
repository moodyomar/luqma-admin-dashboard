// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import brandConfig from '../constants/brandConfig';
import { formatPrice } from '../utils/formatPrice';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from '../src/contexts/AuthContext';
import './styles.css';
import './pos-terminal.css';
import { IoMdCheckmark, IoMdCheckmarkCircleOutline, IoMdClose, IoMdRestaurant, IoMdBicycle, IoMdPrint } from 'react-icons/io';
import QuickMealsManager from '../src/components/QuickMealsManager';

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

// Helper: order is a reservation request (eat-in, not yet confirmed by admin)
const isReservationRequest = (order) => order.reservationStatus === 'reservation_request';

// Helper: reservation order is waiting for client to pay (not yet reservation_paid)
const isReservationAwaitingPayment = (order) =>
  order.reservationStatus && order.reservationStatus !== 'reservation_paid';

// Helper: reservation is paid and table assigned (fully complete from admin perspective)
const isReservationFullyComplete = (order) =>
  order.reservationStatus === 'reservation_paid' && !!order.tableNumber;

const pluralizeAr = (value, singular, plural) => (value === 1 ? singular : plural);
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

/** Display phone as 05xxx (replace +972 with 0) in UI and printed receipt */
const formatPhoneDisplay = (phone) => {
  if (!phone || typeof phone !== 'string') return phone || '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+972')) return '0' + trimmed.slice(4);
  return trimmed;
};

/** Same as receipt: sum of line items (excludes delivery, app fee, discounts). */
const sumOrderCartSubtotal = (order) => {
  if (!order?.cart || !Array.isArray(order.cart)) return 0;
  return order.cart.reduce((sum, item) => {
    const itemPrice = parseFloat(item.totalPrice || item.price || 0);
    const quantity = parseInt(item.quantity || 1, 10);
    return sum + itemPrice * quantity;
  }, 0);
};

/**
 * Card: السعر uses subtotalExDelivery (excludes customer delivery).
 * deliveryFee when non-null is the customer delivery charge (stored or inferred); for driver popover only.
 */
const getOrderCardPriceParts = (order) => {
  const paid = parseFloat(order.total ?? order.price ?? 0);
  const safePaid = Number.isFinite(paid) ? paid : 0;
  const dfRaw = order.deliveryFee;
  const dfStored = typeof dfRaw === 'number' ? dfRaw : parseFloat(dfRaw);
  const hasStoredDeliveryFee =
    order.deliveryMethod === 'delivery' &&
    Number.isFinite(dfStored) &&
    dfStored > 0;
  if (hasStoredDeliveryFee) {
    return {
      subtotalExDelivery: Math.max(0, safePaid - dfStored),
      deliveryFee: dfStored,
    };
  }

  if (order.deliveryMethod === 'delivery' && !(order.pointsUsed > 0)) {
    const cartSum = sumOrderCartSubtotal(order);
    const appFee = Number(order.appFee) || 0;
    const couponDisc = Number(order.couponDiscount) || 0;
    const inferredDf = Math.round((safePaid - cartSum - appFee + couponDisc) * 100) / 100;
    if (inferredDf > 0.005 && inferredDf <= safePaid + 0.01) {
      return {
        subtotalExDelivery: Math.max(0, safePaid - inferredDf),
        deliveryFee: inferredDf,
      };
    }
  }

  return { subtotalExDelivery: safePaid, deliveryFee: null };
};

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

const OrderCard = React.memo(({ order, orderTimers, startTimerForOrder, activeBusinessId, receiptStyle }) => {

  const orderCardPrices = getOrderCardPriceParts(order);

  const deliveryString = order.deliveryMethod === 'delivery' ? 'توصيل للبيت' : 
                        order.deliveryMethod === 'eat_in' ? 'اكل بالمطعم' : 'استلام بالمحل'
  const paymentString = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين'
  const showAsPaid = paymentString === 'اونلاين' && !isReservationAwaitingPayment(order);
  const isReservationPaid = order.reservationStatus === 'reservation_paid';

  const [showPrepTime, setShowPrepTime] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const [prepTimeOptions, setPrepTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTableAssignment, setShowTableAssignment] = useState(false);
  const [selectedTableNumber, setSelectedTableNumber] = useState('');
  const [tableAssignmentLoading, setTableAssignmentLoading] = useState(false);
  const [showSuggestAlternativesModal, setShowSuggestAlternativesModal] = useState(false);
  const [alternativeSlots, setAlternativeSlots] = useState([{ date: '', time: '12:00' }]);
  const [reservationActionLoading, setReservationActionLoading] = useState(false);

  const driverContactRef = useRef(null);
  const [driverMenuOpen, setDriverMenuOpen] = useState(false);
  const [driverPhone, setDriverPhone] = useState(null);
  const [driverPhoneFetched, setDriverPhoneFetched] = useState(false);
  const [driverPhoneLoading, setDriverPhoneLoading] = useState(false);

  useEffect(() => {
    setDriverMenuOpen(false);
    setDriverPhone(null);
    setDriverPhoneFetched(false);
    setDriverPhoneLoading(false);
  }, [order.assignedDriverId, order.id]);

  useEffect(() => {
    if (!driverMenuOpen) return;
    const onPointerDown = (e) => {
      if (driverContactRef.current && !driverContactRef.current.contains(e.target)) {
        setDriverMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [driverMenuOpen]);

  const openDriverMenu = async (e) => {
    e.stopPropagation();
    const next = !driverMenuOpen;
    setDriverMenuOpen(next);
    if (!next || !order.assignedDriverId || !activeBusinessId || driverPhoneFetched) return;
    setDriverPhoneLoading(true);
    try {
      const userRef = doc(db, 'menus', activeBusinessId, 'users', order.assignedDriverId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const p = snap.data().phone;
        setDriverPhone(typeof p === 'string' && p.trim() ? p.trim() : null);
      } else {
        setDriverPhone(null);
      }
    } catch (err) {
      console.warn('[OrdersPage] Could not load driver phone:', err);
      setDriverPhone(null);
    } finally {
      setDriverPhoneFetched(true);
      setDriverPhoneLoading(false);
    }
  };

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
        ? `رقم الطاولة: ${order.tableNumber}${order.numberOfPeople ? ` (${order.numberOfPeople} أشخاص)` : ''}`
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
        <div>الهاتف: ${formatPhoneDisplay(order.phone) || 'غير محدد'}</div>
        <div>${driver || ''}</div>
        <div>${addressBlock}</div>
        ${order.extraNotes ? `<div>ملاحظات الموقع: ${order.extraNotes}</div>` : ''}
      </div>
      <div class="section">
        <div>طريقة التوصيل: ${deliveryString}</div>
        ${order.deliveryMethod === 'eat_in' && order.numberOfPeople ? `<div>عدد الأشخاص: ${order.numberOfPeople}</div>` : ''}
        <div>الدفع: ${(order.reservationStatus && order.reservationStatus !== 'reservation_paid')
          ? 'بأنتظار الدفع'
          : (paymentString === 'اونلاين' ? 'مدفوع عبر الإنترنت' : paymentString)}</div>
        <div>عدد المنتجات: ${order.cart?.length || 0}</div>
        ${order.couponCode ? `<div>كوبون: ${order.couponCode} — خصم ₪${formatPrice(order.couponDiscount ?? 0)}</div>` : ''}
      </div>
      ${(() => {
        // Future Order Indicator - Show if order is scheduled for future (Arabic format, before total)
        if (!order.deliveryDateTime) return '';
        try {
          let deliveryDate;
          // Handle Firestore Timestamp
          if (order.deliveryDateTime.toDate && typeof order.deliveryDateTime.toDate === 'function') {
            deliveryDate = order.deliveryDateTime.toDate();
          } else if (order.deliveryDateTime instanceof Date) {
            deliveryDate = order.deliveryDateTime;
          } else {
            deliveryDate = new Date(order.deliveryDateTime);
          }
          
          if (!isNaN(deliveryDate.getTime())) {
            const now = new Date();
            if (deliveryDate > now) {
              // Format date and time in Arabic format (DD-MM-YYYY HH:MM)
              const year = deliveryDate.getFullYear();
              const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
              const day = String(deliveryDate.getDate()).padStart(2, '0');
              const hours = String(deliveryDate.getHours()).padStart(2, '0');
              const minutes = String(deliveryDate.getMinutes()).padStart(2, '0');
              
              // Get Arabic day name
              const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
              const dayName = dayNames[deliveryDate.getDay()];
              
              const dateStr = `${day}-${month}-${year}`;
              const timeStr = `${hours}:${minutes}`;
              
              return `
        <div class="section" style="background-color: #fff3cd; padding: 8px; border-radius: 4px; border: 1px solid #ffc107; margin-bottom: 10px;">
          <div class="section-title" style="color: #856404;">⚠️ طلب مستقبلي ليوم ${dayName}</div>
          <div style="color: #856404;">تاريخ: ${dateStr}</div>
          <div style="color: #856404;">الساعه: ${timeStr}</div>
        </div>`;
            }
          }
        } catch (error) {
          console.error('Error formatting future order date:', error);
        }
        return '';
      })()}
      ${(() => {
        // Calculate total excluding delivery fee for receipt
        const orderTotal = parseFloat(order.total || order.price || 0);
        let cartSubtotal = 0;
        if (order.cart && Array.isArray(order.cart)) {
          cartSubtotal = order.cart.reduce((sum, item) => {
            const itemPrice = parseFloat(item.totalPrice || item.price || 0);
            const quantity = parseInt(item.quantity || 1);
            return sum + (itemPrice * quantity);
          }, 0);
        }
        // Receipt total = cart subtotal only (excludes delivery fee)
        const receiptTotal = cartSubtotal;
        return `<div class="section">
          <div>الإجمالي: ₪${receiptTotal.toFixed(2)}</div>
        </div>`;
      })()}
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

  const canUseNativePrinter = () =>
    typeof window !== 'undefined' &&
    window.PosPrinter &&
    typeof window.PosPrinter.printText === 'function';

  const handlePrint = async (order) => {
    console.log('🖨️ Print requested for order:', order.id);
    
    const receiptText = buildReceiptText(order, receiptStyle);
    const receiptStyleJson = receiptStyle ? JSON.stringify(receiptStyle) : null;
    
    // Try native POS printer first (silent printing)
    if (canUseNativePrinter()) {
      try {
        console.log('✅ Using native POS printer (H10)');
        const result = await window.PosPrinter.printText(receiptText, receiptStyleJson || '');
        console.log('Print result:', result);
        
        if (result && result.includes('success')) {
          toast.success('✅ تمت الطباعة بنجاح', {
            duration: 2000,
            position: 'top-center',
            style: {
              fontSize: '18px',
              fontWeight: '700',
              padding: '16px 24px',
            },
          });
          return;
        } else if (result && result.includes('error')) {
          console.error('Native print error:', result);
          toast.error('❌ خطأ في الطباعة: ' + result, {
            duration: 3000,
            position: 'top-center',
          });
          return;
        }
      } catch (err) {
        console.error('Native POS print failed:', err);
        toast.error('❌ فشل الاتصال بالطابعة', {
          duration: 3000,
          position: 'top-center',
        });
        // Continue to fallback
      }
    }

    // Fallback to browser print dialog
    console.log('⚠️ Using fallback browser print');
    const receiptHtml = buildReceiptHtml(order);
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      toast.error('الرجاء السماح بفتح النوافذ المنبثقة للطباعة.', {
        duration: 4000,
        position: 'top-center',
      });
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
        toast.error('تعذر إرسال أمر الطباعة. الرجاء إعادة المحاولة.', {
          duration: 3000,
          position: 'top-center',
        });
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

  // Silent print function - only uses native POS printer (no browser dialog)
  const silentPrint = async (orderData) => {
    if (!canUseNativePrinter()) {
      console.log('⚠️ Native printer not available, skipping silent print');
      return;
    }

    try {
      console.log('🖨️ Silent print for order:', orderData.id);
      const receiptText = buildReceiptText(orderData, receiptStyle);
      const receiptStyleJson = receiptStyle ? JSON.stringify(receiptStyle) : null;
      const result = await window.PosPrinter.printText(receiptText, receiptStyleJson || '');
      
      if (result && result.includes('success')) {
        console.log('✅ Silent print successful');
      } else if (result && result.includes('error')) {
        console.error('❌ Silent print error:', result);
        // Don't show toast for silent print to avoid interruption
      }
    } catch (err) {
      console.error('❌ Silent print failed:', err);
      // Don't show toast for silent print errors
    }
  };

  const buildReceiptText = (order, receiptStyle = null) => {
    const shortId = (order.uid || order.id || '').toString().slice(0, 6);
    const lines = [];
    const money = (value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return '₪0.00';
      return `₪${num.toFixed(2)}`;
    };
    
    // Helper to replace {brandName} placeholder
    const replaceBrandName = (text) => {
      if (!text) return '';
      return text.replace(/{brandName}/g, brandConfig.name || 'Luqma');
    };
    
    // Word wrap function for receipt (384px width, ~32 chars per line for Arabic - very conservative)
    const wrapText = (text, maxChars = 32, indent = '') => {
      if (!text || typeof text !== 'string') return [text || ''];
      const trimmedText = text.trim();
      if (trimmedText.length <= maxChars) {
        return [trimmedText];
      }
      
      console.log('🔄 Wrapping text:', trimmedText, 'Length:', trimmedText.length, 'Max:', maxChars);
      
      const wrappedLines = [];
      // Split by ' + ' pattern (this preserves the separator)
      const parts = trimmedText.split(/(\s*\+\s*)/);
      let currentLine = '';
      
      parts.forEach((part) => {
        if (!part || part.trim() === '') return;
        
        const testLine = currentLine + part;
        
        // If adding this part exceeds max length and we have content, wrap
        if (testLine.length > maxChars && currentLine.trim().length > 0) {
          wrappedLines.push(currentLine.trimEnd());
          // Start new line with indent
          currentLine = indent + part.trimStart();
        } else {
          currentLine = testLine;
        }
      });
      
      // Add the last line
      if (currentLine.trim()) {
        wrappedLines.push(currentLine.trimEnd());
      }
      
      // Final safety: force break any remaining long lines
      const finalLines = [];
      wrappedLines.forEach(line => {
        if (line.length <= maxChars) {
          finalLines.push(line);
        } else {
          // Break at word boundaries
          let remaining = line;
          while (remaining.length > maxChars) {
            // Look for break point (space or +)
            let breakPoint = maxChars;
            for (let i = maxChars; i >= Math.max(0, maxChars - 15); i--) {
              if (remaining[i] === ' ' || remaining[i] === '+') {
                breakPoint = i + 1;
                break;
              }
            }
            
            finalLines.push(remaining.substring(0, breakPoint).trimEnd());
            remaining = indent + remaining.substring(breakPoint).trimStart();
          }
          if (remaining.trim()) {
            finalLines.push(remaining.trimEnd());
          }
        }
      });
      
      console.log('✅ Wrapped into', finalLines.length, 'lines:', finalLines);
      return finalLines.filter(line => line && line.length > 0);
    };

    // Order Header
    lines.push('================================');
    lines.push(`طلب رقم #${shortId}`);
    if (order.date) lines.push(order.date);
    lines.push('- - - - - - - - - - - - - - - -');
    
    // Customer Information
    lines.push('');
    lines.push('--- معلومات العميل ---');
    if (order.name) lines.push(`الاسم: ${order.name}`);
    if (order.phone) lines.push(`الهاتف: ${formatPhoneDisplay(order.phone)}`);
    lines.push('- - - - - - - - - - - - - - - -');
    
    // Delivery Details
    lines.push('');
    lines.push('--- تفاصيل التوصيل ---');
      if (order.deliveryMethod === 'delivery') {
      lines.push(`نوع الطلب: توصيل للمنزل`);
      const addressText = `العنوان: ${order.address || 'غير محدد'}`;
      wrapText(addressText, 38).forEach(line => lines.push(line));
      if (order.extraNotes) {
        const notesText = `ملاحظات: ${order.extraNotes}`;
        wrapText(notesText, 38).forEach(line => lines.push(line));
      }
    } else if (order.deliveryMethod === 'eat_in') {
      lines.push(`نوع الطلب: أكل بالمطعم`);
      if (order.tableNumber) lines.push(`رقم الطاولة: ${order.tableNumber}`);
      if (order.numberOfPeople) lines.push(`عدد الأشخاص: ${order.numberOfPeople}`);
    } else {
      lines.push(`نوع الطلب: استلام من المطعم`);
    }
    
    if (order.paymentMethod) {
      const isAwaiting = order.reservationStatus && order.reservationStatus !== 'reservation_paid';
      const paymentLabel = isAwaiting ? 'بأنتظار الدفع' : (order.paymentMethod === 'cash' ? 'نقداً (كاش)' : 'مدفوع اونلاين');
      lines.push(`طريقة الدفع: ${paymentLabel}`);
    }
    lines.push(`عدد المنتجات: ${order.cart?.length || 0}`);
    if (order.couponCode) {
      lines.push(`كوبون: ${order.couponCode}${order.couponDiscount != null && order.couponDiscount > 0 ? ` (-${money(order.couponDiscount)})` : ''}`);
    }
    lines.push('- - - - - - - - - - - - - - - -');
    
    // Product Details
    lines.push('');
    lines.push('--- تفاصيل المنتجات ---');
    lines.push('');

    (order.cart || []).forEach((item, index) => {
      const name = item.name?.ar || item.name || `منتج ${index + 1}`;
      const qty = item.quantity || 1;
      const price = money(item.totalPrice || item.price || 0);
      const options = item.optionsText ? ` (${item.optionsText})` : '';
      
      // Item line with clear formatting (wrap if too long)
      const itemLine = `${index + 1}. ${name}${options}`;
      const wrappedItemLine = wrapText(itemLine, 38);
      wrappedItemLine.forEach(line => lines.push(line));
      lines.push(`   الكمية: ${qty} × ${price}`);

      if (Array.isArray(item.selectedExtras) && item.selectedExtras.length) {
        const extras = item.selectedExtras
          .map(extra => (typeof extra === 'object' ? (extra.label?.ar || extra.label || '') : extra))
          .filter(Boolean);
        if (extras.length) {
          // Build extras text with proper spacing
          const extrasText = `   إضافات: ${extras.join(' + ')}`;
          // Wrap extras text, keeping indentation for continuation lines
          // Use 35 chars max (more conservative for 384px width)
          const wrappedExtras = wrapText(extrasText, 35, '   ');
          wrappedExtras.forEach(line => {
            // Ensure each line is properly formatted
            lines.push(line);
          });
        }
      }

      if (item.note) {
        const noteText = `   ملاحظة خاصة: ${item.note}`;
        const wrappedNote = wrapText(noteText, 38, '   ');
        wrappedNote.forEach(line => lines.push(line));
      }
      
      lines.push(''); // Space between items
    });

    if (order.note) {
      lines.push('--- ملاحظة العميل ---');
      const wrappedCustomerNote = wrapText(order.note, 38);
      wrappedCustomerNote.forEach(line => lines.push(line));
      lines.push('');
    }

    // Future Order Indicator - Show if order is scheduled for future (Arabic format, before total)
    if (order.deliveryDateTime) {
      try {
        let deliveryDate;
        // Handle Firestore Timestamp
        if (order.deliveryDateTime.toDate && typeof order.deliveryDateTime.toDate === 'function') {
          deliveryDate = order.deliveryDateTime.toDate();
        } else if (order.deliveryDateTime instanceof Date) {
          deliveryDate = order.deliveryDateTime;
        } else {
          deliveryDate = new Date(order.deliveryDateTime);
        }
        
        if (!isNaN(deliveryDate.getTime())) {
          const now = new Date();
          if (deliveryDate > now) {
            // Format date and time in Arabic format (DD-MM-YYYY HH:MM)
            const year = deliveryDate.getFullYear();
            const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
            const day = String(deliveryDate.getDate()).padStart(2, '0');
            const hours = String(deliveryDate.getHours()).padStart(2, '0');
            const minutes = String(deliveryDate.getMinutes()).padStart(2, '0');
            
            // Get Arabic day name
            const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = dayNames[deliveryDate.getDay()];
            
            const dateStr = `${day}-${month}-${year}`;
            const timeStr = `${hours}:${minutes}`;
            
            lines.push('');
            lines.push(`⚠️ طلب مستقبلي ليوم ${dayName}`);
            lines.push(`تاريخ: ${dateStr}`);
            lines.push(`الساعه: ${timeStr}`);
            lines.push('- - - - - - - - - - - - - - - -');
          }
        }
      } catch (error) {
        console.error('Error formatting future order date:', error);
      }
    }

    // Calculate total excluding delivery fee
    // Delivery fee should not appear on printed receipt
    const orderTotal = parseFloat(order.total || order.price || 0);
    let cartSubtotal = 0;
    if (order.cart && Array.isArray(order.cart)) {
      cartSubtotal = order.cart.reduce((sum, item) => {
        const itemPrice = parseFloat(item.totalPrice || item.price || 0);
        const quantity = parseInt(item.quantity || 1);
        return sum + (itemPrice * quantity);
      }, 0);
    }
    // Receipt total = cart subtotal only (excludes delivery fee)
    const receiptTotal = cartSubtotal;

    // Total with border
    lines.push('================================');
    lines.push(`المبلغ الإجمالي: ${money(receiptTotal)}`);
    lines.push('================================');
    
    // Footer text from receiptStyle (if available)
    if (receiptStyle) {
      const footerEn = receiptStyle.footerTextEn || 'Thank you for using {brandName} App';
      const footerAr = receiptStyle.footerTextAr || 'شكراً لاستخدامكم تطبيق {brandName}';
      lines.push('');
      lines.push(replaceBrandName(footerEn));
      lines.push(replaceBrandName(footerAr));
    }
    // If no receiptStyle provided, Java/Android will add footer from strings.xml

    // When titlesBoldOnly: prefix non-title lines with \u200B so Java draws them with normal weight
    if (receiptStyle && receiptStyle.titlesBoldOnly) {
      const isTitleLine = (line, index) => {
        const t = (line || '').trim();
        if (t.length === 0) return false; // empty stays as-is (Java uses emptyGap)
        if (/^=+$/.test(t.replace(/\s/g, ''))) return true;
        if (/^-+$/.test(t.replace(/\s/g, '')) || t.startsWith('- - -')) return true;
        if (/^--- .+ ---$/.test(t)) return true;
        if (line.includes('طلب رقم')) return true;
        if (index === 1 && lines[0] && lines[0].includes('طلب رقم')) return true;
        if (/^\d+\.\s/.test(t)) return true;
        if (line.includes('المبلغ الإجمالي') || line.includes('Total Amount')) return true;
        if (index >= lines.length - 2) return true; // footer
        return false;
      };
      for (let i = 0; i < lines.length; i++) {
        if (!isTitleLine(lines[i], i)) lines[i] = '\u200B' + lines[i];
      }
    }

    return lines.join('\n');
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
      
      // 🔥 AUTO-PRINT: Print receipt automatically after accepting order
      // Create updated order object with new status for printing
      const updatedOrder = {
        ...order,
        status: 'preparing',
        prepTimeMinutes: selectedTime.value,
        prepTimeUnit: selectedTime.unit,
        acceptedAt: new Date().toISOString(),
      };
      
      setShowPrepTime(false);
      
      // Print immediately after order is accepted - uses EXACT same logic as print button
      // Tries native POS printer first (silent), falls back to browser print dialog if needed
      // Small delay to ensure UI updates first
      setTimeout(async () => {
        await handlePrint(updatedOrder);
      }, 300);
      
      toast.success('✅ تم قبول الطلب وتمت الطباعة تلقائياً', {
        duration: 2000,
        position: 'top-center',
      });
    } catch (err) {
      console.error('Error accepting order:', err);
      alert('שגיאה בעדכון ההזמנה.');
    } finally {
      setLoading(false);
    }
  };

  // Check if table is available
  const checkTableAvailability = async (tableNum) => {
    try {
      const ordersRef = collection(db, 'menus', activeBusinessId, 'orders');
      const tableQuery = query(
        ordersRef,
        where('deliveryMethod', '==', 'eat_in'),
        where('tableNumber', '==', tableNum.toString().trim())
      );
      const snapshot = await getDocs(tableQuery);
      
      const activeStatuses = ['pending', 'preparing', 'ready'];
      for (const docSnap of snapshot.docs) {
        const orderData = docSnap.data();
        // Skip current order
        if (docSnap.id === order.id) continue;
        // Check if table is in use by active order
        if (activeStatuses.includes(orderData.status)) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error checking table availability:', error);
      return false;
    }
  };

  // Assign table to order
  const handleAssignTable = async () => {
    if (!selectedTableNumber.trim()) {
      alert('يرجى إدخال رقم الطاولة');
      return;
    }

    setTableAssignmentLoading(true);
    try {
      const tableNum = selectedTableNumber.trim();
      const isAvailable = await checkTableAvailability(tableNum);
      
      if (!isAvailable) {
        alert('الطاولة غير متاحة حالياً. يرجى اختيار طاولة أخرى.');
        setTableAssignmentLoading(false);
        return;
      }

      const ref = doc(db, 'menus', activeBusinessId, 'orders', order.id);
      await updateDoc(ref, {
        tableNumber: tableNum,
        tableAssignedAt: new Date().toISOString(),
      });
      
      setShowTableAssignment(false);
      setSelectedTableNumber('');
      toast.success(`تم تعيين الطاولة ${tableNum} بنجاح`, {
        duration: 2000,
        position: 'top-center',
      });
    } catch (err) {
      console.error('Error assigning table:', err);
      alert('خطأ في تعيين الطاولة: ' + err.message);
    } finally {
      setTableAssignmentLoading(false);
    }
  };

  // --- Reservation request actions (reservationStatus === 'reservation_request') ---
  const handleConfirmReservation = async () => {
    setReservationActionLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        reservationStatus: 'reservation_confirmed',
        reservationConfirmedAt: new Date().toISOString(),
      });
      toast.success('تم تأكيد الحجز. يمكن للعميل اختيار طريقة الدفع في التطبيق.', { position: 'top-center' });
    } catch (err) {
      console.error('Error confirming reservation:', err);
      toast.error('خطأ في تأكيد الحجز: ' + err.message);
    } finally {
      setReservationActionLoading(false);
    }
  };

  const handleSendAlternatives = async () => {
    const slots = alternativeSlots
      .map(({ date, time }) => {
        if (!date || !time) return null;
        const [h, m] = time.split(':').map(Number);
        const d = new Date(date);
        d.setHours(h || 0, m || 0, 0, 0);
        return { dateTime: d.toISOString(), label: `${date} ${time}` };
      })
      .filter(Boolean);
    if (slots.length === 0) {
      toast.error('أضف وقتاً واحداً على الأقل');
      return;
    }
    setReservationActionLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        reservationStatus: 'alternatives_sent',
        alternativeSlots: slots,
      });
      setShowSuggestAlternativesModal(false);
      setAlternativeSlots([{ date: '', time: '12:00' }]);
      toast.success('تم إرسال الأوقات البديلة للعميل.', { position: 'top-center' });
    } catch (err) {
      console.error('Error sending alternatives:', err);
      toast.error('خطأ: ' + err.message);
    } finally {
      setReservationActionLoading(false);
    }
  };

  const handleDeclineReservation = async () => {
    if (!window.confirm('رفض طلب الحجز؟ سيتم إبلاغ العميل.')) return;
    setReservationActionLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        reservationStatus: 'reservation_declined',
        declineReason: null,
      });
      toast.success('تم رفض طلب الحجز.', { position: 'top-center' });
    } catch (err) {
      console.error('Error declining reservation:', err);
      toast.error('خطأ: ' + err.message);
    } finally {
      setReservationActionLoading(false);
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

  // Shared metrics so status badge and driver chip are the same height (button UA styles otherwise grow the chip)
  const statusDriverChipBase = {
    boxSizing: 'border-box',
    lineHeight: 1.2,
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
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
        ...statusDriverChipBase,
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.color}20`,
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
        {/* Driver — click for phone (+ customer delivery fee when known) */}
        {order.deliveryMethod === 'delivery' && order.assignedDriverName && (
          <div ref={driverContactRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={openDriverMenu}
              aria-expanded={driverMenuOpen}
              aria-haspopup="true"
              className="order-driver-chip-btn"
              style={{
                ...statusDriverChipBase,
                appearance: 'none',
                WebkitAppearance: 'none',
                margin: 0,
                background: '#e8f5e9',
                border: '1px solid #4caf50',
                color: '#2e7d32',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span>🚗</span>
              <span>{order.assignedDriverName}</span>
              {order.assignedAt && (
                <span style={{ fontSize: '10px', color: '#666', marginRight: 2 }}>
                  ({new Date(order.assignedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </button>
            {driverMenuOpen && (
              <div
                role="menu"
                onClick={(ev) => ev.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  minWidth: 200,
                  maxWidth: 280,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#fff',
                  border: '1px solid #c8e6c9',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                  zIndex: 50,
                  textAlign: 'right',
                  direction: 'rtl',
                }}
              >
                {(() => {
                  const totalPaid = parseFloat(order.total ?? order.price ?? 0);
                  const safeTotal = Number.isFinite(totalPaid) ? totalPaid : 0;
                  const deliveryKnown =
                    order.deliveryMethod === 'delivery' &&
                    orderCardPrices.deliveryFee != null &&
                    orderCardPrices.deliveryFee > 0;
                  const row = {
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: 8,
                    userSelect: 'text',
                  };
                  return (
                    <>
                      <div style={{ ...row, marginBottom: 10 }}>
                        هاتف المرسل{' '}
                        {driverPhoneLoading ? (
                          <span style={{ color: '#666', fontWeight: 400 }}>…</span>
                        ) : driverPhone ? (
                          formatPhoneDisplay(driverPhone)
                        ) : (
                          <span style={{ color: '#888', fontWeight: 400 }}>—</span>
                        )}
                      </div>
                      <div style={{ ...row, paddingTop: 8, borderTop: '1px solid #eee' }}>
                        سعر التوصيل{' '}
                        {deliveryKnown ? `₪${formatPrice(orderCardPrices.deliveryFee)}` : '—'}
                      </div>
                      <div
                        style={{
                          ...row,
                          marginBottom: 0,
                          paddingTop: 8,
                          borderTop: '1px solid #eee',
                          color: '#2e7d32',
                        }}
                      >
                        السعر شامل ₪{formatPrice(safeTotal)}
                      </div>
                    </>
                  );
                })()}
              </div>
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
                {formatPhoneDisplay(order.phone)}
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
          <span className="label">💳 {showAsPaid || isReservationPaid ? 'وضع الطلب:' : paymentString === 'اونلاين' ? 'وضع الطلب:' : 'الدفع:'}</span>
          <span className="value">
            {showAsPaid || isReservationPaid ? (isReservationPaid && order.paymentMethod === 'cash' ? 'مدفوع (كاش عند الوصول)' : 'مدفوع') : paymentString === 'اونلاين' ? 'بأنتظار الدفع' : paymentString || '—'}
          </span>
        </div>
      </div>

      {/* Products and Price row (card: main price excludes delivery when deliveryFee is on the order) */}
      <div className="row">
        <div>
          <span className="label">📦 عدد المنتجات:</span>
          <span className="value">{order.cart?.length || 0}</span>
        </div>
        <div>
          <span className="label">💰 السعر:</span>
          <span className="value order-price">
            ₪{formatPrice(orderCardPrices.subtotalExDelivery)}
          </span>
        </div>
      </div>

      {(order.couponCode || (order.couponDiscount != null && order.couponDiscount > 0)) && (
        <p>
          <span className="label">🎫 كوبون:</span>
          <span className="value" style={{ color: '#2e7d32', fontWeight: 600 }}>
            {order.couponCode || '—'}
            {order.couponDiscount != null && order.couponDiscount > 0
              ? ` — خصم ₪${formatPrice(order.couponDiscount)}`
              : ''}
          </span>
        </p>
      )}

      {/* Show address for delivery orders */}
      {order.deliveryMethod === 'delivery' && (
        <p>
          <span className="label">📍 العنوان:</span>
          <span className="value">{order.address || '—'}</span>
        </p>
      )}

      {/* Show number of people and table assignment for eat-in orders */}
      {order.deliveryMethod === 'eat_in' && (
        <>
          {order.numberOfPeople && (
            <p>
              <span className="label">👥 عدد الأشخاص:</span>
              <span className="value">{order.numberOfPeople}</span>
            </p>
          )}
          {/* Future eat-in: table is assigned only via the bottom button; here just show it if set */}
          {isFutureOrder(order) ? (
            order.tableNumber && (
              <p>
                <span className="label">🪑 رقم الطاولة:</span>
                <span className="value">{order.tableNumber}</span>
              </p>
            )
          ) : order.tableNumber && !showTableAssignment ? (
            <p>
              <span className="label">🪑 رقم الطاولة:</span>
              <span className="value">{order.tableNumber}</span>
            </p>
          ) : (
            !isFutureOrder(order) && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              {!showTableAssignment ? (
                <button 
                  onClick={() => setShowTableAssignment(true)} 
                  disabled={loading}
                  style={{ 
                    fontWeight: 600, 
                    padding: '8px 16px', 
                    borderRadius: 8, 
                    background: '#007aff', 
                    color: '#fff', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>🪑</span>
                  <span>تعيين طاولة</span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={selectedTableNumber}
                    onChange={(e) => setSelectedTableNumber(e.target.value)}
                    placeholder="أدخل رقم الطاولة"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #ddd',
                      fontSize: 14,
                      width: '150px'
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAssignTable();
                      }
                    }}
                  />
                  <button 
                    onClick={handleAssignTable} 
                    disabled={tableAssignmentLoading}
                    style={{ 
                      fontWeight: 600, 
                      padding: '8px 16px', 
                      borderRadius: 8, 
                      background: '#34C759', 
                      color: '#fff', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: 14
                    }}
                  >
                    {tableAssignmentLoading ? 'جاري...' : 'تأكيد'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowTableAssignment(false);
                      setSelectedTableNumber('');
                    }}
                    disabled={tableAssignmentLoading}
                    style={{ 
                      fontWeight: 600, 
                      padding: '8px 16px', 
                      borderRadius: 8, 
                      background: '#ccc', 
                      color: '#222', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: 14
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>
            )
          )}
        </>
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
      {isReservationRequest(order) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: '10px 14px', background: '#fff3cd', color: '#856404', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
            طلب حجز — بانتظار التأكيد (العميل لم يدفع بعد)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={handleConfirmReservation}
              disabled={reservationActionLoading}
              style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8, background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15 }}
            >
              {reservationActionLoading ? 'جاري...' : 'أكد الحجز'}
            </button>
            <button
              onClick={() => setShowSuggestAlternativesModal(true)}
              disabled={reservationActionLoading}
              style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8, background: '#17a2b8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15 }}
            >
              اقترح أوقاتاً أخرى
            </button>
            <button
              onClick={handleDeclineReservation}
              disabled={reservationActionLoading}
              style={{ fontWeight: 600, padding: '10px 20px', borderRadius: 8, background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15 }}
            >
              رفض
            </button>
          </div>
          {showSuggestAlternativesModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>اقتراح أوقات بديلة</h3>
                <p style={{ margin: '0 0 16px', color: '#666', fontSize: 14 }}>أضف أوقاتاً متاحة وسيتم إرسالها للعميل لاختيار واحد والدفع.</p>
                {alternativeSlots.map((slot, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) => {
                        const next = [...alternativeSlots];
                        next[idx] = { ...next[idx], date: e.target.value };
                        setAlternativeSlots(next);
                      }}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8 }}
                    />
                    <input
                      type="time"
                      dir="ltr"
                      value={slot.time}
                      onChange={(e) => {
                        const next = [...alternativeSlots];
                        next[idx] = { ...next[idx], time: e.target.value };
                        setAlternativeSlots(next);
                      }}
                      style={{
                        width: 100,
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        direction: 'ltr',
                        textAlign: 'left',
                      }}
                    />
                    {alternativeSlots.length > 1 && (
                      <button type="button" onClick={() => setAlternativeSlots(alternativeSlots.filter((_, i) => i !== idx))} style={{ padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>حذف</button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={() => setAlternativeSlots([...alternativeSlots, { date: '', time: '12:00' }])} style={{ padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>+ إضافة وقت</button>
                  <button type="button" onClick={handleSendAlternatives} disabled={reservationActionLoading} style={{ padding: '8px 20px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{reservationActionLoading ? 'جاري...' : 'إرسال'}</button>
                  <button type="button" onClick={() => { setShowSuggestAlternativesModal(false); setAlternativeSlots([{ date: '', time: '12:00' }]); }} style={{ padding: '8px 16px', background: '#ccc', color: '#222', border: 'none', borderRadius: 8, cursor: 'pointer' }}>إلغاء</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {order.status === 'pending' && !isReservationRequest(order) && (() => {
        const isFuture = isFutureOrder(order);
        const futureMeta = isFuture ? formatFutureOrderMeta(order.deliveryDateTime) : null;
        
        // If it's a future order that hasn't arrived yet, show different button
        if (isFuture && futureMeta && futureMeta.scheduled > new Date()) {
          // Future order - can confirm reservation or wait until scheduled time
          return (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {/* For eat-in orders, allow confirming reservation + assigning table early */}
              {order.deliveryMethod === 'eat_in' ? (
                isReservationFullyComplete(order) ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      padding: '12px 20px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                      border: '1px solid #28a745',
                      color: '#155724',
                      fontSize: 15,
                      fontWeight: 600
                    }}
                  >
                    <span>✓ حجز مؤكد</span>
                    <span style={{ opacity: 0.8 }}>•</span>
                    <span>طاولة {order.tableNumber}</span>
                    <span style={{ opacity: 0.8 }}>•</span>
                    <span>مدفوع</span>
                  </div>
                ) : showTableAssignment ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <input
                      type="text"
                      value={selectedTableNumber}
                      onChange={(e) => setSelectedTableNumber(e.target.value)}
                      placeholder="أدخل رقم الطاولة"
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, width: '150px' }}
                      onKeyPress={(e) => { if (e.key === 'Enter') handleAssignTable(); }}
                    />
                    <button onClick={handleAssignTable} disabled={tableAssignmentLoading} style={{ fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                      {tableAssignmentLoading ? 'جاري...' : 'تأكيد'}
                    </button>
                    <button onClick={() => { setShowTableAssignment(false); setSelectedTableNumber(''); }} disabled={tableAssignmentLoading} style={{ fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: '#ccc', color: '#222', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <>
                    {order.tableNumber && isReservationAwaitingPayment(order) && (
                      <div style={{ fontSize: 13, color: '#856404', marginBottom: 4 }}>
                        طاولة {order.tableNumber} معينة • في انتظار الدفع
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        setSelectedTableNumber(order.tableNumber || '');
                        setShowTableAssignment(true);
                      }}
                      disabled={loading}
                      style={{ 
                        fontWeight: 600, 
                        padding: '10px 20px', 
                        borderRadius: 8, 
                        background: '#17a2b8', 
                        color: '#fff', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontSize: 16 
                      }}
                    >
                      {order.tableNumber ? 'تغيير الطاولة' : 'تأكيد الحجز وتعيين الطاولة'}
                    </button>
                  </>
                )
              ) : (
                <button 
                  onClick={() => setShowPrepTime(true)}
                  disabled={true}
                  style={{ 
                    fontWeight: 600, 
                    padding: '10px 28px', 
                    borderRadius: 8, 
                    background: '#ccc', 
                    color: '#666', 
                    border: 'none', 
                    cursor: 'not-allowed', 
                    fontSize: 16,
                    opacity: 0.6
                  }}
                >
                  سيتم تفعيل الزر عند وصول الموعد
                </button>
              )}
            </div>
          );
        }
        
        // Regular order or future order that has arrived - show normal accept button
        return (
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
        );
      })()}
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
                {order.tableNumber ? `الطلب جاهز للطاولة ${order.tableNumber} 🔔` : 'الطلب جاهز للتقديم 🔔'}
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
  // Printer detection helper
  const canUseNativePrinter = () =>
    typeof window !== 'undefined' &&
    window.PosPrinter &&
    typeof window.PosPrinter.printText === 'function';

  const [orders, setOrders] = useState([]);
  const [prevOrdersCount, setPrevOrdersCount] = useState(0);
  const isFirstLoad = useRef(true); // 🟡 new flag
  const knownOrderIds = useRef(new Set()); // Track known order IDs to detect truly new orders
  const futureOrderDuePlayedIds = useRef(new Set()); // Track which future orders we already played "due" sound for
  const ordersRef = useRef([]); // Latest orders for interval callback
  const [viewType, setViewType] = useState('new'); // 'new', 'active', 'past', 'future'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'delivery', 'pickup', 'eat_in'
  const [searchTerm, setSearchTerm] = useState(''); // Search functionality
  const [orderTimers, setOrderTimers] = useState({}); // Track countdown timers for each order
  const [showQuickMealsManager, setShowQuickMealsManager] = useState(false);
  const [receiptStyle, setReceiptStyle] = useState(null); // Receipt style from Firebase config
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


  // Fetch receipt style from Firebase config
  useEffect(() => {
    if (!activeBusinessId) return;
    const loadReceiptStyle = async () => {
      try {
        const ref = doc(db, 'menus', activeBusinessId);
        const snap = await getDoc(ref);
        const data = snap.data();
        const saved = data?.config?.receiptStyle;
        if (saved && typeof saved === 'object') {
          setReceiptStyle(saved);
        }
      } catch (e) {
        console.error('Failed to load receipt style:', e);
      }
    };
    loadReceiptStyle();
  }, [activeBusinessId]);

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
            // Play notification sound (works on Android WebView without unlock)
            try {
              const audio = new Audio(brandConfig.notificationSound);
              audio.volume = 1.0;
              audio.play().catch(err => {
                console.warn('Failed to play audio:', err);
              });
              
              // Track unaccepted orders: play "order not accepted yet" after 2 minutes if still pending
              const notAcceptedDelayMs = brandConfig.orderNotAcceptedAfterMs ?? 2 * 60 * 1000;
              const notAcceptedSound = brandConfig.orderNotAcceptedSound || brandConfig.notificationSound;
              newOrders.forEach(order => {
                if (order && (order.status === 'pending' || order.status === 'confirmed')) {
                  setTimeout(() => {
                    const checkOrder = async () => {
                      try {
                        const orderRef = doc(db, 'menus', activeBusinessId, 'orders', order.id);
                        const orderSnap = await getDoc(orderRef);
                        if (orderSnap.exists()) {
                          const currentOrder = orderSnap.data();
                          if (currentOrder.status === 'pending' || currentOrder.status === 'confirmed') {
                            try {
                              const audio = new Audio(notAcceptedSound);
                              audio.volume = 1.0;
                              audio.play().catch(err => console.warn('Failed to play order-not-accepted audio:', err));
                              console.log('🔔 Order not accepted yet – reminder sound:', order.id);
                              toast.custom(() => (
                                <div style={{
                                  background: '#ffecb3',
                                  padding: '14px 20px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  fontSize: '16px',
                                  color: '#222',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  direction: 'rtl'
                                }}>
                                  ⏱️ طلب لم يُقبل بعد – يرجى القبول
                                </div>
                              ), { duration: 8000 });
                            } catch (err) {
                              console.warn('Order-not-accepted audio error:', err);
                            }
                          }
                        }
                      } catch (err) {
                        console.warn('Error checking order status for not-accepted reminder:', err);
                      }
                    };
                    checkOrder();
                  }, notAcceptedDelayMs);
                }
              });
            } catch (err) {
              console.warn('Audio error:', err);
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

  // Keep ref in sync with orders for interval
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Future order due: every 30s check if any scheduled order's time has arrived; play sound once per order
  useEffect(() => {
    if (!activeBusinessId) return;
    const futureDueSound = brandConfig.futureOrderDueSound || brandConfig.notificationSound;
    const interval = setInterval(() => {
      const now = new Date();
      const currentOrders = ordersRef.current || [];
      currentOrders.forEach((order) => {
        if (order.status !== 'pending' || !order.deliveryDateTime) return;
        if (futureOrderDuePlayedIds.current.has(order.id)) return;
        const scheduled = getScheduledDate(order.deliveryDateTime);
        if (!scheduled || scheduled > now) return;
        futureOrderDuePlayedIds.current.add(order.id);
        try {
          const audio = new Audio(futureDueSound);
          audio.volume = 1.0;
          audio.play().catch((err) => console.warn('Failed to play future-order-due audio:', err));
          console.log('🔔 Future order due – play sound:', order.id);
          toast.custom(() => (
            <div style={{
              background: '#c8e6c9',
              padding: '14px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#222',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              direction: 'rtl'
            }}>
              📅 طلب مجدول – حان وقت التحضير
            </div>
          ), { duration: 8000 });
        } catch (err) {
          console.warn('Future-order-due audio error:', err);
        }
      });
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
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

  const testPrint = async () => {
    if (canUseNativePrinter()) {
      try {
        console.log('🖨️ Test print - Silent mode');
        const result = await window.PosPrinter.testPrint();
        console.log('Test print result:', result);
        
        if (result && result.includes('success')) {
          toast.success('✅ تمت الطباعة بنجاح!', {
            duration: 2000,
            position: 'top-center',
          });
        } else if (result && result.includes('error')) {
          toast.error('❌ خطأ: ' + result, {
            duration: 3000,
            position: 'top-center',
          });
        }
      } catch (err) {
        console.error('Test print error:', err);
        toast.error('❌ فشل اختبار الطباعة', { duration: 3000 });
      }
    } else {
      toast.error('⚠️ الطابعة غير متصلة', { 
        duration: 3000,
        position: 'top-center',
      });
    }
  };

  const [printerStatus, setPrinterStatus] = React.useState(null);
  const [showPrinterBar, setShowPrinterBar] = React.useState(true);

  React.useEffect(() => {
    // Check printer status on mount
    if (canUseNativePrinter()) {
      const checkStatus = async () => {
        try {
          const statusStr = await window.PosPrinter.getPrinterStatus();
          const status = JSON.parse(statusStr);
          setPrinterStatus(status);
        } catch (err) {
          console.error('Failed to check printer status:', err);
        }
      };
      checkStatus();
    }
  }, []);

  return (
    <div className="orders-container" style={{ 
      paddingBottom: window.innerWidth < 768 ? '20px' : '20px', // No extra space needed since bottom nav is hidden on orders page
      overflowX: 'hidden',
      maxWidth: '100%',
      paddingTop: '50px' // Perfect spacing from top bar
    }}>
      
      {/* POS Printer Status Bar */}
      {canUseNativePrinter() && showPrinterBar && (
        <div style={{
          background: printerStatus?.status === 'ready' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ff9800',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          position: 'relative',
        }}>
          {/* Status - Click to hide */}
          <div 
            onClick={() => setShowPrinterBar(false)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              cursor: 'pointer',
              flex: 1,
              paddingRight: '12px',
              borderRadius: '8px',
              padding: '8px',
              margin: '-8px',
              marginRight: '12px',
              transition: 'background 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            title="اضغط للإخفاء"
          >
            <span style={{ fontSize: '24px' }}>
              {printerStatus?.status === 'ready' ? '✅' : '⚠️'}
            </span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px' }}>
                {printerStatus?.status === 'ready' ? 'طابعة H10 متصلة' : 'فحص الطابعة...'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                اضغط للإخفاء • {printerStatus?.device || 'H10 Wireless Terminal'}
              </div>
            </div>
          </div>

          {/* Test Print Button */}
          <button
            onClick={testPrint}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid white',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.35)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
          >
            <IoMdPrint size={20} />
            اختبار الطباعة
          </button>
        </div>
      )}


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
              <OrderCard key={`new-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} receiptStyle={receiptStyle} />
            ))}
          </div>
        )
      ) : viewType === 'active' ? (
        activeOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات نشطة.</p>
        ) : (
          <div className="orders-grid">
            {activeOrders.map((order, index) => (
              <OrderCard key={`active-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} receiptStyle={receiptStyle} />
            ))}
          </div>
        )
      ) : viewType === 'future' ? (
        sortedFutureOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات مجدولة.</p>
        ) : (
          <div className="orders-grid">
            {sortedFutureOrders.map((order, index) => (
              <OrderCard key={`future-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} receiptStyle={receiptStyle} />
            ))}
          </div>
        )
      ) : (
        pastOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات سابقة.</p>
        ) : (
          <div className="orders-grid">
            {pastOrders.map((order, index) => (
              <OrderCard key={`past-${order.uid || order.id}-${index}`} order={order} orderTimers={orderTimers} startTimerForOrder={startTimerForOrder} activeBusinessId={activeBusinessId} receiptStyle={receiptStyle} />
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
            gap: '2px',
            padding: '6px 8px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative',
            minWidth: '65px',
            maxWidth: '80px'
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
            fontSize: '10px', 
            fontWeight: '500',
            color: viewType === 'new' ? '#007AFF' : '#666',
            textAlign: 'center',
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            maxWidth: '70px'
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
            gap: '2px',
            padding: '6px 8px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative',
            minWidth: '65px',
            maxWidth: '80px'
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
            fontSize: '10px', 
            fontWeight: '500',
            color: viewType === 'active' ? '#34C759' : '#666',
            textAlign: 'center',
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            maxWidth: '70px'
          }}>
            قيد التحضير
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
            gap: '2px',
            padding: '6px 8px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative',
            minWidth: '70px',
            maxWidth: '85px'
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
            fontSize: '10px', 
            fontWeight: '500',
            color: viewType === 'future' ? '#4A90E2' : '#666',
            textAlign: 'center',
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            maxWidth: '75px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
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
            gap: '2px',
            padding: '6px 8px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            minWidth: '65px',
            maxWidth: '80px'
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
            fontSize: '10px', 
            fontWeight: '500',
            color: viewType === 'past' ? '#8E8E93' : '#666',
            textAlign: 'center',
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            maxWidth: '70px'
          }}>
            طلبات سابقة
          </span>
        </button>
      </div>

      {/* Main Content Spacer for Bottom Tabs */}
      <div style={{ height: '80px' }} />
      
      {/* Floating Quick Meals Manager Button */}
      <button
        onClick={() => setShowQuickMealsManager(prev => !prev)}
        style={{
          position: 'fixed',
          bottom: window.innerWidth <= 768 ? '100px' : '90px',
          right: '20px',
          width: '56px',
          height: '56px',
          minWidth: '56px',
          minHeight: '56px',
          maxWidth: '56px',
          maxHeight: '56px',
          background: showQuickMealsManager ? '#dc3545' : '#007bff',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          transition: 'all 0.2s ease',
          borderRadius: '50%',
          boxSizing: 'border-box',
        }}
        title={showQuickMealsManager ? 'إغلاق إدارة المأكولات' : 'إدارة المأكولات السريعة'}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        {showQuickMealsManager ? '✕' : '🍽️'}
      </button>

      {/* Quick Meals Manager Modal */}
      <QuickMealsManager
        isOpen={showQuickMealsManager}
        onClose={() => setShowQuickMealsManager(false)}
      />
      
      <audio id="orderSound" preload="auto">
        <source src={brandConfig.notificationSound} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default OrdersPage;
