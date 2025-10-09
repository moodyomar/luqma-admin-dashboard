import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import brandConfig from '../constants/brandConfig';

const AnalyticsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // '1d', '7d', '30d', '90d'

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'menus', brandConfig.id, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(1000) // Limit for performance
      ),
      (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Calculate analytics based on time range
  const analytics = useMemo(() => {
    const now = new Date();
    const timeRanges = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    
    const days = timeRanges[timeRange];
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate;
    });

    // Sales Analytics
    const totalSales = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;
    const orderCount = filteredOrders.length;

    // Daily Sales Breakdown
    const dailySales = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('he-IL');
      if (!dailySales[date]) {
        dailySales[date] = { sales: 0, orders: 0 };
      }
      dailySales[date].sales += order.total || 0;
      dailySales[date].orders += 1;
    });

    // Popular Items
    const itemCounts = {};
    filteredOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const itemName = item.name || item.title || 'Unknown Item';
          itemCounts[itemName] = (itemCounts[itemName] || 0) + (item.quantity || 1);
        });
      }
    });

    const popularItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    // Peak Hours Analysis
    const hourlyStats = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = { orders: 0, sales: 0 };
    }

    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyStats[hour].orders += 1;
      hourlyStats[hour].sales += order.total || 0;
    });

    const peakHours = Object.entries(hourlyStats)
      .sort(([,a], [,b]) => b.orders - a.orders)
      .slice(0, 5);

    // Delivery Method Breakdown
    const deliveryStats = {};
    filteredOrders.forEach(order => {
      const method = order.deliveryMethod || 'unknown';
      deliveryStats[method] = (deliveryStats[method] || 0) + 1;
    });

    // Payment Method Breakdown
    const paymentStats = {};
    filteredOrders.forEach(order => {
      const method = order.paymentMethod || 'unknown';
      paymentStats[method] = (paymentStats[method] || 0) + 1;
    });

    return {
      totalSales,
      avgOrderValue,
      orderCount,
      dailySales: Object.entries(dailySales).slice(-7), // Last 7 days
      popularItems,
      peakHours,
      deliveryStats,
      paymentStats
    };
  }, [orders, timeRange]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        fontSize: '18px',
        color: '#666'
      }}>
        טוען נתונים...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        color: '#333',
        fontSize: '28px'
      }}>
        📊 لوحة التحكم - التحليلات
      </h1>

      {/* Time Range Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '30px'
      }}>
        {['1d', '7d', '30d', '90d'].map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: timeRange === range ? '2px solid #007bff' : '1px solid #ddd',
              background: timeRange === range ? '#007bff' : 'white',
              color: timeRange === range ? 'white' : '#333',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {range === '1d' ? 'اليوم' : 
             range === '7d' ? '7 أيام' :
             range === '30d' ? '30 يوم' : '90 يوم'}
          </button>
        ))}
      </div>

      {/* Key Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '25px',
          borderRadius: '15px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>إجمالي المبيعات</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {analytics.totalSales.toLocaleString()}₪
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          padding: '25px',
          borderRadius: '15px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>عدد الطلبات</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {analytics.orderCount.toLocaleString()}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          padding: '25px',
          borderRadius: '15px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>📈</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>متوسط قيمة الطلب</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {analytics.avgOrderValue.toFixed(0)}₪
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          padding: '25px',
          borderRadius: '15px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏰</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>أوقات الذروة</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {analytics.peakHours[0]?.[0]}:00
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '30px',
        marginBottom: '40px'
      }}>
        {/* Daily Sales Chart */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>📅 المبيعات اليومية</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '10px' }}>
            {analytics.dailySales.map(([date, data], index) => {
              const maxSales = Math.max(...analytics.dailySales.map(([,d]) => d.sales));
              const height = (data.sales / maxSales) * 180;
              return (
                <div key={date} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: `${height}px`,
                    background: 'linear-gradient(to top, #007bff, #0056b3)',
                    borderRadius: '4px 4px 0 0',
                    marginBottom: '10px',
                    minHeight: '4px'
                  }} />
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    {data.sales.toFixed(0)}₪
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Items */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>🍕 المنتجات الأكثر طلباً</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {analytics.popularItems.map(([item, count], index) => (
              <div key={item} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < analytics.popularItems.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <span style={{ fontSize: '14px', color: '#333' }}>{item}</span>
                <span style={{
                  background: '#007bff',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px'
      }}>
        {/* Delivery Methods */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>🚚 طرق التوصيل</h3>
          {Object.entries(analytics.deliveryStats).map(([method, count]) => {
            const total = Object.values(analytics.deliveryStats).reduce((a, b) => a + b, 0);
            const percentage = (count / total * 100).toFixed(1);
            const methodNames = {
              'delivery': 'توصيل',
              'pickup': 'استلام',
              'eat_in': 'اكل بالمطعم',
              'unknown': 'غير محدد'
            };
            return (
              <div key={method} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '14px' }}>{methodNames[method] || method}</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{count}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#eee',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: method === 'delivery' ? '#28a745' : 
                              method === 'pickup' ? '#ffc107' : 
                              method === 'eat_in' ? '#17a2b8' : '#6c757d',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Methods */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>💳 طرق الدفع</h3>
          {Object.entries(analytics.paymentStats).map(([method, count]) => {
            const total = Object.values(analytics.paymentStats).reduce((a, b) => a + b, 0);
            const percentage = (count / total * 100).toFixed(1);
            const methodNames = {
              'cash': 'نقدي',
              'card': 'بطاقة ائتمان',
              'online': 'دفع الكتروني',
              'unknown': 'غير محدد'
            };
            return (
              <div key={method} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '14px' }}>{methodNames[method] || method}</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{count}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#eee',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: method === 'cash' ? '#28a745' : 
                              method === 'card' ? '#007bff' : 
                              method === 'online' ? '#6f42c1' : '#6c757d',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
