// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import AudioUnlocker, { getSharedAudio } from '../src/components/AudioUnlocker';
import { Toaster, toast } from 'react-hot-toast';
import './styles.css';

const OrderCard = React.memo(({ order }) => {

  const deliveryString = order.deliveryMethod === 'delivery' ? 'توصيل للبيت' : 'استلام بالمحل'
  const paymentString = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين'

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

      <p><span>👤 الإسم:</span> ${order.name}</p>
      <p><span>📞 الهاتف:</span> ${order.phone}</p>
      <p><span>🚚 التوصيل:</span> ${deliveryString}</p>
      <p><span>💳 طريقة الدفع:</span> ${paymentString}</p>
      <p><span>📦 عدد المنتجات:</span> ${order.cart?.length || 0}</p>
      <p><span>💰 السعر:</span> ₪${order.total}</p>

      <div class="divider"></div>

      <p class="meal-title">تفاصيل الوجبات:</p>
      <ul>
        ${order.cart.map(item => {
      const name = item.name?.ar || item.name || '';
      const qty = item.quantity || 1;
      const size = item.optionsText ? ` – ${item.optionsText}` : '';
      const extras = Array.isArray(item.selectedExtras)
        ? item.selectedExtras
          .map(extra => typeof extra === 'object' ? extra.label?.ar || '' : '')
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
    </body>
  </html>
`);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };


  return (
    <div className="order-card">
      <div className="order-header">
        <div className="dateCol">
          <span className="order-date">{order.date}</span>
          <span className="order-id">#{(order.uid || order.id)?.slice(0, 6)}</span>
        </div>
        <div className="print-row">
          <button className="printingBtn" onClick={() => handlePrint(order)}>🖨️</button>
        </div>
      </div>

      <div className="order-details">
        <span>👤 <p>{order.name || '—'}</p></span>
        <span>📞 <p>{order.phone || '—'}</p></span>
        <span>🚚 التوصيل: <p>{deliveryString || '—'}</p></span>
        <span>📍 العنوان: <p>{order.address || '—'}</p></span>
        {order.extraNotes && (
          <p style={{ marginTop: -10, color: '#999', fontSize: 13 }}>
            📝 ملاحظات الموقع: {order.extraNotes}
          </p>
        )}

        <p>💳 طريقة الدفع: <span>{paymentString || '—'}</span></p>
        <p>📦 عدد المنتجات: <span>{order.cart?.length || 0}</span></p>
        <p>💰 السعر: <span className="order-price">₪{order.total || order.price}</span></p>
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

    </div>
  );
});

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [prevOrdersCount, setPrevOrdersCount] = useState(0);
  const isFirstLoad = useRef(true); // 🟡 new flag


  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const unlockedAudio = getSharedAudio();
      if (unlockedAudio) {
        unlockedAudio.currentTime = 0;
        unlockedAudio.play();
      }
      const updatedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setOrders(updatedOrders);

      if (isFirstLoad.current) {
        isFirstLoad.current = false; // ✅ prevent first-time trigger
      } else if (updatedOrders.length > prevOrdersCount) {
        new Audio('/notify.mp3').play();
        toast.success('📦 طلب جديد وصل!');
      }

      setPrevOrdersCount(updatedOrders.length);
    });

    return () => unsubscribe();
  }, [prevOrdersCount]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders]);

  return (
    <div className="orders-container">
      <h1 className="orders-title">الطلبات</h1>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      {/* <button onClick={() => {
        const sound = document.getElementById('orderSound');
        if (sound) {
          sound.play().then(() => {
            console.log('🔊 Sound enabled');
          }).catch(err => {
            console.warn('🔇 Cannot play yet:', err);
          });
        }
      }}>
        🔔 Enable Sound Alerts
      </button> */}
      <AudioUnlocker />
      {sortedOrders.length === 0 ? (
        <p className="orders-empty">لا يوجد طلبات حالياً.</p>
      ) : (
        <div className="orders-grid">
          {sortedOrders.map((order) => (
            <OrderCard key={order.uid || order.id} order={order} />
          ))}
        </div>
      )}
      <audio id="orderSound" preload="auto">
        <source src="/sounds/notify.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default OrdersPage;
