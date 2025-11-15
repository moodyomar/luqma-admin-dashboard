import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { 
  FiShoppingBag, 
  FiUsers, 
  FiDollarSign, 
  FiTrendingUp,
  FiClock,
  FiCheckCircle,
  FiPackage
} from 'react-icons/fi';

// Helper function to check if an order is a future/scheduled order
const isFutureOrder = (order) => {
  if (!order.deliveryDateTime) return false;
  if (order.status !== 'pending') return false; // Only pending orders can be future orders
  
  try {
    // Handle Firestore Timestamp
    let scheduledTime;
    if (order.deliveryDateTime?.toDate && typeof order.deliveryDateTime.toDate === 'function') {
      scheduledTime = order.deliveryDateTime.toDate();
    } else if (order.deliveryDateTime instanceof Date) {
      scheduledTime = order.deliveryDateTime;
    } else {
      scheduledTime = new Date(order.deliveryDateTime);
    }
    
    if (isNaN(scheduledTime.getTime())) return false;
    
    const now = new Date();
    return scheduledTime > now;
  } catch (error) {
    console.warn('Error checking future order:', error);
    return false;
  }
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { activeBusinessId } = useAuth();
  const [stats, setStats] = useState({
    todayOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalProducts: 0,
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBusinessId) return;
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get today's date range - more precise
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log('📅 Dashboard Date Range:', {
          now: now.toISOString(),
          today: today.toISOString(),
          tomorrow: tomorrow.toISOString()
        });

        try {
          // Fetch today's orders - using correct Firestore path
          const todayOrdersQuery = query(
            collection(db, 'menus', activeBusinessId, 'orders'),
            where('createdAt', '>=', today),
            where('createdAt', '<', tomorrow)
          );

          // Fetch all orders for stats
          const allOrdersQuery = query(
            collection(db, 'menus', activeBusinessId, 'orders'),
            orderBy('createdAt', 'desc'),
            limit(100)
          );

          // Fetch recent orders
          const recentOrdersQuery = query(
            collection(db, 'menus', activeBusinessId, 'orders'),
            orderBy('createdAt', 'desc'),
            limit(5)
          );

          const [todayOrdersSnapshot, allOrdersSnapshot, recentOrdersSnapshot] = await Promise.all([
            getDocs(todayOrdersQuery),
            getDocs(allOrdersQuery),
            getDocs(recentOrdersQuery)
          ]);

          // Process today's orders
          const todayOrders = [];
          let todayRevenue = 0;
          
          console.log('📊 Today Orders Query Results:', {
            totalDocs: todayOrdersSnapshot.docs.length,
            docs: todayOrdersSnapshot.docs.map(doc => ({
              id: doc.id,
              createdAt: doc.data().createdAt,
              status: doc.data().status
            }))
          });
          
          todayOrdersSnapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            // Exclude future orders from today's metrics
            if (!isFutureOrder(order)) {
              todayOrders.push(order);
              todayRevenue += parseFloat(order.totalAmount || order.total || 0);
              console.log('📦 Processing Today Order:', {
                id: order.id,
                createdAt: order.createdAt,
                status: order.status,
                total: order.total || order.totalAmount
              });
            }
          });

          // Process all orders for stats
          let totalRevenue = 0;
          let pendingOrders = 0;
          let completedOrders = 0;

          allOrdersSnapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            // Exclude future orders from stats
            if (!isFutureOrder(order)) {
              totalRevenue += parseFloat(order.totalAmount || order.total || 0);
              
              if (order.status === 'pending' || order.status === 'confirmed') {
                pendingOrders++;
              } else if (order.status === 'completed' || order.status === 'delivered' || order.status === 'served') {
                completedOrders++;
              }
            }
          });

          // Process recent orders (exclude future orders)
          const recentOrders = [];
          recentOrdersSnapshot.forEach(doc => {
            const orderData = { id: doc.id, ...doc.data() };
            // Exclude future orders from recent orders list
            if (!isFutureOrder(orderData)) {
              recentOrders.push(orderData);
              console.log('🔍 Dashboard Order Data:', {
                id: orderData.id,
                customerName: orderData.customerName,
                customer: orderData.customer,
                name: orderData.name,
                customerPhone: orderData.customerPhone,
                phone: orderData.phone,
                totalAmount: orderData.totalAmount,
                total: orderData.total,
                status: orderData.status,
                createdAt: orderData.createdAt
              });
            }
          });

          // If no today's orders found via query, try filtering all orders by date
          let finalTodayOrders = todayOrders.length;
          if (finalTodayOrders === 0) {
            console.log('🔄 No orders found via date query, trying client-side filtering...');
            const clientSideTodayOrders = allOrdersSnapshot.docs.filter(doc => {
              const orderData = { id: doc.id, ...doc.data() };
              const orderDate = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date(orderData.createdAt);
              const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
              const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isToday = orderDateOnly.getTime() === todayOnly.getTime();
              
              // Exclude future orders
              if (isToday && !isFutureOrder(orderData)) {
                console.log('✅ Found today order via client-side filtering:', {
                  id: doc.id,
                  createdAt: orderData.createdAt,
                  orderDate: orderDate.toISOString(),
                  todayDate: today.toISOString()
                });
                return true;
              }
              
              return false;
            });
            
            finalTodayOrders = clientSideTodayOrders.length;
            console.log('📊 Client-side filtering results:', {
              found: finalTodayOrders,
              orders: clientSideTodayOrders.map(doc => doc.id)
            });
          }

          setStats({
            todayOrders: finalTodayOrders,
            totalRevenue: totalRevenue,
            pendingOrders,
            completedOrders,
            totalProducts: 0, // We'll get this from meals data if needed
            recentOrders
          });

        } catch (permissionError) {
          console.warn('Permission denied for orders data, using mock data:', permissionError);
          // Set empty data when permissions are denied - no dummy data
          setStats({
            todayOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            completedOrders: 0,
            totalProducts: 0,
            recentOrders: []
          });
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeBusinessId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'confirmed': return '#007AFF';
      case 'preparing': return '#FF6B6B';
      case 'ready': return '#34C759';
      case 'completed': return '#34C759';
      case 'delivered': return '#34C759';
      case 'served': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'بالانتظار';
      case 'confirmed': return 'مؤكد';
      case 'preparing': return 'بالتحضير';
      case 'ready': return 'جاهز';
      case 'completed': return 'مكتمل';
      case 'delivered': return 'تم التسليم';
      case 'served': return 'تم التقديم';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e5e7',
          borderTop: '3px solid #007AFF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: window.innerWidth < 768 ? '8px' : '16px',
      paddingBottom: window.innerWidth < 768 ? '100px' : '16px' // Extra space for mobile bottom bar
    }}>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Today's Orders */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e5e7',
          transition: 'all 0.2s ease'
        }}
