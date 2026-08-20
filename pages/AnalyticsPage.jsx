import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { db, firebaseApp } from '../firebase/firebaseConfig';
import brandConfig from '../constants/brandConfig';
import { useAuth } from '../src/contexts/AuthContext';
import { Toaster, toast } from 'react-hot-toast';

/**
 * Revenue for the business = cart subtotal only. Excludes delivery fee (belongs to driver).
 * Uses order.cart when available; falls back to order.total for legacy orders.
 */
function getOrderRevenue(order) {
  if (order.cart && Array.isArray(order.cart)) {
    const cartSubtotal = order.cart.reduce((sum, item) => {
      const itemPrice = parseFloat(item.totalPrice || item.price || 0);
      const quantity = parseInt(item.quantity || 1);
      return sum + (itemPrice * quantity);
    }, 0);
    return cartSubtotal;
  }
  return parseFloat(order.total || order.price || 0);
}

/** Normalize Firestore Timestamp, ISO string, or Auth-style date string → Date, or null */
function getUserRegistrationDate(user) {
  if (!user || typeof user !== 'object') return null;
  const raw = user.createdAt ?? user.authCreatedAt ?? user.registeredAt;
  if (raw == null || raw === '') return null;
  if (typeof raw.toDate === 'function') {
    const d = raw.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000 + (raw.nanoseconds || 0) / 1e6);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const TIME_RANGE_OPTIONS = [
  { id: '1d', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: '7d', label: '7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: '30d', label: '30 يوم' },
  { id: 'custom', label: 'مخصص' },
];

/** Resolve current + previous comparison windows for analytics filters */
function resolveAnalyticsPeriod(timeRange, customDateStart, customDateEnd, now = new Date()) {
  let startDate = new Date(now);
  let rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);

  if (timeRange === 'custom' && customDateStart && customDateEnd) {
    startDate = new Date(customDateStart);
    startDate.setHours(0, 0, 0, 0);
    rangeEnd = new Date(customDateEnd);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeRange === '1d') {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === 'yesterday') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    rangeEnd = new Date(startDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeRange === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  let previousStartDate;
  let previousRangeEnd;

  if (timeRange === '1d' || timeRange === 'yesterday') {
    // Previous calendar day before the selected day
    previousRangeEnd = new Date(startDate);
    previousRangeEnd.setDate(previousRangeEnd.getDate() - 1);
    previousRangeEnd.setHours(23, 59, 59, 999);
    previousStartDate = new Date(previousRangeEnd);
    previousStartDate.setHours(0, 0, 0, 0);
  } else if (timeRange === 'month') {
    // Full previous calendar month
    previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousStartDate.setHours(0, 0, 0, 0);
    previousRangeEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    previousRangeEnd.setHours(23, 59, 59, 999);
  } else {
    const periodLengthMs = Math.max(0, rangeEnd.getTime() - startDate.getTime());
    previousRangeEnd = new Date(startDate.getTime() - 1);
    previousStartDate = new Date(previousRangeEnd.getTime() - periodLengthMs);
  }

  const periodDays = Math.max(
    1,
    Math.ceil((rangeEnd.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  );

  return { startDate, rangeEnd, previousStartDate, previousRangeEnd, periodDays };
}

function filterOrdersInRange(ordersList, rangeStart, rangeEnd) {
  return ordersList.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= rangeStart && orderDate <= rangeEnd;
  });
}

const AnalyticsPage = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // 1d | yesterday | 7d | month | 30d | custom
  const [customDateStart, setCustomDateStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [customDateEnd, setCustomDateEnd] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString().slice(0, 10);
  });
  const [showUserAnalytics, setShowUserAnalytics] = useState(false); // Collapsed by default
  const [showLiveStatus, setShowLiveStatus] = useState(false); // Collapsed by default
  const [showNewUsersTable, setShowNewUsersTable] = useState(false);
  /** Trend chart range independent of main analytics filters */
  const [trendRange, setTrendRange] = useState('3m'); // 3m | 6m | 1y
  const [trendHoverIndex, setTrendHoverIndex] = useState(null);
  /** From Cloud Function: Auth metadata.creationTime, scoped to users/{uid} docs (same as total users). */
  const [authNewUserCounts, setAuthNewUserCounts] = useState(null);
  const navigate = useNavigate();
  const { activeBusinessId } = useAuth();

  useEffect(() => {
    if (!activeBusinessId) return;
    setAuthNewUserCounts(null);
    let cancelled = false;
    const region = import.meta.env.VITE_FIREBASE_REGION || 'us-central1';
    const run = async () => {
      try {
        const functions = getFunctions(firebaseApp, region);
        const getCounts = httpsCallable(functions, 'getAuthNewUserCounts');

        // Map yesterday/month to explicit custom dates so older deployed functions
        // don't treat unknown ranges as 30 days (which inflated "أمس" to ~30d totals).
        const toYmd = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        let payload = {
          businessId: activeBusinessId,
          timeRange,
          ...(timeRange === 'custom'
            ? { customDateStart, customDateEnd }
            : {}),
        };
        if (timeRange === 'yesterday' || timeRange === 'month') {
          const { startDate, rangeEnd } = resolveAnalyticsPeriod(
            timeRange,
            customDateStart,
            customDateEnd
          );
          payload = {
            businessId: activeBusinessId,
            timeRange: 'custom',
            customDateStart: toYmd(startDate),
            customDateEnd: toYmd(rangeEnd),
          };
        }

        const result = await getCounts(payload);
        const data = result.data;
        if (
          !cancelled &&
          data &&
          typeof data.newUsers === 'number' &&
          typeof data.previousNewUsers === 'number'
        ) {
          setAuthNewUserCounts({
            newUsers: data.newUsers,
            previousNewUsers: data.previousNewUsers,
          });
        }
      } catch (e) {
        console.warn('[Analytics] getAuthNewUserCounts failed (deploy functions or check login):', e);
        if (!cancelled) setAuthNewUserCounts(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId, timeRange, customDateStart, customDateEnd]);

  useEffect(() => {
    if (!activeBusinessId) return;
    
    const unsubscribeOrders = onSnapshot(
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
      }
    );

    // Fetch users collection (one-time, not real-time for better performance)
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    };

    fetchUsers();

    return () => unsubscribeOrders();
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
    const { startDate, rangeEnd, previousStartDate, previousRangeEnd, periodDays } =
      resolveAnalyticsPeriod(timeRange, customDateStart, customDateEnd, now);

    const filteredOrders = filterOrdersInRange(orders, startDate, rangeEnd);
    const previousFilteredOrders = filterOrdersInRange(orders, previousStartDate, previousRangeEnd);

    // Current period calculations (revenue = cart only, excludes delivery fee)
    const totalSales = filteredOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0);
    const avgOrderValue = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;
    const orderCount = filteredOrders.length;
    
    const completedOrders = filteredOrders.filter(order => 
      order.status === 'delivered' || order.status === 'served' || order.status === 'completed'
    ).length;

    const cancelledOrders = filteredOrders.filter(order => 
      order.status === 'cancelled' || order.status === 'canceled'
    ).length;
    const cancellationRate = orderCount > 0 ? (cancelledOrders / orderCount * 100) : 0;

    const ordersWithPrepTime = filteredOrders.filter(order => 
      (order.status === 'delivered' || order.status === 'served' || order.status === 'completed') &&
      order.acceptedAt && order.readyAt
    );
    const avgPrepTime = ordersWithPrepTime.length > 0
      ? ordersWithPrepTime.reduce((sum, order) => {
          const prepMinutes = (new Date(order.readyAt) - new Date(order.acceptedAt)) / (1000 * 60);
          return sum + prepMinutes;
        }, 0) / ordersWithPrepTime.length
      : 0;

    const hoursInPeriod = periodDays * 24;
    const revenuePerHour = totalSales / hoursInPeriod;

    // Previous period calculations (revenue = cart only, excludes delivery fee)
    const previousTotalSales = previousFilteredOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0);
    const previousAvgOrderValue = previousFilteredOrders.length > 0 
      ? previousTotalSales / previousFilteredOrders.length 
      : 0;
    const previousOrderCount = previousFilteredOrders.length;
    
    const previousCompletedOrders = previousFilteredOrders.filter(order => 
      order.status === 'delivered' || order.status === 'served' || order.status === 'completed'
    ).length;

    const previousCancelledOrders = previousFilteredOrders.filter(order => 
      order.status === 'cancelled' || order.status === 'canceled'
    ).length;
    const previousCancellationRate = previousOrderCount > 0 
      ? (previousCancelledOrders / previousOrderCount * 100) 
      : 0;

    const previousOrdersWithPrepTime = previousFilteredOrders.filter(order => 
      (order.status === 'delivered' || order.status === 'served' || order.status === 'completed') &&
      order.acceptedAt && order.readyAt
    );
    const previousAvgPrepTime = previousOrdersWithPrepTime.length > 0
      ? previousOrdersWithPrepTime.reduce((sum, order) => {
          const prepMinutes = (new Date(order.readyAt) - new Date(order.acceptedAt)) / (1000 * 60);
          return sum + prepMinutes;
        }, 0) / previousOrdersWithPrepTime.length
      : 0;

    const previousRevenuePerHour = previousTotalSales / (periodDays * 24);

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const salesChange = calculatePercentageChange(totalSales, previousTotalSales);
    const orderCountChange = calculatePercentageChange(orderCount, previousOrderCount);
    const completedOrdersChange = calculatePercentageChange(completedOrders, previousCompletedOrders);
    const avgOrderValueChange = calculatePercentageChange(avgOrderValue, previousAvgOrderValue);
    const revenuePerHourChange = calculatePercentageChange(revenuePerHour, previousRevenuePerHour);
    const cancellationRateChange = calculatePercentageChange(cancellationRate, previousCancellationRate);
    const avgPrepTimeChange = previousAvgPrepTime > 0 
      ? calculatePercentageChange(avgPrepTime, previousAvgPrepTime)
      : 0;

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
      dailySales[dateKey].sales += getOrderRevenue(order);
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
      hourlyStats[hour].sales += getOrderRevenue(order);
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
    const paymentAmounts = {};
    filteredOrders.forEach(order => {
      const method = order.paymentMethod || 'unknown';
      paymentStats[method] = (paymentStats[method] || 0) + 1;
      paymentAmounts[method] = (paymentAmounts[method] || 0) + getOrderRevenue(order);
    });

    // Sort daily sales by date and limit based on time range
    const sortedDailySales = Object.entries(dailySales)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-periodDays); // Show only the selected number of days

    const formatPeriodDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}.${month}`;
    };
    const formatPeriodRange = (from, to) => {
      const fromDay = new Date(from);
      fromDay.setHours(0, 0, 0, 0);
      const toDay = new Date(to);
      toDay.setHours(0, 0, 0, 0);
      if (fromDay.getTime() === toDay.getTime()) return formatPeriodDate(fromDay);
      return `${formatPeriodDate(fromDay)}–${formatPeriodDate(toDay)}`;
    };

    const currentLabelStart = startDate;
    const currentLabelEnd = rangeEnd;

    return {
      totalSales,
      avgOrderValue,
      orderCount,
      completedOrders,
      cancelledOrders,
      cancellationRate,
      avgPrepTime,
      revenuePerHour,
      dailySales: sortedDailySales,
      popularItems,
      peakHours,
      deliveryStats,
      paymentStats,
      paymentAmounts,
      // Percentage changes
      salesChange,
      orderCountChange,
      completedOrdersChange,
      avgOrderValueChange,
      revenuePerHourChange,
      cancellationRateChange,
      avgPrepTimeChange,
      // Comparison windows shown under % badges
      currentPeriodLabel: formatPeriodRange(currentLabelStart, currentLabelEnd),
      previousPeriodLabel: formatPeriodRange(previousStartDate, previousRangeEnd),
    };
  }, [orders, timeRange, customDateStart, customDateEnd]);

  // Calculate user analytics
  const userAnalytics = useMemo(() => {
    const now = new Date();
    const { startDate, rangeEnd, previousStartDate, previousRangeEnd } =
      resolveAnalyticsPeriod(timeRange, customDateStart, customDateEnd, now);

    // Helper function to check if date is within time range
    const isInTimeRange = (date, rangeStart, rangeEndBound = now) => {
      if (!date) return false;
      try {
        const activityDate = new Date(date);
        if (isNaN(activityDate.getTime())) return false; // Invalid date
        return activityDate >= rangeStart && activityDate <= rangeEndBound;
      } catch (error) {
        console.warn('Error parsing date in isInTimeRange:', date, error);
        return false;
      }
    };

    // Current period calculations
    const filteredOrders = orders.filter(order => {
      return isInTimeRange(order.createdAt, startDate, rangeEnd);
    });

    const usersWithOrders = new Set(
      filteredOrders
        .map(order => order.phone)
        .filter(phone => phone)
    );

    const activeUsers = users.filter(user => {
      const hasOrder = usersWithOrders.has(user.phone);
      const profileUpdated = isInTimeRange(user.updatedAt, startDate, rangeEnd);
      const pointsUpdated = isInTimeRange(user.lastPointsUpdate, startDate, rangeEnd);
      return hasOrder || profileUpdated || pointsUpdated;
    });

    const newUsers = users.filter(user => {
      const reg = getUserRegistrationDate(user);
      return reg != null && isInTimeRange(reg, startDate, rangeEnd);
    });

    const formatPhoneShort = (phone) => {
      if (!phone) return '—';
      const s = String(phone).trim();
      if (s.startsWith('+972')) return `0${s.slice(4)}`;
      return s;
    };
    const formatRegDate = (d) => {
      if (!d) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    };

    const newUsersList = newUsers
      .map((user) => {
        const registeredAt = getUserRegistrationDate(user);
        const name =
          user.name ||
          user.displayName ||
          user.fullName ||
          user.userName ||
          'بدون اسم';
        return {
          id: user.id,
          name: String(name).trim() || 'بدون اسم',
          phone: formatPhoneShort(user.phone),
          phoneRaw: user.phone || '',
          registeredAt,
          registeredAtLabel: formatRegDate(registeredAt),
        };
      })
      .sort((a, b) => {
        const ta = a.registeredAt ? a.registeredAt.getTime() : 0;
        const tb = b.registeredAt ? b.registeredAt.getTime() : 0;
        return tb - ta;
      })
      .slice(0, 20);

    // Previous period calculations (for comparison)
    const previousFilteredOrders = orders.filter(order => {
      return isInTimeRange(order.createdAt, previousStartDate, previousRangeEnd);
    });

    const previousUsersWithOrders = new Set(
      previousFilteredOrders
        .map(order => order.phone)
        .filter(phone => phone)
    );

    const previousActiveUsers = users.filter(user => {
      const hasOrder = previousUsersWithOrders.has(user.phone);
      const profileUpdated = isInTimeRange(user.updatedAt, previousStartDate, previousRangeEnd);
      const pointsUpdated = isInTimeRange(user.lastPointsUpdate, previousStartDate, previousRangeEnd);
      return hasOrder || profileUpdated || pointsUpdated;
    });

    const previousNewUsers = users.filter(user => {
      const reg = getUserRegistrationDate(user);
      return reg != null && isInTimeRange(reg, previousStartDate, previousRangeEnd);
    });

    // Calculate total users at the end of previous period (users created before current period start)
    const previousTotalUsers = users.filter(user => {
      const userCreatedAt = getUserRegistrationDate(user);
      if (!userCreatedAt) return false;
      return userCreatedAt < startDate;
    }).length;

    // Get all unique users from orders (historical - current)
    const allOrderUserPhones = new Set(
      orders
        .map(order => order.phone)
        .filter(phone => phone)
    );

    // Get all unique users from orders before current period (previous)
    const previousAllOrderUserPhones = new Set(
      orders
        .filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate < startDate;
        })
        .map(order => order.phone)
        .filter(phone => phone)
    );

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const totalUsersChange = calculatePercentageChange(users.length, previousTotalUsers);
    const activeUsersChange = calculatePercentageChange(activeUsers.length, previousActiveUsers.length);
    const newUsersForCard =
      authNewUserCounts != null ? authNewUserCounts.newUsers : newUsers.length;
    const previousNewUsersForCard =
      authNewUserCounts != null
        ? authNewUserCounts.previousNewUsers
        : previousNewUsers.length;
    const newUsersChange = calculatePercentageChange(
      newUsersForCard,
      previousNewUsersForCard
    );
    const totalActiveUsersChange = calculatePercentageChange(allOrderUserPhones.size, previousAllOrderUserPhones.size);

    // Calculate average orders per user (for active users in current period)
    const totalOrdersInPeriod = filteredOrders.length;
    const averageOrdersPerUser = activeUsers.length > 0 
      ? (totalOrdersInPeriod / activeUsers.length).toFixed(1)
      : 0;

    // Top 3 clients by number of orders in the selected period
    const phoneToUser = new Map();
    users.forEach((u) => {
      if (u?.phone) phoneToUser.set(String(u.phone).trim(), u);
    });

    const clientStats = new Map();
    filteredOrders.forEach((order) => {
      if (order.status === 'cancelled' || order.status === 'canceled') return;
      const phone = order.phone ? String(order.phone).trim() : '';
      if (!phone) return;
      const existing = clientStats.get(phone) || {
        phone,
        name: '',
        orderCount: 0,
        totalSpent: 0,
      };
      existing.orderCount += 1;
      existing.totalSpent += getOrderRevenue(order);
      const fromOrder =
        order.customerName ||
        order.name ||
        order.userName ||
        '';
      const fromUser = phoneToUser.get(phone)?.name || phoneToUser.get(phone)?.displayName || '';
      if (fromOrder && (!existing.name || existing.name === 'عميل')) {
        existing.name = fromOrder;
      } else if (!existing.name && fromUser) {
        existing.name = fromUser;
      }
      clientStats.set(phone, existing);
    });

    const topClients = Array.from(clientStats.values())
      .sort((a, b) => {
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return b.totalSpent - a.totalSpent;
      })
      .slice(0, 3)
      .map((c, index) => ({
        ...c,
        rank: index + 1,
        name: c.name || 'عميل',
      }));

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      newUsers: newUsersForCard,
      totalActiveUsers: allOrderUserPhones.size,
      newUsersList,
      newUsersTotalInPeriod: newUsers.length,
      // Percentage changes
      totalUsersChange,
      activeUsersChange,
      newUsersChange,
      totalActiveUsersChange,
      // Average orders per user
      averageOrdersPerUser: parseFloat(averageOrdersPerUser),
      totalOrdersInPeriod,
      // Top 3 clients by order count in the selected period
      topClients,
      previousPeriodLabel: (() => {
        const fmt = (d) => {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          return `${day}.${month}`;
        };
        const from = new Date(previousStartDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(previousRangeEnd);
        to.setHours(0, 0, 0, 0);
        if (from.getTime() === to.getTime()) return fmt(from);
        return `${fmt(from)}–${fmt(to)}`;
      })(),
    };
  }, [users, orders, timeRange, customDateStart, customDateEnd, authNewUserCounts]);

  // Monthly sales + orders + new users trend (own range: 3m / 6m / 1y)
  const salesOrdersTrend = useMemo(() => {
    const ARABIC_MONTHS = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ];
    const monthsCount = trendRange === '1y' ? 12 : trendRange === '6m' ? 6 : 3;
    const now = new Date();
    const buckets = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({
        key,
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        label: `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        shortLabel: ARABIC_MONTHS[d.getMonth()],
        start: d,
        end,
        sales: 0,
        orders: 0,
        newUsers: 0,
      });
    }
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    orders.forEach((order) => {
      if (!order?.createdAt) return;
      const status = order.status || '';
      if (status === 'cancelled' || status === 'canceled') return;
      const created = new Date(order.createdAt);
      if (Number.isNaN(created.getTime())) return;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byKey[key];
      if (!bucket) return;
      if (created < bucket.start || created > bucket.end) return;
      bucket.sales += getOrderRevenue(order);
      bucket.orders += 1;
    });
    users.forEach((user) => {
      const reg = getUserRegistrationDate(user);
      if (!reg) return;
      const key = `${reg.getFullYear()}-${String(reg.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byKey[key];
      if (!bucket) return;
      if (reg < bucket.start || reg > bucket.end) return;
      bucket.newUsers += 1;
    });
    const maxSales = Math.max(1, ...buckets.map((b) => b.sales));
    const maxOrders = Math.max(...buckets.map((b) => b.orders), 0);
    const maxNewUsers = Math.max(...buckets.map((b) => b.newUsers), 0);
    // Shared right-axis scale for order/user counts
    const maxCount = Math.max(1, maxOrders, maxNewUsers);
    return { buckets, maxSales, maxOrders, maxNewUsers, maxCount, monthsCount };
  }, [orders, users, trendRange]);

  const getCustomRangeReportText = (startDate, endDate) => {
    const formatDateShort = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${day}.${month}.${year}`;
    };
    const formatDateEnglish = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const dateRangeStr = `${formatDateShort(startDate)}-${formatDateShort(endDate)}`;
    const lines = [];
    const maxWidth = 32;
    const centerText = (text, width = maxWidth) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text;
    };
    const formatNumber = (num) => num.toLocaleString('en-US');

    lines.push('================================');
    lines.push(centerText('ملخص الفترة المحددة'));
    lines.push(centerText(dateRangeStr));
    lines.push('================================');
    lines.push('');
    lines.push(`من: ${formatDateEnglish(startDate)}`);
    lines.push(`إلى: ${formatDateEnglish(endDate)}`);
    lines.push('- - - - - - - - - - - - - - - -');
    lines.push('');
    lines.push('--- الإحصائيات الرئيسية ---');
    lines.push('');
    lines.push('إجمالي المبيعات:');
    lines.push(`${formatNumber(analytics.totalSales)}₪`);
    lines.push('');
    lines.push(`عدد الطلبات: ${analytics.orderCount}`);
    lines.push(`متوسط قيمة الطلب: ${analytics.avgOrderValue.toFixed(2)}₪`);
    lines.push('');
    lines.push('- - - - - - - - - - - - - - - -');
    lines.push('');
    lines.push('--- طرق التوصيل ---');
    lines.push('');
    const deliveryMethodNames = {
      delivery: 'توصيل',
      pickup: 'استلام',
      eat_in: 'اكل بالمطعم',
      unknown: 'غير محدد',
    };
    const deliveryTotal = Object.values(analytics.deliveryStats).reduce((a, b) => a + b, 0);
    Object.entries(analytics.deliveryStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([method, count]) => {
        const percentage = deliveryTotal > 0 ? ((count / deliveryTotal) * 100).toFixed(1) : 0;
        const methodName = deliveryMethodNames[method] || method;
        lines.push(`${methodName}:`);
        lines.push(`  ${count} طلب (${percentage}%)`);
      });
    lines.push('');
    lines.push('- - - - - - - - - - - - - - - -');
    lines.push('');
    lines.push('--- طرق الدفع ---');
    lines.push('');
    const paymentMethodNames = {
      cash: 'كاش',
      visa: 'فيزا',
      apple_pay: 'Apple Pay',
      unknown: 'غير محدد',
    };
    const paymentTotal = Object.values(analytics.paymentStats).reduce((a, b) => a + b, 0);
    const filteredOrdersForCalc = orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    const paymentAmounts = {};
    filteredOrdersForCalc.forEach((order) => {
      const method = order.paymentMethod || 'unknown';
      paymentAmounts[method] = (paymentAmounts[method] || 0) + getOrderRevenue(order);
    });
    Object.entries(analytics.paymentStats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([method, count]) => {
        const percentage = paymentTotal > 0 ? ((count / paymentTotal) * 100).toFixed(1) : 0;
        const amount = paymentAmounts[method] || 0;
        const methodName = paymentMethodNames[method] || method;
        lines.push(`${methodName}:`);
        lines.push(`  ${formatNumber(amount)}₪ - ${percentage}%`);
      });
    lines.push('');
    lines.push('================================');
    lines.push('');

    return { reportText: lines.join('\n'), dateRangeStr };
  };

  const getValidatedCustomRange = () => {
    const startDate = new Date(customDateStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(customDateEnd);
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) {
      toast.error('تاريخ البداية يجب أن يكون قبل أو مساويًا لتاريخ النهاية', {
        duration: 3000,
        position: 'top-center',
      });
      return null;
    }
    return { startDate, endDate };
  };

  const printCustomRangeSummary = async () => {
    const range = getValidatedCustomRange();
    if (!range) return;
    const canUseNativePrinter =
      typeof window !== 'undefined' &&
      window.PosPrinter &&
      typeof window.PosPrinter.printText === 'function';
    if (!canUseNativePrinter) {
      toast.error('⚠️ الطابعة غير متاحة. يرجى التأكد من الاتصال بالطابعة.', {
        duration: 3000,
        position: 'top-center',
      });
      return;
    }
    try {
      const { reportText } = getCustomRangeReportText(range.startDate, range.endDate);
      const result = await window.PosPrinter.printText(reportText);
      if (result && typeof result === 'string' && result.includes('success')) {
        toast.success('✅ تمت طباعة ملخص الفترة المحددة بنجاح', {
          duration: 2000,
          position: 'top-center',
          style: {
            fontSize: '18px',
            fontWeight: '700',
            padding: '16px 24px',
          },
        });
        return;
      }
      if (result && typeof result === 'string' && result.includes('error')) {
        toast.error(`❌ خطأ في الطباعة: ${result}`, {
          duration: 3000,
          position: 'top-center',
        });
        return;
      }
      toast.error('❌ خطأ غير متوقع في الطباعة', {
        duration: 3000,
        position: 'top-center',
      });
    } catch (err) {
      toast.error(`❌ فشل الاتصال بالطابعة: ${err?.message || 'خطأ غير معروف'}`, {
        duration: 3000,
        position: 'top-center',
      });
    }
  };

  const emailCustomRangeSummary = () => {
    const range = getValidatedCustomRange();
    if (!range) return;
    const { reportText, dateRangeStr } = getCustomRangeReportText(range.startDate, range.endDate);
    const subject = `ملخص الفترة المحددة ${dateRangeStr}`;
    const body = reportText;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') {
      window.location.href = mailtoUrl;
    }
  };

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
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <div 
        className="analytics-page-container"
        style={{ 
        padding: window.innerWidth < 768 ? '8px' : '16px', 
        paddingBottom: window.innerWidth < 768 ? '100px' : '16px',
        maxWidth: '1200px', 
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        position: 'relative'
      }}
    >

      {/* Real-Time Status Overview - Collapsible */}
      <div style={{ 
        marginBottom: '30px',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowLiveStatus(!showLiveStatus)}
          style={{
            padding: '20px 25px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: showLiveStatus ? '1px solid #eee' : 'none',
            background: showLiveStatus ? '#f8f9fa' : 'transparent',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#f8f9fa';
          }}
          onMouseOut={(e) => {
            if (!showLiveStatus) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <h2 style={{ 
            margin: 0,
            color: '#333', 
            fontSize: '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚡</span>
            <span>الحالة المباشرة</span>
          </h2>
          <span style={{ 
            fontSize: '20px', 
            color: '#666',
            transition: 'transform 0.2s ease',
            transform: showLiveStatus ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </div>

        {showLiveStatus && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            color: 'white'
          }}>
            {/* Status Cards Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 768 
            ? 'repeat(2, 1fr)' 
            : 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: window.innerWidth < 768 ? '10px' : '15px',
          marginBottom: '20px',
          width: '100%',
          boxSizing: 'border-box'
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
        )}
      </div>

      {/* Time Range Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: window.innerWidth < 768 ? '6px' : '10px',
        marginBottom: '30px',
        flexWrap: 'wrap',
        padding: window.innerWidth < 768 ? '0 4px' : '0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {TIME_RANGE_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTimeRange(id)}
            style={{
              padding: window.innerWidth < 768 ? '5px 8px' : '7px 12px',
              borderRadius: '16px',
              border: timeRange === id ? '2px solid #007bff' : '1px solid #ddd',
              background: timeRange === id ? '#007bff' : 'white',
              color: timeRange === id ? 'white' : '#333',
              fontSize: window.innerWidth < 768 ? '11px' : '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              flex: window.innerWidth < 768 ? '1 1 calc(33.33% - 4px)' : '0 0 auto',
              minWidth: window.innerWidth < 768 ? '0' : 'auto',
              maxWidth: window.innerWidth < 768 ? 'calc(33.33% - 4px)' : 'none',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
        {/* Custom date range inputs */}
        {timeRange === 'custom' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            width: '100%',
            justifyContent: 'center',
            marginTop: '10px',
            padding: '10px',
            background: '#f8f9fa',
            borderRadius: '12px',
            border: '1px solid #eee'
          }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>من</label>
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => setCustomDateStart(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>إلى</label>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => setCustomDateEnd(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
            {customDateStart && customDateEnd && (
              <div
                style={{
                  flex: '1 1 100%',
                  marginTop: '8px',
                  display: 'flex',
                  gap: '8px',
                  width: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={printCustomRangeSummary}
                  style={{
                    flex: 1,
                    padding: window.innerWidth < 768 ? '10px 12px' : '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #28a745',
                    background: '#28a745',
                    color: 'white',
                    fontSize: window.innerWidth < 768 ? '13px' : '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span aria-hidden>🖨️</span>
                  <span>طباعة ملخص</span>
                </button>
                <button
                  type="button"
                  onClick={emailCustomRangeSummary}
                  style={{
                    flex: 1,
                    padding: window.innerWidth < 768 ? '10px 12px' : '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #0d6efd',
                    background: '#0d6efd',
                    color: 'white',
                    fontSize: window.innerWidth < 768 ? '13px' : '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span aria-hidden>✉️</span>
                  <span>ارسال ميل</span>
                </button>
              </div>
            )}
          </div>
        )}
        {/* Daily PDF Export Button — today or yesterday */}
        {(timeRange === '1d' || timeRange === 'yesterday') && (
          <button
            onClick={async () => {
              const { startDate: reportDay } = resolveAnalyticsPeriod(
                timeRange,
                customDateStart,
                customDateEnd
              );
              const formatDateShort = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear()).slice(-2);
                return `${day}.${month}.${year}`;
              };
              const reportDateStr = formatDateShort(reportDay);
              const reportTitle = timeRange === 'yesterday' ? 'تقرير أمس' : 'تقرير يومي';

              // Helper function to check if native printer is available
              const canUseNativePrinter = () =>
                typeof window !== 'undefined' &&
                window.PosPrinter &&
                typeof window.PosPrinter.printText === 'function';
              
              // Create text version for silent printing (optimized for thermal printer)
              const currentAnalytics = analytics;
              const currentOrders = orders;
              
              const buildReportText = () => {
                const lines = [];
                const maxWidth = 32;
                const centerText = (text, width = maxWidth) => {
                  const padding = Math.max(0, Math.floor((width - text.length) / 2));
                  return ' '.repeat(padding) + text;
                };
                const formatNumber = (num) => num.toLocaleString('en-US');

                const bucketPayment = (method) => {
                  const m = String(method || 'unknown').toLowerCase();
                  if (m === 'cash') return 'cash';
                  if (m === 'visa' || m === 'apple_pay' || m === 'apple_google' || m === 'card') return 'visa';
                  return null;
                };

                const dayStart = new Date(reportDay);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);
                const filteredOrdersForCalc = currentOrders.filter((order) => {
                  const orderDate = new Date(order.createdAt);
                  return orderDate >= dayStart && orderDate <= dayEnd;
                });

                let cashTotal = 0;
                let visaTotal = 0;
                filteredOrdersForCalc.forEach((order) => {
                  const bucket = bucketPayment(order.paymentMethod);
                  const amount = getOrderRevenue(order);
                  if (bucket === 'cash') cashTotal += amount;
                  else if (bucket === 'visa') visaTotal += amount;
                });

                lines.push('================================');
                lines.push(centerText(reportTitle));
                lines.push(centerText(reportDateStr));
                lines.push('================================');
                lines.push('');
                lines.push(`التاريخ: ${reportDateStr}`);
                lines.push('');
                lines.push(`المبيعات: ${formatNumber(currentAnalytics.totalSales)}₪`);
                lines.push(`الطلبات: ${currentAnalytics.orderCount}`);
                lines.push('');
                lines.push(`كاش: ${formatNumber(cashTotal)}₪`);
                lines.push(`فيزا: ${formatNumber(visaTotal)}₪`);
                lines.push('');
                lines.push('================================');
                lines.push('');

                return lines.join('\n');
              };

              // Same simple receipt for POS print and browser preview
              const reportText = buildReportText();
              console.log('📄 Daily POS receipt:\n', reportText);

              // Silent print on POS thermal printer
              if (canUseNativePrinter()) {
                try {
                  console.log('✅ Printing daily report to POS (PosPrinter.printText)');
                  const result = await window.PosPrinter.printText(reportText, '');
                  console.log('🖨️ Print result:', result, 'Type:', typeof result);
                  
                  if (result && typeof result === 'string' && result.includes('success')) {
                    console.log('✅ Daily report printed successfully');
                    toast.success('✅ تمت طباعة التقرير اليومي بنجاح', {
                      duration: 2000,
                      position: 'top-center',
                      style: {
                        fontSize: '18px',
                        fontWeight: '700',
                        padding: '16px 24px',
                      },
                    });
                    return;
                  } else if (result && typeof result === 'string' && result.includes('error')) {
                    console.error('Native print error:', result);
                    toast.error('❌ خطأ في الطباعة: ' + result, {
                      duration: 3000,
                      position: 'top-center',
                    });
                    return;
                  } else {
                    // Result might be null, undefined, or unexpected format
                    console.warn('⚠️ Unexpected print result format:', result);
                    toast.error('❌ خطأ غير متوقع في الطباعة', {
                      duration: 3000,
                      position: 'top-center',
                    });
                    return;
                  }
                } catch (err) {
                  console.error('❌ Native POS print failed:', err);
                  console.error('Error details:', {
                    message: err?.message,
                    stack: err?.stack,
                    name: err?.name
                  });
                  toast.error('❌ فشل الاتصال بالطابعة: ' + (err?.message || 'خطأ غير معروف'), {
                    duration: 3000,
                    position: 'top-center',
                  });
                  return;
                }
              } else {
                // No POS printer — open a text preview of the same receipt
                console.warn('⚠️ Native printer not available — showing daily report preview');
                const preview = window.open('', '_blank');
                if (preview) {
                  preview.document.write(
                    `<pre style="font-family:monospace;white-space:pre;direction:rtl;padding:16px;font-size:16px">${reportText}</pre>`
                  );
                  preview.document.close();
                }
                toast('معاينة التقرير اليومي (الطابعة غير متاحة)', {
                  duration: 2500,
                  position: 'top-center',
                });
              }
            }}
            style={{
              padding: window.innerWidth < 768 ? '6px 12px' : '8px 16px',
              borderRadius: '20px',
              border: '1px solid #28a745',
              background: '#28a745',
              color: 'white',
              fontSize: window.innerWidth < 768 ? '12px' : '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxSizing: 'border-box'
            }}
          >
            <span>📄</span>
            <span>تصدير PDF يومي</span>
          </button>
        )}
        {/* Weekly PDF Export Button */}
        {timeRange === '7d' && (
          <button
            onClick={async () => {
              // Calculate week date range
              const now = new Date();
              const endDate = new Date(now);
              endDate.setHours(23, 59, 59, 999);
              const startDate = new Date(now);
              startDate.setDate(startDate.getDate() - 6);
              startDate.setHours(0, 0, 0, 0);
              
              // Format dates as DD.MM.YY
              const formatDateShort = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear()).slice(-2);
                return `${day}.${month}.${year}`;
              };
              
              // Format dates as DD/MM/YYYY (English format)
              const formatDateEnglish = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
              };
              
              const startDateStr = formatDateShort(startDate);
              const endDateStr = formatDateShort(endDate);
              const dateRangeStr = `${startDateStr}-${endDateStr}`;
              
              // Helper function to check if native printer is available
              const canUseNativePrinter = () =>
                typeof window !== 'undefined' &&
                window.PosPrinter &&
                typeof window.PosPrinter.printText === 'function';
              
              // Create PDF content (HTML version)
              const pdfContent = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                  <meta charset="UTF-8">
                  <title>تقرير أسبوعي - ${dateRangeStr}</title>
                  <style>
                    @page { size: A4; margin: 20mm; }
                    body { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; text-align: right; }
                    h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
                    h2 { color: #333; margin-top: 30px; margin-bottom: 15px; }
                    .header { margin-bottom: 30px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-right: 4px solid #007bff; }
                    .stat-label { font-size: 14px; color: #666; margin-bottom: 5px; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
                    th { background: #007bff; color: white; font-weight: bold; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>تقرير أسبوعي - ${dateRangeStr}</h1>
                    <p>الفترة: من ${formatDateEnglish(startDate)} إلى ${formatDateEnglish(endDate)}</p>
                  </div>
                  
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-label">إجمالي المبيعات</div>
                      <div class="stat-value">${analytics.totalSales.toLocaleString('en-US')}₪</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-label">عدد الطلبات</div>
                      <div class="stat-value">${analytics.orderCount}</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-label">متوسط قيمة الطلب</div>
                      <div class="stat-value">${analytics.avgOrderValue.toFixed(2)}₪</div>
                    </div>
                  </div>
                  
                  <h2>تفاصيل الطلبات</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>طريقة التوصيل</th>
                        <th>عدد الطلبات</th>
                        <th>النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(analytics.deliveryStats).map(([method, count]) => {
                        const total = Object.values(analytics.deliveryStats).reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                        const methodNames = {
                          'delivery': 'توصيل',
                          'pickup': 'استلام',
                          'eat_in': 'اكل بالمطعم',
                          'unknown': 'غير محدد'
                        };
                        return `<tr>
                          <td>${methodNames[method] || method}</td>
                          <td>${count}</td>
                          <td>${percentage}%</td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                  
                  <h2>طرق الدفع</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>طريقة الدفع</th>
                        <th>عدد الطلبات</th>
                        <th>المبلغ والنسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(() => {
                        // Calculate payment amounts from filtered orders (weekly) — revenue only, no delivery fee
                        const filteredOrdersForCalc = orders.filter(order => {
                          const orderDate = new Date(order.createdAt);
                          return orderDate >= startDate && orderDate <= endDate;
                        });
                        
                        const paymentAmounts = {};
                        filteredOrdersForCalc.forEach(order => {
                          const method = order.paymentMethod || 'unknown';
                          paymentAmounts[method] = (paymentAmounts[method] || 0) + getOrderRevenue(order);
                        });
                        
                        const total = Object.values(analytics.paymentStats).reduce((a, b) => a + b, 0);
                        const methodNames = {
                          'cash': 'كاش',
                          'visa': 'فيزا',
                          'apple_pay': 'Apple Pay',
                          'unknown': 'غير محدد'
                        };
                        
                        return Object.entries(analytics.paymentStats).map(([method, count]) => {
                          const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                          const amount = paymentAmounts[method] || 0;
                          return `<tr>
                            <td>${methodNames[method] || method}</td>
                            <td>${count}</td>
                            <td>${amount.toLocaleString('en-US')}₪ - ${percentage}%</td>
                          </tr>`;
                        }).join('');
                      })()}
                    </tbody>
                  </table>
                </body>
                </html>
              `;
              
              // Create text version for silent printing (optimized for thermal printer)
              // Capture variables from outer scope to avoid closure issues
              const currentAnalytics = analytics;
              const currentOrders = orders;
              const currentStartDate = startDate;
              const currentEndDate = endDate;
              const currentDateRangeStr = dateRangeStr;
              
              const buildReportText = () => {
                const lines = [];
                const maxWidth = 32; // Thermal printer width (conservative for Arabic)
                
                // Helper to center text
                const centerText = (text, width = maxWidth) => {
                  const padding = Math.max(0, Math.floor((width - text.length) / 2));
                  return ' '.repeat(padding) + text;
                };
                
                // Helper to format numbers with proper spacing
                const formatNumber = (num) => num.toLocaleString('en-US');
                
                // Header
                lines.push('================================');
                lines.push(centerText('تقرير أسبوعي'));
                lines.push(centerText(currentDateRangeStr));
                lines.push('================================');
                lines.push('');
                
                // Date range info (English format DD/MM/YYYY)
                const formatDateEnglish = (date) => {
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const year = date.getFullYear();
                  return `${day}/${month}/${year}`;
                };
                const startDateEn = formatDateEnglish(currentStartDate);
                const endDateEn = formatDateEnglish(currentEndDate);
                lines.push(`من: ${startDateEn}`);
                lines.push(`إلى: ${endDateEn}`);
                lines.push('- - - - - - - - - - - - - - - -');
                lines.push('');
                
                // Main Statistics
                lines.push('--- الإحصائيات الرئيسية ---');
                lines.push('');
                lines.push(`إجمالي المبيعات:`);
                lines.push(`${formatNumber(currentAnalytics.totalSales)}₪`);
                lines.push('');
                lines.push(`عدد الطلبات: ${currentAnalytics.orderCount}`);
                lines.push(`متوسط قيمة الطلب: ${currentAnalytics.avgOrderValue.toFixed(2)}₪`);
                lines.push('');
                lines.push('- - - - - - - - - - - - - - - -');
                lines.push('');
                
                // Delivery Methods
                lines.push('--- طرق التوصيل ---');
                lines.push('');
                const deliveryMethodNames = {
                  'delivery': 'توصيل',
                  'pickup': 'استلام',
                  'eat_in': 'اكل بالمطعم',
                  'unknown': 'غير محدد'
                };
                const deliveryTotal = Object.values(currentAnalytics.deliveryStats).reduce((a, b) => a + b, 0);
                Object.entries(currentAnalytics.deliveryStats)
                  .sort(([,a], [,b]) => b - a) // Sort by count descending
                  .forEach(([method, count]) => {
                    const percentage = deliveryTotal > 0 ? ((count / deliveryTotal) * 100).toFixed(1) : 0;
                    const methodName = deliveryMethodNames[method] || method;
                    lines.push(`${methodName}:`);
                    lines.push(`  ${count} طلب (${percentage}%)`);
                  });
                lines.push('');
                lines.push('- - - - - - - - - - - - - - - -');
                lines.push('');
                
                // Payment Methods (with amounts)
                lines.push('--- طرق الدفع ---');
                lines.push('');
                const paymentMethodNames = {
                  'cash': 'كاش',
                  'visa': 'فيزا',
                  'apple_pay': 'Apple Pay',
                  'unknown': 'غير محدد'
                };
                const paymentTotal = Object.values(currentAnalytics.paymentStats).reduce((a, b) => a + b, 0);
                
                // Calculate payment amounts from filtered orders (weekly) — revenue only, no delivery fee
                const filteredOrdersForCalc = currentOrders.filter(order => {
                  const orderDate = new Date(order.createdAt);
                  return orderDate >= currentStartDate && orderDate <= currentEndDate;
                });
                
                const paymentAmounts = {};
                filteredOrdersForCalc.forEach(order => {
                  const method = order.paymentMethod || 'unknown';
                  paymentAmounts[method] = (paymentAmounts[method] || 0) + getOrderRevenue(order);
                });
                
                Object.entries(currentAnalytics.paymentStats)
                  .sort(([,a], [,b]) => b - a) // Sort by count descending
                  .forEach(([method, count]) => {
                    const percentage = paymentTotal > 0 ? ((count / paymentTotal) * 100).toFixed(1) : 0;
                    const amount = paymentAmounts[method] || 0;
                    const methodName = paymentMethodNames[method] || method;
                    lines.push(`${methodName}:`);
                    lines.push(`  ${formatNumber(amount)}₪ - ${percentage}%`);
                  });
                lines.push('');
                lines.push('================================');
                lines.push(''); // Extra blank line at end
                
                return lines.join('\n');
              };
              
              // Try silent printing first (native POS printer)
              if (canUseNativePrinter()) {
                try {
                  console.log('✅ Using native POS printer (H10) for weekly report');
                  const reportText = buildReportText();
                  console.log('📄 Report text length:', reportText.length);
                  console.log('📄 Report text preview (first 200 chars):', reportText.substring(0, 200));
                  
                  const result = await window.PosPrinter.printText(reportText);
                  console.log('🖨️ Print result:', result, 'Type:', typeof result);
                  
                  if (result && typeof result === 'string' && result.includes('success')) {
                    console.log('✅ Weekly report printed successfully');
                    toast.success('✅ تمت طباعة التقرير الأسبوعي بنجاح', {
                      duration: 2000,
                      position: 'top-center',
                      style: {
                        fontSize: '18px',
                        fontWeight: '700',
                        padding: '16px 24px',
                      },
                    });
                    return;
                  } else if (result && typeof result === 'string' && result.includes('error')) {
                    console.error('Native print error:', result);
                    toast.error('❌ خطأ في الطباعة: ' + result, {
                      duration: 3000,
                      position: 'top-center',
                    });
                    return;
                  } else {
                    // Result might be null, undefined, or unexpected format
                    console.warn('⚠️ Unexpected print result format:', result);
                    toast.error('❌ خطأ غير متوقع في الطباعة', {
                      duration: 3000,
                      position: 'top-center',
                    });
                    return;
                  }
                } catch (err) {
                  console.error('❌ Native POS print failed:', err);
                  console.error('Error details:', {
                    message: err?.message,
                    stack: err?.stack,
                    name: err?.name
                  });
                  toast.error('❌ فشل الاتصال بالطابعة: ' + (err?.message || 'خطأ غير معروف'), {
                    duration: 3000,
                    position: 'top-center',
                  });
                  return;
                }
              } else {
                // Native printer not available
                console.warn('⚠️ Native printer not available');
                toast.error('⚠️ الطابعة غير متاحة. يرجى التأكد من الاتصال بالطابعة.', {
                  duration: 3000,
                  position: 'top-center',
                });
              }
            }}
            style={{
              padding: window.innerWidth < 768 ? '6px 12px' : '8px 16px',
              borderRadius: '20px',
              border: '1px solid #28a745',
              background: '#28a745',
              color: 'white',
              fontSize: window.innerWidth < 768 ? '12px' : '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxSizing: 'border-box'
            }}
          >
            <span>📄</span>
            <span>تصدير PDF أسبوعي</span>
          </button>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 
          ? 'repeat(2, 1fr)' 
          : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: window.innerWidth < 768 ? '12px' : '20px',
        marginBottom: '40px',
        gridAutoRows: '1fr',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: '100%'
      }}>
        <div 
          style={{
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>💰</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>إجمالي المبيعات</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.salesChange !== 0 ? '8px' : '0' }}>
            {analytics.totalSales.toLocaleString()}₪
          </div>
          {analytics.salesChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.salesChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.salesChange > 0 ? '↑' : '↓'}</span>
              <span style={{ 
                color: analytics.salesChange > 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.salesChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25,  textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div 
          style={{
            background: 'linear-gradient(135deg, #c92a2a 0%, #e03131 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>📦</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>عدد الطلبات</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.orderCountChange !== 0 ? '8px' : '0' }}>
            {analytics.orderCount.toLocaleString()}
          </div>
          {analytics.orderCountChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.orderCountChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.orderCountChange > 0 ? '↑' : '↓'}</span>
              <span style={{ 
                color: analytics.orderCountChange > 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.orderCountChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div 
          style={{
            background: 'linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>✅</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>الطلبات المكتملة</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.completedOrdersChange !== 0 ? '8px' : '0' }}>
            {analytics.completedOrders.toLocaleString()}
          </div>
          {analytics.completedOrdersChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.completedOrdersChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.completedOrdersChange > 0 ? '↑' : '↓'}</span>
              <span style={{ 
                color: analytics.completedOrdersChange > 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.completedOrdersChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div 
          style={{
            background: 'linear-gradient(135deg, #3d3d5c 0%, #5a5a7a 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>📈</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>متوسط قيمة الطلب</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.avgOrderValueChange !== 0 ? '8px' : '0' }}>
            {analytics.avgOrderValue.toFixed(0)}₪
          </div>
          {analytics.avgOrderValueChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.avgOrderValueChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.avgOrderValueChange > 0 ? '↑' : '↓'}</span>
              <span style={{ 
                color: analytics.avgOrderValueChange > 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.avgOrderValueChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div 
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>⏰</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>أوقات الذروة</div>
          <div style={{ fontSize: '17px', fontWeight: '700', lineHeight: 1.4 }}>
            {analytics.peakHours.slice(0, 2).map(([hour, stats], idx) => {
              const startHour = String(hour).padStart(2, '0');
              const endHour = String((parseInt(hour) + 1) % 24).padStart(2, '0');
              return (
                <div key={hour} style={{ marginBottom: idx < 1 ? '8px' : '0' }}>
                  {startHour}:00-{endHour}:00
                  <span style={{ fontSize: '13px', opacity: 0.9, marginRight: '6px' }}>
                    ({stats.orders})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div 
          className="analytics-desktop-only"
          style={{
            background: 'linear-gradient(135deg, #7c2d12 0%, #991b1b 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>❌</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>معدل الإلغاء</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.cancellationRateChange !== 0 ? '8px' : '0' }}>
            {analytics.cancellationRate.toFixed(1)}%
          </div>
          {analytics.cancellationRateChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.cancellationRateChange < 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.cancellationRateChange < 0 ? '↓' : '↑'}</span>
              <span style={{ 
                color: analytics.cancellationRateChange < 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.cancellationRateChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25,  textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '6px' }}>
            ({analytics.cancelledOrders} طلب)
          </div>
        </div>

        <div 
          style={{
            background: 'linear-gradient(135deg, #4a2c2a 0%, #6b3e3a 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>⚡</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>متوسط وقت التحضير</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.avgPrepTimeChange !== 0 && analytics.avgPrepTime > 0 ? '8px' : '0' }}>
            {analytics.avgPrepTime > 0 ? `${analytics.avgPrepTime.toFixed(0)} دقيقة` : 'لا توجد بيانات'}
          </div>
          {analytics.avgPrepTimeChange !== 0 && analytics.avgPrepTime > 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.avgPrepTimeChange < 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.avgPrepTimeChange < 0 ? '↓' : '↑'}</span>
              <span style={{ 
                color: analytics.avgPrepTimeChange < 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.avgPrepTimeChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>

        <div 
          className="analytics-desktop-only"
          style={{
            background: 'linear-gradient(135deg, #155e75 0%, #0e7490 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>💵</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginBottom: '8px', fontWeight: '500' }}>الإيرادات في الساعة</div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: analytics.revenuePerHourChange !== 0 ? '8px' : '0' }}>
            {analytics.revenuePerHour.toFixed(1)}₪
          </div>
          {analytics.revenuePerHourChange !== 0 && (
            <div style={{ 
              fontSize: '12px', 
              opacity: 0.95, 
              marginTop: '6px',
              display: 'flex',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: analytics.revenuePerHourChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
              padding: '4px 8px',
              borderRadius: '12px',
              width: 'fit-content',
              margin: '8px auto 0'
            }}>
              <span style={{ fontSize: '14px' }}>{analytics.revenuePerHourChange > 0 ? '↑' : '↓'}</span>
              <span style={{ 
                color: analytics.revenuePerHourChange > 0 ? '#90EE90' : '#FFB6C1',
                fontWeight: '700'
              }}>
                {Math.abs(analytics.revenuePerHourChange).toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25,  textAlign: 'right' }}>
                <span>مقارنة بــ</span>
                <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{analytics.previousPeriodLabel}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 
          ? '1fr' 
          : 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: window.innerWidth < 768 ? '20px' : '30px',
        marginBottom: '40px',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: '100%'
      }}>
        {/* Daily Sales Chart */}
        <div style={{
          background: 'white',
          padding: window.innerWidth < 768 ? '15px' : '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333', fontSize: window.innerWidth < 768 ? '16px' : '18px' }}>📅 المبيعات اليومية</h3>
          <div style={{ 
            height: '200px', 
            display: 'flex', 
            alignItems: 'end', 
            gap: window.innerWidth < 768 ? '4px' : '10px',
            paddingTop: '10px',
            marginTop: '10px',
            overflowX: window.innerWidth < 768 ? 'auto' : 'visible',
            overflowY: 'hidden',
            width: '100%',
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch'
          }}>
            {analytics.dailySales.map(([date, data], index) => {
              const maxSales = Math.max(...analytics.dailySales.map(([,d]) => d.sales));
              const height = (data.sales / maxSales) * 160;
              return (
                <div key={date} style={{ 
                  flex: window.innerWidth < 768 ? '0 0 auto' : '1',
                  minWidth: window.innerWidth < 768 ? '40px' : 'auto',
                  textAlign: 'center' 
                }}>
                  <div style={{
                    height: `${height}px`,
                    background: 'linear-gradient(to top, #007bff, #0056b3)',
                    borderRadius: '4px 4px 0 0',
                    marginBottom: '10px',
                    minHeight: '4px',
                    width: '100%'
                  }} />
                  <div style={{ fontSize: window.innerWidth < 768 ? '10px' : '12px', color: '#666', whiteSpace: 'nowrap' }}>
                    {data.displayDate}
                  </div>
                  <div style={{ fontSize: window.innerWidth < 768 ? '9px' : '11px', color: '#999', marginTop: '2px' }}>
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
          padding: window.innerWidth < 768 ? '15px' : '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%'
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
        gridTemplateColumns: window.innerWidth < 768 
          ? '1fr' 
          : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: window.innerWidth < 768 ? '20px' : '30px',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: '100%'
      }}>
        {/* Delivery Methods */}
        <div style={{
          background: 'white',
          padding: window.innerWidth < 768 ? '15px' : '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%'
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
          padding: window.innerWidth < 768 ? '15px' : '25px',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #eee',
          width: '100%',
          boxSizing: 'border-box',
          maxWidth: '100%'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>💳 طرق الدفع</h3>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e3c72' }}>
              {(() => {
                const totalAmount = analytics.paymentAmounts
                  ? Object.values(analytics.paymentAmounts).reduce((a, b) => a + (b || 0), 0)
                  : 0;
                return `إجمالي ${totalAmount.toLocaleString()}₪`;
              })()}
            </span>
          </div>
          {Object.entries(analytics.paymentStats).map(([method, count]) => {
            const total = Object.values(analytics.paymentStats).reduce((a, b) => a + b, 0);
            const percentage = (count / total * 100).toFixed(1);
            const amount = (analytics.paymentAmounts && analytics.paymentAmounts[method]) || 0;
            const methodNames = {
              'cash': 'كاش',
              'credit_card': 'بطاقة',
              'visa': 'فيزا',
              'apple_pay': 'Apple Pay',
              'apple_google': 'Apple / Google Pay',
              'unknown': 'غير محدد'
            };
            const methodLabel = methodNames[method] || method;
            const orderWord = count === 1 ? 'طلب' : (count >= 2 && count <= 10 ? 'طلبات' : 'طلب');
            return (
              <div key={method} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{methodLabel}</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {count} {orderWord}{amount > 0 ? ` (${amount.toLocaleString()}₪)` : ''}
                  </span>
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
                              method === 'visa' ? '#007bff' : 
                              method === 'apple_pay' ? '#6f42c1' : '#6c757d',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sales & orders trend — above top 3 clients */}
      <div style={{
        marginTop: '40px',
        marginBottom: '20px',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        overflow: 'hidden',
        padding: window.innerWidth < 768 ? '16px' : '22px 25px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: window.innerWidth < 768 ? 'column' : 'row',
          flexWrap: window.innerWidth < 768 ? 'wrap' : 'nowrap',
          alignItems: window.innerWidth < 768 ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: window.innerWidth < 768 ? '8px' : '12px',
          marginBottom: window.innerWidth < 768 ? '12px' : '18px',
        }}>
          <h2 style={{
            margin: 0,
            color: '#333',
            fontSize: window.innerWidth < 768 ? '13px' : '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: window.innerWidth < 768 ? '4px' : '10px',
            flex: window.innerWidth < 768 ? 'none' : 1,
            minWidth: 0,
            lineHeight: 1.3,
          }}>
            <span style={{ flexShrink: 0, fontSize: window.innerWidth < 768 ? '14px' : undefined }}>📈</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: window.innerWidth < 768 ? 'nowrap' : 'normal',
            }}>
              اتجاه المبيعات والطلبات والمستخدمين
            </span>
          </h2>
          <div style={{
            display: 'flex',
            gap: window.innerWidth < 768 ? '5px' : '8px',
            flexWrap: 'nowrap',
            flexShrink: 0,
            justifyContent: window.innerWidth < 768 ? 'flex-end' : undefined,
            alignSelf: window.innerWidth < 768 ? 'flex-start' : undefined,
            width: 'auto',
            maxWidth: '100%',
          }}>
            {[
              { id: '3m', label: '3 أشهر' },
              { id: '6m', label: '6 أشهر' },
              { id: '1y', label: 'سنة' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className="analytics-trend-chip"
                onClick={() => {
                  setTrendRange(id);
                  setTrendHoverIndex(null);
                }}
                style={{
                  background: trendRange === id
                    ? 'linear-gradient(135deg, #f77f00 0%, #fcbf49 100%)'
                    : '#f8f9fa',
                  color: trendRange === id ? 'white' : '#444',
                  border: trendRange === id ? '1px solid transparent' : '1px solid #ddd',
                  boxShadow: trendRange === id ? '0 1px 4px rgba(247,127,0,0.3)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const { buckets, maxSales, maxCount } = salesOrdersTrend;
          const isMobile = window.innerWidth < 768;
          const W = isMobile ? 340 : 720;
          const H = isMobile ? 220 : 280;
          const pad = { top: 20, right: 48, bottom: 44, left: 56 };
          const plotW = W - pad.left - pad.right;
          const plotH = H - pad.top - pad.bottom;
          const n = buckets.length;
          const xAt = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
          const ySales = (v) => pad.top + plotH - (v / maxSales) * plotH;
          const yCount = (v) => pad.top + plotH - (v / maxCount) * plotH;
          const salesPath = buckets
            .map((b, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${ySales(b.sales).toFixed(1)}`)
            .join(' ');
          const ordersPath = buckets
            .map((b, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yCount(b.orders).toFixed(1)}`)
            .join(' ');
          const usersPath = buckets
            .map((b, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yCount(b.newUsers).toFixed(1)}`)
            .join(' ');
          const salesTicks = [0, 0.5, 1].map((t) => Math.round(maxSales * t));
          const countTicks = [0, 0.5, 1].map((t) => Math.round(maxCount * t));
          const formatSalesAxis = (v) => {
            if (v >= 1000) return `${Math.round(v / 1000)}k`;
            return String(v);
          };
          const hover = trendHoverIndex != null ? buckets[trendHoverIndex] : null;
          const hoverX = trendHoverIndex != null ? xAt(trendHoverIndex) : 0;
          const colW = n <= 1 ? plotW : plotW / (n - 1);
          const USERS_COLOR = '#28a745';

          return (
            <>
              <div
                style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}
                onMouseLeave={() => setTrendHoverIndex(null)}
              >
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  height={isMobile ? 220 : 280}
                  style={{ display: 'block', minWidth: isMobile ? 320 : undefined }}
                  role="img"
                  aria-label="اتجاه المبيعات والطلبات والمستخدمين"
                >
                  {/* grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = pad.top + plotH * (1 - t);
                    return (
                      <line
                        key={`g-${t}`}
                        x1={pad.left}
                        y1={y}
                        x2={W - pad.right}
                        y2={y}
                        stroke="#e9ecef"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* left axis — sales */}
                  {salesTicks.map((v) => (
                    <text
                      key={`s-${v}`}
                      x={pad.left - 8}
                      y={ySales(v) + 4}
                      textAnchor="end"
                      fill="#f77f00"
                      fontSize="11"
                    >
                      {formatSalesAxis(v)}
                    </text>
                  ))}

                  {/* right axis — orders / users count */}
                  {countTicks.map((v) => (
                    <text
                      key={`c-${v}`}
                      x={W - pad.right + 8}
                      y={yCount(v) + 4}
                      textAnchor="start"
                      fill="#6c757d"
                      fontSize="11"
                    >
                      {v}
                    </text>
                  ))}

                  {/* sales line */}
                  <path d={salesPath} fill="none" stroke="#f77f00" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {/* orders line */}
                  <path d={ordersPath} fill="none" stroke="#007bff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {/* new users line */}
                  <path d={usersPath} fill="none" stroke={USERS_COLOR} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

                  {/* hover guide line */}
                  {hover && (
                    <line
                      x1={hoverX}
                      y1={pad.top}
                      x2={hoverX}
                      y2={pad.top + plotH}
                      stroke="#adb5bd"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* points + labels */}
                  {buckets.map((b, i) => {
                    const active = trendHoverIndex === i;
                    return (
                      <g key={b.key}>
                        <circle
                          cx={xAt(i)}
                          cy={ySales(b.sales)}
                          r={active ? 7 : 5}
                          fill={active ? '#f77f00' : '#fff'}
                          stroke="#f77f00"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={xAt(i)}
                          cy={yCount(b.orders)}
                          r={active ? 7 : 5}
                          fill={active ? '#007bff' : '#fff'}
                          stroke="#007bff"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={xAt(i)}
                          cy={yCount(b.newUsers)}
                          r={active ? 7 : 5}
                          fill={active ? USERS_COLOR : '#fff'}
                          stroke={USERS_COLOR}
                          strokeWidth="2.5"
                        />
                        {active && (
                          <>
                            <circle cx={xAt(i)} cy={ySales(b.sales)} r="3" fill="#fff" />
                            <circle cx={xAt(i)} cy={yCount(b.orders)} r="3" fill="#fff" />
                            <circle cx={xAt(i)} cy={yCount(b.newUsers)} r="3" fill="#fff" />
                          </>
                        )}
                        <text
                          x={xAt(i)}
                          y={H - 14}
                          textAnchor="middle"
                          fill={active ? '#222' : '#666'}
                          fontWeight={active ? 700 : 400}
                          fontSize={isMobile || n > 8 ? '10' : '11'}
                        >
                          {n > 6 ? b.shortLabel.slice(0, 3) : b.shortLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* invisible hit zones for easy hover */}
                  {buckets.map((b, i) => {
                    const cx = xAt(i);
                    const half = Math.max(colW / 2, 18);
                    return (
                      <rect
                        key={`hit-${b.key}`}
                        x={cx - half}
                        y={pad.top}
                        width={half * 2}
                        height={plotH}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setTrendHoverIndex(i)}
                        onFocus={() => setTrendHoverIndex(i)}
                        onMouseMove={() => setTrendHoverIndex(i)}
                      />
                    );
                  })}
                </svg>

                {hover && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${(pad.top / H) * 100}%`,
                      left: `${(hoverX / W) * 100}%`,
                      transform: trendHoverIndex >= n / 2
                        ? 'translate(-110%, 8px)'
                        : 'translate(12px, 8px)',
                      background: 'rgba(33, 37, 41, 0.94)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '10px 14px',
                      minWidth: 160,
                      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                      pointerEvents: 'none',
                      zIndex: 5,
                      direction: 'rtl',
                      textAlign: 'right',
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                      {hover.label}
                    </div>
                    <div style={{ color: '#fcbf49', fontWeight: 600 }}>
                      المبيعات : {Math.round(hover.sales).toLocaleString('en-US')}₪
                    </div>
                    <div style={{ color: '#74c0fc', fontWeight: 600 }}>
                      الطلبات : {hover.orders.toLocaleString('en-US')}
                    </div>
                    <div style={{ color: '#8ce99a', fontWeight: 600 }}>
                      مستخدمين جدد : {hover.newUsers.toLocaleString('en-US')}
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isMobile ? '8px' : '22px',
                marginTop: '8px',
                flexWrap: 'nowrap',
                fontSize: isMobile ? '11px' : '13px',
                color: '#444',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', flexShrink: 0 }}>
                  <span style={{ width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: '50%', background: '#f77f00', display: 'inline-block', flexShrink: 0 }} />
                  {isMobile ? 'مبيعات' : 'المبيعات (₪)'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', flexShrink: 0 }}>
                  <span style={{ width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: '50%', background: '#007bff', display: 'inline-block', flexShrink: 0 }} />
                  طلبات
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', flexShrink: 0 }}>
                  <span style={{ width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: '50%', background: '#28a745', display: 'inline-block', flexShrink: 0 }} />
                  {isMobile ? 'مستخدمين' : 'مستخدمين جدد'}
                </span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Top 3 clients — above user analytics */}
      <div style={{
        marginTop: '20px',
        marginBottom: '20px',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        overflow: 'hidden',
        padding: '22px 25px',
      }}>
        <h2 style={{
          margin: '0 0 18px 0',
          color: '#333',
          fontSize: '20px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span>🏆</span>
          <span style={{fontSize: '16px'}}>أفضل 3 عملاء</span>
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#888',
            marginRight: 'auto',
          }}>
            حسب طلبات بالفترة المحددة
          </span>
        </h2>

        {userAnalytics.topClients?.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 768
              ? '1fr'
              : 'repeat(3, 1fr)',
            gap: '14px',
          }}>
            {userAnalytics.topClients.map((client) => {
              const medal = client.rank === 1 ? '🥇' : client.rank === 2 ? '🥈' : '🥉';
              const accent =
                client.rank === 1
                  ? 'linear-gradient(135deg, #b8860b 0%, #daa520 100%)'
                  : client.rank === 2
                    ? 'linear-gradient(135deg, #5a6268 0%, #868e96 100%)'
                    : 'linear-gradient(135deg, #8b4513 0%, #cd853f 100%)';
              const orderWord =
                client.orderCount === 1
                  ? 'طلب'
                  : client.orderCount >= 2 && client.orderCount <= 10
                    ? 'طلبات'
                    : 'طلب';
              return (
                <div
                  key={client.phone}
                  style={{
                    background: accent,
                    borderRadius: '14px',
                    padding: '16px 18px',
                    color: 'white',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minHeight: '140px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}>
                    <span style={{ fontSize: '22px' }}>{medal}</span>
                    <span style={{
                      fontSize: '12px',
                      opacity: 0.9,
                      background: 'rgba(255,255,255,0.2)',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontWeight: '600',
                    }}>
                      #{client.rank}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '17px',
                    fontWeight: '700',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.92, direction: 'ltr', textAlign: 'right' }}>
                    {client.phone}
                  </div>
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}>
                    <span>{client.orderCount} {orderWord}</span>
                    <span>{client.totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })}₪</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '28px 16px',
            textAlign: 'center',
            color: '#888',
            fontSize: '14px',
            background: '#f8f9fa',
            borderRadius: '12px',
          }}>
            لا توجد طلبات عملاء في هذه الفترة
          </div>
        )}
      </div>

      {/* User Analytics Section - Collapsible */}
      <div style={{ 
        marginTop: '20px', 
        marginBottom: '40px',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowUserAnalytics(!showUserAnalytics)}
          style={{
            padding: '20px 25px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: showUserAnalytics ? '1px solid #eee' : 'none',
            background: showUserAnalytics ? '#f8f9fa' : 'transparent',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#f8f9fa';
          }}
          onMouseOut={(e) => {
            if (!showUserAnalytics) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <h2 style={{ 
            margin: 0,
            color: '#333', 
            fontSize: '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>👥</span>
            <span>
              إحصائيات المستخدمين
              <span style={{ fontWeight: 600, color: '#666', fontSize: '0.85em' }}>
                ({(() => {
                  if (timeRange === '1d') return 'اليوم فقط';
                  if (timeRange === 'yesterday') return 'يوم امس فقط';
                  if (timeRange === '7d') return 'اخر 7 ايام';
                  if (timeRange === 'month') return 'الشهر الحالي';
                  if (timeRange === '30d') return 'اخر 30 يوم';
                  if (timeRange === 'custom' && customDateStart && customDateEnd) {
                    const fmt = (d) => {
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      return `${day}.${month}`;
                    };
                    return `${fmt(new Date(customDateStart))}–${fmt(new Date(customDateEnd))}`;
                  }
                  return 'مخصص';
                })()})
              </span>
            </span>
          </h2>
          <span style={{ 
            fontSize: '20px', 
            color: '#666',
            transition: 'transform 0.2s ease',
            transform: showUserAnalytics ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </div>

        {showUserAnalytics && (
          <div style={{ padding: '25px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 768 
                ? 'repeat(2, 1fr)' 
                : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: window.innerWidth < 768 ? '12px' : '20px'
            }}>
              <div 
                style={{
                  background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                  padding: '18px 20px',
                  borderRadius: '15px',
                  color: 'white',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>إجمالي المستخدمين</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                  {userAnalytics.totalUsers.toLocaleString()}
                </div>
              </div>

              <div 
                style={{
                  background: 'linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%)',
                  padding: '18px 20px',
                  borderRadius: '15px',
                  color: 'white',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🟢</div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>المستخدمين النشطين</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: userAnalytics.activeUsersChange !== 0 ? '8px' : '0' }}>
                  {userAnalytics.activeUsers.toLocaleString()}
                </div>
                {userAnalytics.activeUsersChange !== 0 && (
                  <div style={{ 
                    fontSize: '12px', 
                    opacity: 0.95, 
                    marginTop: '6px',
                    display: 'flex',
                    direction: 'ltr',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: userAnalytics.activeUsersChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    width: 'fit-content',
                    margin: '8px auto 0'
                  }}>
                    <span style={{ fontSize: '14px' }}>{userAnalytics.activeUsersChange > 0 ? '↑' : '↓'}</span>
                    <span style={{ 
                      color: userAnalytics.activeUsersChange > 0 ? '#90EE90' : '#FFB6C1',
                      fontWeight: '700'
                    }}>
                      {Math.abs(userAnalytics.activeUsersChange).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, textAlign: 'right' }}>
                      <span>مقارنة بــ</span>
                      <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{userAnalytics.previousPeriodLabel}</span>
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                  (في الفترة المحددة)
                </div>
              </div>

              <div 
                style={{
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  padding: '18px 20px',
                  borderRadius: '15px',
                  color: 'white',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🆕</div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>مستخدمين جدد</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: userAnalytics.newUsersChange !== 0 ? '8px' : '0' }}>
                  {userAnalytics.newUsers.toLocaleString()}
                </div>
                {userAnalytics.newUsersChange !== 0 && (
                  <div style={{ 
                    fontSize: '12px', 
                    opacity: 0.95, 
                    marginTop: '6px',
                    display: 'flex',
                    direction: 'ltr',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: userAnalytics.newUsersChange > 0 ? 'rgba(144, 238, 144, 0.2)' : 'rgba(255, 182, 193, 0.2)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    width: 'fit-content',
                    margin: '8px auto 0'
                  }}>
                    <span style={{ fontSize: '14px' }}>{userAnalytics.newUsersChange > 0 ? '↑' : '↓'}</span>
                    <span style={{ 
                      color: userAnalytics.newUsersChange > 0 ? '#90EE90' : '#FFB6C1',
                      fontWeight: '700'
                    }}>
                      {Math.abs(userAnalytics.newUsersChange).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '10px', opacity: 0.85, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25,  textAlign: 'right' }}>
                      <span>مقارنة بــ</span>
                      <span style={{ fontSize: '9px', opacity: 0.9, direction: 'ltr', unicodeBidi: 'isolate' }}>{userAnalytics.previousPeriodLabel}</span>
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                  (في الفترة المحددة)
                </div>
              </div>

              <div 
                style={{
                  background: 'linear-gradient(135deg, #4a2c2a 0%, #6b3e3a 100%)',
                  padding: '18px 20px',
                  borderRadius: '15px',
                  color: 'white',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '5px' }}>متوسط الطلبات لكل مستخدم</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold' }}>
                  {userAnalytics.averageOrdersPerUser.toFixed(1)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                  ({userAnalytics.totalOrdersInPeriod} طلب / {userAnalytics.activeUsers} مستخدم نشط)
                </div>
              </div>
            </div>

            {/* New users — collapsible name/phone list for selected period */}
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setShowNewUsersTable((v) => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #e8ecf1',
                  background: showNewUsersTable ? '#f0f4ff' : '#fafbfc',
                  cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                  أسماء المستخدمين الجدد
                  <span style={{ fontWeight: 500, color: '#666', marginRight: 8, fontSize: 12 }}>
                    ({Math.min(20, userAnalytics.newUsersTotalInPeriod || 0)}
                    {(userAnalytics.newUsersTotalInPeriod || 0) > 20
                      ? ` من ${userAnalytics.newUsersTotalInPeriod}`
                      : ''}
                    )
                  </span>
                </span>
                <span style={{ color: '#007bff', fontSize: 14 }}>
                  {showNewUsersTable ? '▲' : '▼'}
                </span>
              </button>

              {showNewUsersTable && (
                <div
                  style={{
                    marginTop: 10,
                    border: '1px solid #e8ecf1',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  {(userAnalytics.newUsersList || []).length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13 }}>
                      لا يوجد مستخدمون جدد في الفترة المحددة
                    </div>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: window.innerWidth < 768 ? 12 : 13,
                          direction: 'rtl',
                        }}
                      >
                        <thead>
                          <tr style={{ background: '#f5f7fb', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#555', borderBottom: '1px solid #e8ecf1' }}>#</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#555', borderBottom: '1px solid #e8ecf1' }}>الاسم</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#555', borderBottom: '1px solid #e8ecf1' }}>الهاتف</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#555', borderBottom: '1px solid #e8ecf1', whiteSpace: 'nowrap' }}>التسجيل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(userAnalytics.newUsersList || []).map((u, idx) => (
                            <tr
                              key={u.id || `${u.phone}-${idx}`}
                              style={{
                                background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                                borderBottom: '1px solid #f0f0f0',
                              }}
                            >
                              <td style={{ padding: '10px 12px', color: '#999' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#222' }}>{u.name}</td>
                              <td style={{ padding: '10px 12px', direction: 'ltr', textAlign: 'right', fontFamily: 'monospace', color: '#333' }}>
                                {u.phoneRaw ? (
                                  <a href={`tel:${u.phoneRaw}`} style={{ color: '#007bff', textDecoration: 'none' }}>
                                    {u.phone}
                                  </a>
                                ) : (
                                  u.phone
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#666', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                                {u.registeredAtLabel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(userAnalytics.newUsersTotalInPeriod || 0) > 20 && (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: '#888', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                      يتم عرض أحدث 20 مستخدم فقط
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile-specific styles to override POS CSS */}
      <style>
        {`
          /* Compact trend range chips (override POS giant touch buttons) */
          button.analytics-trend-chip {
            font-family: inherit !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            padding: 7px 14px !important;
            min-height: 0 !important;
            min-width: 0 !important;
            height: auto !important;
            width: auto !important;
            max-width: none !important;
            border-radius: 999px !important;
            line-height: 1.35 !important;
            flex: none !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 0 !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
            transform: none !important;
            touch-action: manipulation;
          }

          @media (max-width: 767px) {
            button.analytics-trend-chip {
              font-size: 12px !important;
              padding: 5px 11px !important;
              min-height: 0 !important;
              min-width: 0 !important;
            }
          }

          /* Hide معدل الإلغاء and الإيرادات في الساعة on mobile and POS (show only on desktop) */
          @media (max-width: 1023px) {
            .analytics-desktop-only {
              display: none !important;
            }
          }
          
          @media (max-width: 767px) {
            /* Override POS styles for mobile phones */
            body {
              overflow-x: hidden !important;
              user-select: auto !important;
              -webkit-user-select: auto !important;
            }
            
            /* Ensure analytics page doesn't have horizontal scroll */
            .analytics-page-container {
              max-width: 100vw !important;
              overflow-x: hidden !important;
            }
            
            /* Fix grid layouts for mobile */
            .analytics-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 12px !important;
            }
            
            /* Ensure cards don't overflow */
            .analytics-card {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
          }
          
          /* Only apply POS styles in landscape orientation on larger screens (POS devices) */
          @media (orientation: landscape) and (min-width: 1024px) {
            /* POS styles apply here */
          }
        `}
      </style>
      </div>
    </>
  );
};

export default AnalyticsPage;
