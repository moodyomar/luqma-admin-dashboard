// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import brandConfig from '../constants/brandConfig';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import AudioUnlocker, { getSharedAudio } from '../src/components/AudioUnlocker';
import { Toaster, toast } from 'react-hot-toast';
import './styles.css';
import { IoMdCheckmark, IoMdCheckmarkCircleOutline, IoMdClose, IoMdRestaurant, IoMdBicycle } from 'react-icons/io';

const OrderCard = React.memo(({ order }) => {

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

  const handlePrint = (order) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>طباعة الطلب</title>
      <style>
        body { font-family: sans-serif; padding: 20px; direction: rtl; text-align: right; }
        h2 { margin: 0 0 10px; }
        p { margin: 4px 0; }
        ul { padding: 0; list-style: none; }
        li { margin-bottom: 10px; }
        .extras { font-size: 13px; color: #555; }
        .meal-title { font-weight: bold; margin-top: 16px; }
        .gray { color: #777; font-size: 14px; }
        .divider { border-top: 1px solid #ccc; margin: 12px 0; }
      </style>
    </head>
    <body>
      <h2>طلب رقم #${(order.uid || order.id)?.slice(0, 6)}</h2>
      <p class="gray">${order.date || ''}</p>

      <div class="divider"></div>

      <p>👤 <strong>${order.name || '—'}</strong></p>
      <p>📞 <strong>${order.phone ? `<a href="tel:${order.phone}" style="color: #007aff; text-decoration: none;">${order.phone}</a>` : '—'}</strong></p>
      <p>🚚 التوصيل: <strong>${deliveryString || '—'}</strong></p>
      ${order.deliveryMethod === 'delivery' ? 
        `<p>📍 العنوان: <strong>${order.address || '—'}</strong></p>` : 
        order.deliveryMethod === 'eat_in' && order.tableNumber ? 
        `<p>🪑 رقم الطاولة: <strong>${order.tableNumber}</strong></p>` : 
        ''
      }

      ${order.extraNotes
        ? `<p style="color: #666; font-size: 13px;">📝 ملاحظات الموقع: ${order.extraNotes}</p>`
        : ''
      }
${paymentString === 'اونلاين' ?
        `<p>💳 وضع الطلب: <strong>مدفوع</strong></p>`
        : `<p>💳 طريقة الدفع: <strong>${paymentString || '—'}</strong></p>`}
      <p>📦 عدد المنتجات: <strong>${order.cart?.length || 0}</strong></p>
      <p>💰 السعر: <strong>₪${order.total || order.price}</strong></p>

      <div class="divider"></div>

      <p class="meal-title">تفاصيل الوجبات:</p>
      <ul>
        ${order.cart.map(item => {
          const name = item.name?.ar || item.name || '';
          const qty = item.quantity || 1;
          const size = item.optionsText ? ` – ${item.optionsText}` : '';
          const extras = Array.isArray(item.selectedExtras)
            ? item.selectedExtras
              .map(extra =>
                typeof extra === 'object' ? extra.label?.ar || '' : ''
              )
              .filter(Boolean)
              .join('، ')
            : '';

          return `
            <li>
              ${name} × ${qty}${size}
              ${extras ? `<div class="extras">إضافات: ${extras}</div>` : ''}
            </li>
          `;
        }).join('')}
      </ul>

      ${order.note
        ? `<div class="divider"></div>
             <p class="meal-title">📌 ملاحظة الزبون:</p>
             <p>${order.note}</p>`
        : ''
      }
    </body>
  </html>
`);


    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Accept order and set prep time
  const handleAcceptOrder = () => {
    setShowPrepTime(true);
  };

  const handleSetTimeAndAccept = async () => {
    setLoading(true);
    try {
      const ref = doc(db, 'menus', brandConfig.id, 'orders', order.id);
      await updateDoc(ref, {
        status: 'preparing',
        prepTimeMinutes: selectedTime.value,
        prepTimeUnit: selectedTime.unit,
        acceptedAt: new Date().toISOString(),
      });
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
      'pending': { text: 'جديد', color: '#dc3545', icon: '🔴', bgColor: '#fee' },
      'preparing': { text: 'قيد التحضير', color: '#ffc107', icon: '🟡', bgColor: '#fffbf0' },
      'ready': { text: 'جاهز', color: '#28a745', icon: '🟢', bgColor: '#f0fff4' },
      'out_for_delivery': { text: 'قيد التوصيل', color: '#007bff', icon: '🔵', bgColor: '#f0f8ff' },
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
        border: `1px solid ${config.color}20`,
        marginBottom: '10px'
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

      {/* Status Badge */}
      {getStatusBadge()}

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
                {order.phone}
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

      <p>
        <span className="label">🚚 التوصيل:</span>
        <span className="value">{deliveryString || '—'}</span>
      </p>

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

      <p>
        <span className="label">💳 {paymentString === 'اونلاين' ? 'وضع الطلب:' : 'طريقة الدفع:'}</span>
        <span className="value">{paymentString === 'اونلاين' ? 'مدفوع' : paymentString || '—'}</span>
      </p>

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

      {order.cart?.length > 0 && (
        <div className="order-meals">
          <p className="meals-title">تفاصيل الوجبات:</p>
          <ul>
            {order.cart.map((item, index) => (
              <li key={item.uid || `${item.id}-${index}`} className="meal-item" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
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
  const [showActive, setShowActive] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'delivery', 'pickup', 'eat_in'

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
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
    const unsubscribe = onSnapshot(
      collection(db, 'menus', brandConfig.id, 'orders'), (snapshot) => {
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
  }, [prevOrdersCount]);

  const sortedOrders = useMemo(() => {
    let filtered = [...orders];
    
    // Apply delivery method filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => order.deliveryMethod === activeFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, activeFilter]);

  const activeOrders = sortedOrders.filter(order =>
    ['pending', 'preparing', 'ready', 'active', 'out_for_delivery'].includes(order.status)
  );
  const pastOrders = sortedOrders.filter(order =>
    ['delivered', 'completed'].includes(order.status)
  );

  return (
    <div className="orders-container" style={{ paddingBottom: 80 }}>
      <h1 className="orders-title">{showActive ? 'الطلبات الحاليه' : 'الطلبات السابقه'}</h1>
      
      {/* Dashboard Metrics */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        margin: '0 -20px 20px -20px',
        padding: '20px',
        borderRadius: '0 0 20px 20px',
        color: 'white',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>💰</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>المبيعات اليوم</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{dashboardMetrics.totalSalesToday.toLocaleString()}₪</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>📊</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>الطلبات النشطة</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{dashboardMetrics.activeOrdersCount}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>⏱️</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>متوسط التحضير</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{dashboardMetrics.avgPrepTime} دقيقة</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>📈</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>جديد آخر ساعة</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{dashboardMetrics.newOrdersLastHour}</div>
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => setActiveFilter('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'all' ? '2px solid #007bff' : '1px solid #ddd',
            background: activeFilter === 'all' ? '#007bff' : 'white',
            color: activeFilter === 'all' ? 'white' : '#333',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📊 جميع الطلبات ({orders.length})
        </button>
        <button
          onClick={() => setActiveFilter('delivery')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'delivery' ? '2px solid #28a745' : '1px solid #28a745',
            background: activeFilter === 'delivery' ? '#28a745' : 'white',
            color: activeFilter === 'delivery' ? 'white' : '#28a745',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🚚 توصيل ({orders.filter(order => order.deliveryMethod === 'delivery' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
        <button
          onClick={() => setActiveFilter('pickup')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'pickup' ? '2px solid #ffc107' : '1px solid #ffc107',
            background: activeFilter === 'pickup' ? '#ffc107' : 'white',
            color: activeFilter === 'pickup' ? 'white' : '#ffc107',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🏪 استلام ({orders.filter(order => order.deliveryMethod === 'pickup' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
        <button
          onClick={() => setActiveFilter('eat_in')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: activeFilter === 'eat_in' ? '2px solid #17a2b8' : '1px solid #17a2b8',
            background: activeFilter === 'eat_in' ? '#17a2b8' : 'white',
            color: activeFilter === 'eat_in' ? 'white' : '#17a2b8',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🍽️ اكل بالمطعم ({orders.filter(order => order.deliveryMethod === 'eat_in' && !['delivered', 'completed', 'cancelled'].includes(order.status)).length})
        </button>
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
        `}
      </style>
      {showActive ? (
        activeOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات حالياً.</p>
        ) : (
          <div className="orders-grid">
            {activeOrders.map((order) => (
              <OrderCard key={order.uid || order.id} order={order} />
            ))}
          </div>
        )
      ) : (
        pastOrders.length === 0 ? (
          <p className="orders-empty">لا يوجد طلبات سابقة.</p>
        ) : (
          <div className="orders-grid">
            {pastOrders.map((order) => (
              <OrderCard key={order.uid || order.id} order={order} />
            ))}
          </div>
        )
      )}
      <audio id="orderSound" preload="auto">
        <source src="/sounds/luqma.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      {/* Fixed bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, width: '100%', background: '#fff', borderTop: '1px solid #eee',
        display: 'flex', justifyContent: 'center', zIndex: 100, padding: '10px 0'
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setShowActive(true)}
            style={{
              fontWeight: 700, fontSize: 18, color: showActive ? '#007aff' : '#888', background: 'none', border: 'none', margin: '0 24px', cursor: 'pointer'
            }}
          >
            طلبات قيد التحضير
          </button>
          {activeOrders.length > 0 && (
            <span style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 22,
              height: 22,
              background: '#E63119',
              color: '#fff',
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              padding: '0 6px',
              boxShadow: '0 1px 4px #aaa'
            }}>
              {activeOrders.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowActive(false)}
          style={{
            fontWeight: 700, fontSize: 18, color: !showActive ? '#007aff' : '#888', background: 'none', border: 'none', margin: '0 24px', cursor: 'pointer'
          }}
        >طلبات سابقة</button>
      </div>
    </div>
  );
};

export default OrdersPage;
