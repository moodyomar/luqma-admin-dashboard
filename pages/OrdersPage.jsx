// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { Toaster, toast } from 'react-hot-toast';
import './styles.css';

const OrderCard = React.memo(({ order }) => {

  return (
    <div className="order-card">
      <div className="order-header">
        <span className="order-date">{order.date}</span>
        <span className="order-id">#{order.uid || order.id}</span>
      </div>

      <div className="order-details">
        <p>👤 <strong>{order.name || '—'}</strong></p>
        <p>📞 <strong>{order.phone || '—'}</strong></p>
        <p>🚚 طريقة التوصيل: <strong>{order.deliveryMethod || '—'}</strong></p>
        <p>💳 طريقة الدفع: <strong>{order.paymentMethod || '—'}</strong></p>
        <p>📦 عدد المنتجات: <strong>{order.cart?.length || 0}</strong></p>
        <p>💰 السعر: <strong className="order-price">₪{order.total || order.price}</strong></p>
      </div>

      {order.cart?.length > 0 && (
        <div className="order-meals">
          <p className="meals-title">تفاصيل الوجبات:</p>
          <ul>
            {order.cart.map((item, index) => (
              <li key={item.uid || `${item.id}-${index}`} className="meal-item">
                {item.image && (
                  <img
                    src={item.image}
                    alt="meal"
                    className="meal-image"
                    loading="lazy"
                  />
                )}
                <span>
                  {item.name?.ar || item.name} × {item.quantity}
                  {item.optionsText && ` - ${item.optionsText}`}
                </span>
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
