import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import brandConfig from '../constants/brandConfig';
import { useAuth } from '../src/contexts/AuthContext';

const AnalyticsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // '1d', '7d', '30d', '90d'
  const navigate = useNavigate();
  const { activeBusinessId } = useAuth();

  useEffect(() => {
    if (!activeBusinessId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'menus', activeBusinessId, 'orders'),
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
  }, [activeBusinessId]);

  // Calculate real-time status overview
  const realTimeStatus = useMemo(() => {
    const now = new Date();
    const urgentThreshold = 5 * 60; // 5 minutes in seconds
    
    const statusCounts = {
      pending: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0
    };
    
    const urgentOrders = [];
    const newOrders = [];
    
    orders.forEach(order => {
      const status = order.status || 'pending';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
      
      // Check for urgent orders (preparing with low time)
      if (status === 'preparing') {
        const prepTime = order.prepTimeMinutes || 15;
        const acceptedAt = order.acceptedAt ? new Date(order.acceptedAt) : now;
        const elapsedMinutes = (now - acceptedAt) / (1000 * 60);
        const remainingMinutes = prepTime - elapsedMinutes;
        
        if (remainingMinutes <= 5 && remainingMinutes > 0) {
          urgentOrders.push({
            id: order.id,
            customerName: order.customerName || 'عميل',
            remainingTime: Math.max(0, remainingMinutes)
          });
        }
      }
      
      // Check for new orders (last 10 minutes)
      const orderTime = new Date(order.createdAt);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      if (orderTime > tenMinutesAgo && status === 'pending') {
        newOrders.push({
          id: order.id,
          customerName: order.customerName || 'عميل',
          timeAgo: Math.round((now - orderTime) / (1000 * 60))
        });
      }
    });
    
    return {
      statusCounts,
      urgentOrders,
      newOrders,
      totalActive: statusCounts.pending + statusCounts.preparing + statusCounts.ready + statusCounts.out_for_delivery
    };
  }, [orders]);

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
    
    // More precise date filtering
    let filteredOrders = [];
    if (timeRange === '1d') {
      // For "today" - only include orders from today
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today && orderDate < tomorrow;
      });
    } else {
      // For other ranges - use relative days
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate;
      });
    }

    // Sales Analytics
    const totalSales = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;
    const orderCount = filteredOrders.length;

    // Daily Sales Breakdown
    const dailySales = {};
    filteredOrders.forEach(order => {
      // Create a proper date object and format it correctly
      const orderDate = new Date(order.createdAt);
      // Use local date to avoid timezone issues
      const dateKey = orderDate.getFullYear() + '-' + 
                     String(orderDate.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(orderDate.getDate()).padStart(2, '0');
      
      if (!dailySales[dateKey]) {
        dailySales[dateKey] = { 
          sales: 0, 
          orders: 0,
          displayDate: orderDate.toLocaleDateString('he-IL', { 
            day: '2-digit', 
            month: 'short'
          })
        };
      }
      dailySales[dateKey].sales += order.total || 0;
      dailySales[dateKey].orders += 1;
    });

    // Popular Items
    const itemCounts = {};
    filteredOrders.forEach(order => {
      // Handle different item structures
      let items = order.cart || order.items || order.orderItems || order.products || order.meals || [];
      
      // If items is not an array, try to convert it
      if (!Array.isArray(items)) {
        if (typeof items === 'object' && items !== null) {
          // Convert object to array
          items = Object.values(items);
        } else {
          items = [];
        }
      }
      
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            // Try to get item name from various possible structures
            let itemName = item.name || item.title || item.productName || item.mealName || item.product?.name;
            
            // If itemName is an object (likely multilingual), extract Arabic or English name
            if (typeof itemName === 'object' && itemName !== null) {
              // Try Arabic first (since this is an Arabic app), then English, then any available language
              itemName = itemName.ar || itemName.he || itemName.en || itemName.name || itemName.title || 
                        Object.values(itemName)[0] || 'منتج غير محدد';
            }
            
            // If still no name, try common nested patterns
            if (!itemName || typeof itemName === 'object') {
              itemName = item.product?.name || item.meal?.name || item.item?.name || 'منتج غير محدد';
            }
            
            // Final fallback - if still an object, get first string value
            if (typeof itemName === 'object' && itemName !== null) {
              const stringValues = Object.values(itemName).filter(val => typeof val === 'string');
              itemName = stringValues[0] || 'منتج غير محدد';
            }
            
            // Ensure we have a string
            if (!itemName || typeof itemName !== 'string') {
              itemName = 'منتج غير محدد';
            }
            
            const quantity = parseInt(item.quantity || item.qty || item.count || 1);
            
            if (itemName && itemName !== 'منتج غير محدد' && quantity > 0) {
              itemCounts[itemName] = (itemCounts[itemName] || 0) + quantity;
            }
            
            // Debug individual item processing
            console.log('🔍 Processing item:', {
              item,
              extractedName: itemName,
              quantity,
              finalItemName: itemName
            });
          }
        });
      }
    });

    const popularItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
      
    // Debug logging
    console.log('🔍 Analytics Debug:', {
      totalOrders: filteredOrders.length,
      ordersWithItems: filteredOrders.filter(o => (o.cart || o.items || o.orderItems || o.products)?.length > 0).length,
      itemCounts,
      popularItems,
      sampleOrder: filteredOrders[0] ? {
        id: filteredOrders[0].id,
        hasItems: !!(filteredOrders[0].cart || filteredOrders[0].items || filteredOrders[0].orderItems || filteredOrders[0].products),
        itemsField: filteredOrders[0].cart ? 'cart' :
                   filteredOrders[0].items ? 'items' : 
                   filteredOrders[0].orderItems ? 'orderItems' : 
                   filteredOrders[0].products ? 'products' : 'none',
        itemsData: filteredOrders[0].cart || filteredOrders[0].items || filteredOrders[0].orderItems || filteredOrders[0].products,
        allFields: Object.keys(filteredOrders[0]),
        fullOrderStructure: filteredOrders[0]
      } : 'No orders'
    });

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

    // Sort daily sales by date and limit based on time range
    const sortedDailySales = Object.entries(dailySales)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-days); // Show only the selected number of days

    return {
      totalSales,
      avgOrderValue,
      orderCount,
      dailySales: sortedDailySales,
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
    <div style={{ 
      padding: window.innerWidth < 768 ? '8px' : '16px', 
      paddingBottom: window.innerWidth < 768 ? '100px' : '16px',
      maxWidth: '1200px', 
      margin: '0 auto' 
    }}>

      {/* Real-Time Status Overview */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '30px',
        color: 'white'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '20px',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          ⚡ الحالة المباشرة
        </h2>
        
        {/* Status Cards Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '15px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>🆕</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>طلبات جديدة</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {realTimeStatus.statusCounts.pending}
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '15px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>👨‍🍳</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>قيد التحضير</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {realTimeStatus.statusCounts.preparing}
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '15px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>✅</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>جاهز</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {realTimeStatus.statusCounts.ready}
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '15px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>🚚</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>في الطريق</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {realTimeStatus.statusCounts.out_for_delivery}
            </div>
          </div>
        </div>

        {/* Urgent Alerts */}
        {realTimeStatus.urgentOrders.length > 0 && (
          <div style={{
            background: 'rgba(220, 53, 69, 0.3)',
            border: '1px solid rgba(220, 53, 69, 0.5)',
            borderRadius: '10px',
            padding: '15px',
            marginBottom: '15px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              <span style={{ fontSize: '20px', marginLeft: '8px' }}>🚨</span>
              <span>طلبات عاجلة ({realTimeStatus.urgentOrders.length})</span>
            </div>
            {realTimeStatus.urgentOrders.map(order => (
              <div key={order.id} style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '8px 12px',
                borderRadius: '6px',
                marginBottom: '5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px' }}>{order.customerName}</span>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: '#ffcdd2'
                }}>
                  {Math.round(order.remainingTime)} دقيقة متبقية
                </span>
              </div>
            ))}
          </div>
        )}

        {/* New Orders Alert */}
        {realTimeStatus.newOrders.length > 0 && (
          <div style={{
            background: 'rgba(40, 167, 69, 0.3)',
            border: '1px solid rgba(40, 167, 69, 0.5)',
            borderRadius: '10px',
            padding: '15px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              <span style={{ fontSize: '20px', marginLeft: '8px' }}>🆕</span>
              <span>طلبات جديدة ({realTimeStatus.newOrders.length})</span>
            </div>
            {realTimeStatus.newOrders.map(order => (
              <div key={order.id} style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '8px 12px',
                borderRadius: '6px',
                marginBottom: '5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px' }}>{order.customerName}</span>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: '#c8e6c9'
                }}>
                  منذ {order.timeAgo} دقيقة
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Quick Action Button */}
        {(realTimeStatus.urgentOrders.length > 0 || realTimeStatus.newOrders.length > 0) && (
          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <button
              onClick={() => navigate('/orders')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.5)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '25px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.3)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.2)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span>⚡</span>
              <span>إدارة الطلبات العاجلة</span>
            </button>
          </div>
        )}
      </div>

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
          <div style={{ 
            height: '200px', 
            display: 'flex', 
            alignItems: 'end', 
            gap: '10px',
            paddingTop: '10px',
            marginTop: '10px'
          }}>
            {analytics.dailySales.map(([date, data], index) => {
              const maxSales = Math.max(...analytics.dailySales.map(([,d]) => d.sales));
              const height = (data.sales / maxSales) * 160; // Reduced from 180 to account for padding
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
                    {data.displayDate}
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
            {analytics.popularItems && analytics.popularItems.length > 0 ? (
              analytics.popularItems.map(([item, count], index) => (
                <div key={item} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: index < analytics.popularItems.length - 1 ? '1px solid #eee' : 'none'
                }}>
                  <span style={{ 
                    fontSize: '14px', 
                    color: '#333',
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'right'
                  }}>
                    {item}
                  </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #007bff, #0056b3)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    minWidth: '30px',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,123,255,0.3)'
                  }}>
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666',
                fontSize: '14px'
              }}>
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '16px',
                  opacity: 0.5 
                }}>
                  🍕
                </div>
                <p style={{ margin: 0, marginBottom: '8px' }}>
                  لا توجد بيانات متاحة
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px',
                  color: '#999'
                }}>
                  سيتم عرض المنتجات الأكثر طلباً عند توفر الطلبات
                </p>
              </div>
            )}
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