>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: '#007AFF',
              borderRadius: '12px',
              padding: '12px',
              color: 'white'
            }}>
              <FiShoppingBag size={24} />
            </div>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1d1d1f'
            }}>
              {stats.todayOrders}
            </span>
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1d1d1f',
            marginBottom: '4px'
          }}>
            طلبات اليوم
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666'
          }}>
            إجمالي الطلبات اليوم
          </p>
        </div>

        {/* Pending Orders */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e5e7',
          transition: 'all 0.2s ease'
        }}
>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: '#FF9500',
              borderRadius: '12px',
              padding: '12px',
              color: 'white'
            }}>
              <FiClock size={24} />
            </div>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1d1d1f'
            }}>
              {stats.pendingOrders}
            </span>
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1d1d1f',
            marginBottom: '4px'
          }}>
            طلبات معلقة
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666'
          }}>
            تحتاج إلى متابعة
          </p>
        </div>

        {/* Total Revenue */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e5e7',
          transition: 'all 0.2s ease'
        }}
>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: '#34C759',
              borderRadius: '12px',
              padding: '12px',
              color: 'white'
            }}>
              <FiDollarSign size={24} />
            </div>
            <span style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1d1d1f'
            }}>
              {formatCurrency(stats.totalRevenue)}
            </span>
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1d1d1f',
            marginBottom: '4px'
          }}>
            إجمالي الإيرادات
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666'
          }}>
            جميع الطلبات
          </p>
        </div>

        {/* Completed Orders */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: window.innerWidth < 768 ? '16px' : '24px',
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e5e7',
          transition: 'all 0.2s ease'
        }}
>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: '#34C759',
              borderRadius: '12px',
              padding: '12px',
              color: 'white'
            }}>
              <FiCheckCircle size={24} />
            </div>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1d1d1f'
            }}>
              {stats.completedOrders}
            </span>
          </div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1d1d1f',
            marginBottom: '4px'
          }}>
            طلبات مكتملة
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666'
          }}>
            تم تسليمها بنجاح
          </p>
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e5e5e7',
        marginBottom: window.innerWidth < 768 ? '100px' : '0' // Extra space for mobile bottom bar
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#1d1d1f'
          }}>
            الطلبات الأخيرة
          </h2>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('View all orders clicked');
              navigate('/orders');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#007AFF',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              zIndex: 10 // Lower z-index so it stays below bottom nav
            }}
          >
            عرض الكل
          </button>
        </div>

        {stats.recentOrders.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#8E8E93'
          }}>
            <FiPackage size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '16px' }}>
              لا توجد طلبات حديثة
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Order clicked:', order.id);
                  navigate(`/orders?order=${order.id}`);
                }}
                style={{
                  padding: '16px',
                  border: '1px solid #e5e5e7',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#fff',
                  pointerEvents: 'auto',
                  zIndex: 10 // Lower z-index so it stays below bottom nav
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px' // Better spacing between elements
                }}>
                  {/* Status Badge */}
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '12px',
                    backgroundColor: getStatusColor(order.status),
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '600',
                    minWidth: '70px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    lineHeight: '1.1',
                    whiteSpace: 'nowrap',
                    flexShrink: 0 // Prevent shrinking
                  }}>
                    {getStatusText(order.status)}
                  </div>

                  {/* Order Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1d1d1f',
                      marginBottom: '4px'
                    }}>
                      #{order.id.slice(-6)}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {order.customerName || order.customer?.name || order.name || 'عميل'} • {order.customerPhone || order.customer?.phone || order.phone || 'لا يوجد رقم'}
                    </div>
                  </div>

                  {/* Price, Date & Time */}
                  <div style={{ 
                    textAlign: 'left',
                    minWidth: '80px', // Ensure enough space
                    flexShrink: 0 // Prevent shrinking
                  }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1d1d1f',
                      marginBottom: '2px'
                    }}>
                      {formatCurrency(order.totalAmount || order.total || 0)}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '1px'
                    }}>
                      {formatDate(order.createdAt)}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      {formatTime(order.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
