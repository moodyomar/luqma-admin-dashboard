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
    <html>
      <head>
        <title>طباعة الطلب</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          h2 { margin-top: 0 }
        </style>
      </head>
      <body>
        <h2>طلب رقم #${order.uid?.slice(0, 6)}</h2>
        <p><strong>الإسم:</strong> ${order.name}</p>
        <p><strong>الهاتف:</strong> ${order.phone}</p>
        <p><strong>المجموع:</strong> ₪${order.total}</p>
        <p><strong>الطلب:</strong></p>
        <ul>
          ${order.cart.map(item => `<li>${item.name.ar} × ${item.quantity}</li>`).join('')}
        </ul>
        <p><strong>التوصيل:</strong> ${deliveryString}</p>
        <p><strong>الطريقة:</strong> ${paymentString}</p>
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
        <p>👤 <strong>{order.name || '—'}</strong></p>
        <p>📞 <strong>{order.phone || '—'}</strong></p>
        <p>🚚 التوصيل: <strong>{deliveryString || '—'}</strong></p>
        <p>💳 طريقة الدفع: <strong>{paymentString || '—'}</strong></p>
        <p>📦 عدد المنتجات: <strong>{order.cart?.length || 0}</strong></p>
        <p>💰 السعر: <strong className="order-price">₪{order.total || order.price}</strong></p>
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
