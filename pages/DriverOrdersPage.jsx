import React, { useEffect, useState, useMemo, useRef } from 'react';
import brandConfig from '../constants/brandConfig';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { IoMdCheckmark, IoMdClose, IoMdBicycle } from 'react-icons/io';
import './styles.css';

const DriverOrderCard = React.memo(({ order }) => {
  const [loading, setLoading] = useState(false);

  const deliveryString = order.deliveryMethod === 'delivery' ? 'توصيل للبيت' : 'استلام بالمحل';
  const paymentString = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين';

  // Format date in English/Israel format
  let formattedDate = '';
  if (order.date) {
    const dateObj = new Date(order.date);
    if (!isNaN(dateObj)) {
      formattedDate = dateObj.toLocaleDateString('en-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } else {
      formattedDate = order.date;
    }
  }

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

  // Mark order as delivered
  const handleDelivered = async () => {
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
  };

  return (
    <div className="order-card">
      <div className="order-header">
        <div className="dateCol">
          <span className="order-date">{formattedDate}</span>
          <span className="order-id">#{(order.uid || order.id)?.slice(0, 6)}</span>
        </div>
        <div className="status-badge" style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#fff',
          background: 
            order.status === 'ready' ? '#28a745' :
            order.status === 'out_for_delivery' ? '#ffc107' :
            '#007bff'
        }}>
          {order.status === 'ready' ? 'جاهز' :
           order.status === 'out_for_delivery' ? 'قيد التوصيل' :
           'قيد التحضير'}
        </div>
      </div>

      <div className="row">
        <div>
          <span className="label">👤</span>
          <span className="value">{order.name || '—'}</span>
        </div>
        <div>
          <span className="label">📞</span>
          <span className="value">{order.phone || '—'}</span>
        </div>
      </div>

      <p>
        <span className="label">🚚 التوصيل:</span>
        <span className="value">{deliveryString || '—'}</span>
      </p>

      <p>
        <span className="label">📍 العنوان:</span>
        <span className="value">{order.address || '—'}</span>
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

      {/* Driver-specific action buttons */}
      {order.status === 'ready' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleOutForDelivery} 
            disabled={loading} 
            style={{ 
              fontWeight: 700, 
              padding: '10px 28px', 
              borderRadius: 8, 
              background: '#FF9500', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: 18, 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <IoMdBicycle style={{ marginLeft: 8 }} />
            بدء التوصيل
          </button>
        </div>
      )}

      {order.status === 'out_for_delivery' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleDelivered} 
            disabled={loading} 
            style={{ 
              fontWeight: 700, 
              padding: '10px 28px', 
              borderRadius: 8, 
              background: '#34C759', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: 18, 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <IoMdCheckmark style={{ marginLeft: 8 }} />
            تم التوصيل
          </button>
        </div>
      )}
    </div>
  );
});

const DriverOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showActive, setShowActive] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'menus', brandConfig.id, 'orders'), 
      (snapshot) => {
        const updatedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(updatedOrders);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders]);

  // Driver sees: only delivery orders
  const activeOrders = sortedOrders.filter(order =>
    order.deliveryMethod === 'delivery' &&
    ['preparing', 'ready', 'out_for_delivery'].includes(order.status)
  );
  
  const completedOrders = sortedOrders.filter(order =>
    order.deliveryMethod === 'delivery' &&
    ['delivered', 'completed'].includes(order.status)
  );

  return (
    <div className="orders-container" style={{ paddingBottom: 80 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '0 20px'
      }}>
        <h1 className="orders-title" style={{ margin: 0 }}>
          {showActive ? 'الطلبات النشطة' : 'الطلبات المكتملة'}
        </h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          تسجيل خروج
        </button>
      </div>

      {showActive ? (
        activeOrders.length === 0 ? (
          <p className="orders-empty">لا توجد طلبات نشطة حالياً.</p>
        ) : (
          <div className="orders-grid">
            {activeOrders.map((order) => (
              <DriverOrderCard key={order.uid || order.id} order={order} />
            ))}
          </div>
        )
      ) : (
        completedOrders.length === 0 ? (
          <p className="orders-empty">لا توجد طلبات مكتملة.</p>
        ) : (
          <div className="orders-grid">
            {completedOrders.map((order) => (
              <DriverOrderCard key={order.uid || order.id} order={order} />
            ))}
          </div>
        )
      )}

      {/* Fixed bottom nav */}
      <div style={{
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        width: '100%', 
        background: '#fff', 
        borderTop: '1px solid #eee',
        display: 'flex', 
        justifyContent: 'center', 
        zIndex: 100, 
        padding: '10px 0'
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setShowActive(true)}
            style={{
              fontWeight: 700, 
              fontSize: 18, 
              color: showActive ? '#007aff' : '#888', 
              background: 'none', 
              border: 'none', 
              margin: '0 24px', 
              cursor: 'pointer'
            }}
          >
            الطلبات النشطة
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
            fontWeight: 700, 
            fontSize: 18, 
            color: !showActive ? '#007aff' : '#888', 
            background: 'none', 
            border: 'none', 
            margin: '0 24px', 
            cursor: 'pointer'
          }}
        >
          الطلبات المكتملة
        </button>
      </div>
    </div>
  );
};

export default DriverOrdersPage; 