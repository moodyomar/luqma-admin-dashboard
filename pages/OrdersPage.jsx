// pages/OrdersPage.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import brand from '../constants/brandConfig'
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

      <p>👤 <strong>${order.name || '—'}</strong></p>
      <p>📞 <strong>${order.phone || '—'}</strong></p>
      <p>🚚 التوصيل: <strong>${deliveryString || '—'}</strong></p>
      <p>📍 العنوان: <strong>${order.address || '—'}</strong></p>

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

      {order.extraNotes && (
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

    </div>
  );
});

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [prevOrdersCount, setPrevOrdersCount] = useState(0);
  const isFirstLoad = useRef(true); // 🟡 new flag


  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'menus', brand.id, 'orders'), (snapshot) => {
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
