import { useEffect, useState } from 'react';
import { db, firebaseApp } from '../firebase/firebaseConfig';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, deleteField } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from '../src/contexts/AuthContext';
import { 
  IoMdAdd, 
  IoMdCreate, 
  IoMdTrash, 
  IoMdCopy, 
  IoMdCheckmark, 
  IoMdClose,
  IoMdCalendar,
  IoMdPeople,
  IoMdPricetag,
  IoMdNotifications,
  IoMdSend
} from 'react-icons/io';
import {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  generateCouponCode,
  formatCouponDisplay,
  formatDateForDisplay,
  getCouponStatus,
  isCouponExpired,
  COUPON_TYPES,
  COUPON_STATUS
} from '../utils/couponUtils';
import brandConfig from '../constants/brandConfig';
import './styles.css';

const DEFAULT_LOYALTY = {
  enabled: true,
  currencyPerPoint: 100,
  redeemValuePerPoint: 1
};

const DEFAULT_REFERRAL = {
  referrerAmount: 20, // Fixed amount in ₪
  refereeAmount: 10,  // Fixed amount in ₪
  appLink: brandConfig?.referral?.appLink || ''
};

const DEFAULT_HERO_TAGLINE = {
  ar: 'ايش جاي عبالك تاكل اليوم؟',
  he: 'מה בא לך לאכול היום ؟',
};

// Matches JS Date.getDay(): 0 = Sunday … 6 = Saturday
const OFF_DAY_WEEKDAYS = [
  { key: 0, label: 'الأحد' },
  { key: 1, label: 'الاثنين' },
  { key: 2, label: 'الثلاثاء' },
  { key: 3, label: 'الأربعاء' },
  { key: 4, label: 'الخميس' },
  { key: 5, label: 'الجمعة' },
  { key: 6, label: 'السبت' },
];

function emptyDayRow() {
  return { open: '', close: '', closed: false };
}

function normalizeByDayFromFirestore(raw) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const r = raw && (raw[i] ?? raw[String(i)]);
    out[i] = r
      ? { open: r.open || '', close: r.close || '', closed: !!r.closed }
      : { ...emptyDayRow() };
  }
  return out;
}

function serializeWorkingHours(wh) {
  if (!wh.perDayEnabled) {
    return {
      open: wh.open || '',
      close: wh.close || '',
      offDays: Array.isArray(wh.offDays) ? wh.offDays : [],
      perDayEnabled: false,
    };
  }
  const byDay = {};
  for (let i = 0; i < 7; i++) {
    const d = wh.byDay?.[i] || emptyDayRow();
    byDay[String(i)] = {
      open: d.open || '',
      close: d.close || '',
      closed: !!d.closed,
    };
  }
  let firstOpen = '';
  let firstClose = '';
  for (let i = 0; i < 7; i++) {
    const d = wh.byDay?.[i];
    if (d && !d.closed && d.open && d.close) {
      firstOpen = d.open;
      firstClose = d.close;
      break;
    }
  }
  return {
    perDayEnabled: true,
    byDay,
    open: firstOpen || wh.open || '',
    close: firstClose || wh.close || '',
    offDays: [],
  };
}

const BusinessManagePage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { activeBusinessId } = useAuth();
  const [form, setForm] = useState({
    isOpen: true,
    workingHours: { open: '', close: '', offDays: [], perDayEnabled: false, byDay: {} },
    contact: { instagram: '', phone: '', website: '', waze: '', googleMapsUrl: '', coordinates: '', businessAddress: '', pickupNote: '' },
    prepTimeOptions: [], // new field
    deliveryCities: [], // NEW FIELD for delivery cities
    storeStatusMode: 'auto', // NEW FIELD
    features: { // NEW FIELD for delivery methods
      enablePickup: false,
      enableDelivery: false,
      enableEatIn: false,
      allowGuestCheckout: false,
      enableLogin: false,
      enableVisa: false,
      enableWhatsAppOrders: false,
      showPrices: false,
      showSplash: false
    },
    loyalty: DEFAULT_LOYALTY,
    referral: DEFAULT_REFERRAL,
    heroTagline: { ...DEFAULT_HERO_TAGLINE },
  });
  const [newPrepValue, setNewPrepValue] = useState('');
  const [newPrepUnit, setNewPrepUnit] = useState('minutes');
  const [newCity, setNewCity] = useState({ he: '', ar: '', deliveryFee: '' });
  const [showContact, setShowContact] = useState(false);
  const [showDeliveryCities, setShowDeliveryCities] = useState(false);
  const [editingCityIndex, setEditingCityIndex] = useState(null);
  const [showLoyaltyReferral, setShowLoyaltyReferral] = useState(false);
  const [showHeroTagline, setShowHeroTagline] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showPrepTimeOptions, setShowPrepTimeOptions] = useState(true);
  const [showDriverZones, setShowDriverZones] = useState(false);
  const [showPerDayHoursEditor, setShowPerDayHoursEditor] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  
  // Coupon management state
  const [showCoupons, setShowCoupons] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponFilter, setCouponFilter] = useState('all');
  
  // Promotional notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    body: '',
    targetAudience: 'all',
    selectedUsers: []
  });
  const [sendingNotification, setSendingNotification] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'menus', activeBusinessId);
      console.log('Fetching data from Firebase path:', 'menus/' + activeBusinessId);
      console.log('Active Business ID:', activeBusinessId);
      const snap = await getDoc(ref);
      console.log('Firebase document exists:', snap.exists());
      
      if (snap.exists()) {
        const data = snap.data();
        console.log('Full Firebase data:', data);
        console.log('Data keys:', Object.keys(data));
        
        // Try to get working hours from config if available
        let open = data.workingHours?.open || '';
        let close = data.workingHours?.close || '';
        let offDays = [];
        const cfgWh = data.config?.workingHours || {};
        if (data.config?.workingHours) {
          open = data.config.workingHours.open || open;
          close = data.config.workingHours.close || close;
          const rawOff = data.config.workingHours.offDays;
          if (Array.isArray(rawOff)) {
            offDays = [...new Set(rawOff.map(Number).filter((d) => d >= 0 && d <= 6 && !Number.isNaN(d)))].sort(
              (a, b) => a - b
            );
          }
        }
        const perDayEnabled = cfgWh.perDayEnabled === true;
        const byDay = perDayEnabled ? normalizeByDayFromFirestore(cfgWh.byDay) : {};
        // Get contact from config if available
        const contact = {
          email: data.config?.contact?.email || data.contact?.email || '',
          instagram: data.config?.contact?.instagram || data.contact?.instagram || '',
          phone: data.config?.contact?.phone || data.contact?.phone || '',
          website: data.config?.contact?.website || data.contact?.website || '',
          waze: data.config?.contact?.waze || data.contact?.waze || '',
          googleMapsUrl: data.config?.contact?.googleMapsUrl || data.contact?.googleMapsUrl || '',
          coordinates: data.config?.contact?.coordinates || data.contact?.coordinates || '',
          businessAddress: data.config?.contact?.businessAddress || data.config?.pickupAddress || data.contact?.businessAddress || '',
          pickupNote: data.config?.contact?.pickupNote || data.config?.pickupNote || data.contact?.pickupNote || '',
        };
        // Get prepTimeOptions from config if available
        const prepTimeOptions = data.config?.prepTimeOptions || [];
        // Get deliveryCities from config if available
        const deliveryCities = data.config?.deliveryCities || [];
        // Get storeStatusMode from config if available
        const storeStatusMode = data.config?.storeStatusMode || 'auto';

        // Get features from config.features - preserve existing values, default to false if not exists
        const existingFeatures = data.config?.features || {};
        console.log('Raw features from Firebase:', data.config?.features);
        console.log('Existing features object:', existingFeatures);
        console.log('enablePickup value:', existingFeatures.enablePickup);
        console.log('enablePickup type:', typeof existingFeatures.enablePickup);
        
        const features = {
          enablePickup: existingFeatures.enablePickup ?? false,
          enableDelivery: existingFeatures.enableDelivery ?? false,
          enableEatIn: existingFeatures.enableEatIn ?? false,
          allowGuestCheckout: existingFeatures.allowGuestCheckout ?? false,
          enableLogin: existingFeatures.enableLogin ?? false,
          enableVisa: existingFeatures.enableVisa ?? false,
          enableWhatsAppOrders: existingFeatures.enableWhatsAppOrders ?? false,
          showPrices: existingFeatures.showPrices ?? false,
          showSplash: existingFeatures.showSplash ?? false
        };
        console.log('Final processed features for form:', features);

        const loyaltyConfig = {
          enabled: typeof data.config?.loyalty?.enabled === 'boolean'
            ? data.config.loyalty.enabled
            : DEFAULT_LOYALTY.enabled,
          currencyPerPoint: Number(data.config?.loyalty?.currencyPerPoint) > 0
            ? Number(data.config.loyalty.currencyPerPoint)
            : DEFAULT_LOYALTY.currencyPerPoint,
          redeemValuePerPoint: Number(data.config?.loyalty?.redeemValuePerPoint) > 0
            ? Number(data.config.loyalty.redeemValuePerPoint)
            : DEFAULT_LOYALTY.redeemValuePerPoint
        };
        
        const referralConfig = {
          // Support both old percentage format and new fixed amount format
          referrerAmount: Number(data.config?.referral?.referrerAmount) > 0
            ? Number(data.config.referral.referrerAmount)
            : (Number(data.config?.referral?.referrerPercentage) > 0 
                ? Number(data.config.referral.referrerPercentage) // Legacy: treat percentage as amount
                : DEFAULT_REFERRAL.referrerAmount),
          refereeAmount: Number(data.config?.referral?.refereeAmount) > 0
            ? Number(data.config.referral.refereeAmount)
            : (Number(data.config?.referral?.refereePercentage) > 0
                ? Number(data.config.referral.refereePercentage) // Legacy: treat percentage as amount
                : DEFAULT_REFERRAL.refereeAmount),
          appLink:
            typeof data.config?.referral?.appLink === 'string'
              ? data.config.referral.appLink
              : DEFAULT_REFERRAL.appLink
        };
        
        const heroTagline = {
          ...DEFAULT_HERO_TAGLINE,
          ...(data.config?.heroTagline || {}),
        };
        
        // Set the form with all the loaded data
        setForm({
          isOpen: typeof data.isOpen === 'boolean' ? data.isOpen : true,
          workingHours: { open, close, offDays, perDayEnabled, byDay },
          contact,
          prepTimeOptions,
          deliveryCities,
          storeStatusMode,
          features,
          loyalty: loyaltyConfig,
          referral: referralConfig,
          heroTagline,
        });
        
        console.log('Form state set with features:', features);
        
        // Double-check the form state after a short delay
        setTimeout(() => {
          console.log('Form state after 100ms delay:', form);
        }, 100);
      } else {
        console.log('Firebase document does not exist!');
      }
      setLoading(false);
    };
    if (activeBusinessId) {
      fetchData();
    }
  }, [activeBusinessId]);

  // Debug: Monitor form state changes
  useEffect(() => {
    console.log('Form state changed:', form);
    console.log('Features in form state:', form.features);
  }, [form]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'isOpen') {
      setForm((prev) => ({ ...prev, isOpen: checked }));
    } else if (name === 'open' || name === 'close') {
      setForm((prev) => ({
        ...prev,
        workingHours: { ...prev.workingHours, [name]: value },
      }));
    } else if (["email", "instagram", "phone", "website", "waze", "googleMapsUrl", "coordinates", "businessAddress", "pickupNote"].includes(name)) {
      setForm((prev) => ({
        ...prev,
        contact: { ...prev.contact, [name]: value },
      }));
    } else if (name === 'storeStatusMode') {
      setForm((prev) => ({ ...prev, storeStatusMode: value }));
    } else if (name.startsWith('feature_')) {
      const featureName = name.replace('feature_', '');
      console.log('Feature changed:', featureName, 'to:', checked); // Debug log
      const updatedFeatures = {
        ...form.features,
        [featureName]: checked
      };
      setForm((prev) => ({
        ...prev,
        features: updatedFeatures
      }));
      
      // Auto-save to Firebase immediately
      saveFeatureToFirebase(updatedFeatures);
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleOffDay = (dayKey) => {
    setForm((prev) => {
      const current = prev.workingHours.offDays || [];
      const next = new Set(current);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      const offDays = [...next].sort((a, b) => a - b);
      return { ...prev, workingHours: { ...prev.workingHours, offDays } };
    });
  };

  const togglePerDayEnabled = (checked) => {
    setForm((prev) => {
      const wh = prev.workingHours;
      if (checked) {
        setShowPerDayHoursEditor(false);
        const byDay = {};
        for (let i = 0; i < 7; i++) {
          const off = (wh.offDays || []).includes(i);
          byDay[i] = off
            ? { open: '', close: '', closed: true }
            : { open: wh.open || '', close: wh.close || '', closed: false };
        }
        return { ...prev, workingHours: { ...wh, perDayEnabled: true, byDay } };
      }
      const byDay = wh.byDay || {};
      const offDays = [];
      for (let i = 0; i < 7; i++) {
        const d = byDay[i];
        if (!d || d.closed || !String(d.open || '').trim() || !String(d.close || '').trim()) {
          offDays.push(i);
        }
      }
      let open = wh.open || '';
      let close = wh.close || '';
      if (!open || !close) {
        for (let i = 0; i < 7; i++) {
          const d = byDay[i];
          if (d && !d.closed && d.open && d.close) {
            open = d.open;
            close = d.close;
            break;
          }
        }
      }
      return {
        ...prev,
        workingHours: {
          ...wh,
          perDayEnabled: false,
          open,
          close,
          offDays: [...new Set(offDays)].sort((a, b) => a - b),
          byDay: {},
        },
      };
    });
    if (!checked) setShowPerDayHoursEditor(false);
  };

  const updateByDay = (dayKey, field, value) => {
    setForm((prev) => {
      const wh = prev.workingHours;
      const nextBy = { ...(wh.byDay || {}) };
      const cur = nextBy[dayKey] || emptyDayRow();
      nextBy[dayKey] = { ...cur, [field]: value };
      return { ...prev, workingHours: { ...wh, byDay: nextBy } };
    });
  };

  const togglePerDayClosed = (dayKey) => {
    setForm((prev) => {
      const wh = prev.workingHours;
      const nextBy = { ...(wh.byDay || {}) };
      const cur = nextBy[dayKey] || emptyDayRow();
      nextBy[dayKey] = { ...cur, closed: !cur.closed };
      return { ...prev, workingHours: { ...wh, byDay: nextBy } };
    });
  };

  const perDayClosedCount = OFF_DAY_WEEKDAYS.filter(({ key }) => {
    const row = form.workingHours.byDay?.[key] || emptyDayRow();
    return !!row.closed;
  }).length;

  const perDayOpenCount = 7 - perDayClosedCount;

  const handleLoyaltyChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      loyalty: {
        ...prev.loyalty,
        [key]: key === 'enabled' ? value : Number(value)
      }
    }));
  };

  const handleReferralChange = (key, value) => {
    setForm(prev => ({
      ...prev,
      referral: {
        ...prev.referral,
        [key]: key === 'appLink' ? value : Number(value)
      }
    }));
  };

  const handleHeroTaglineChange = (lang, value) => {
    setForm(prev => ({
      ...prev,
      heroTagline: {
        ...prev.heroTagline,
        [lang]: value,
      },
    }));
  };

  // Add prep time option
  const addPrepTimeOption = () => {
    if (!newPrepValue || isNaN(Number(newPrepValue)) || Number(newPrepValue) <= 0) return;
    setForm(prev => ({
      ...prev,
      prepTimeOptions: [...(prev.prepTimeOptions || []), { value: Number(newPrepValue), unit: newPrepUnit }]
    }));
    setNewPrepValue('');
  };
  // Remove prep time option
  const removePrepTimeOption = (idx) => {
    setForm(prev => ({
      ...prev,
      prepTimeOptions: prev.prepTimeOptions.filter((_, i) => i !== idx)
    }));
  };

  // Add delivery city
  const addDeliveryCity = () => {
    const trimmedHe = newCity.he.trim();
    const trimmedAr = newCity.ar.trim();
    const deliveryFee = newCity.deliveryFee.trim();
    
    // Both language fields are required
    if (!trimmedHe || !trimmedAr) {
      alert('יש למלא את שם העיר בשתי השפות');
      return;
    }
    
    if (deliveryFee === '' || isNaN(Number(deliveryFee)) || Number(deliveryFee) < 0) {
      alert('יש להזין דמי משלוח לעיר (מספר ≥ 0)');
      return;
    }
    
    // Check if city already exists (case-insensitive, check both languages)
    const cityExists = (form.deliveryCities || []).some(
      city => {
        const existingHe = typeof city === 'string' ? city : city.he;
        const existingAr = typeof city === 'string' ? '' : city.ar;
        return existingHe.toLowerCase() === trimmedHe.toLowerCase() || 
               existingAr.toLowerCase() === trimmedAr.toLowerCase();
      }
    );
    
    if (cityExists) {
      alert('העיר כבר קיימת ברשימה');
      return;
    }
    
    const cityData = {
      he: trimmedHe,
      ar: trimmedAr,
      deliveryFee: Number(deliveryFee),
    };
    
    setForm(prev => ({
      ...prev,
      deliveryCities: [...(prev.deliveryCities || []), cityData]
    }));
    setNewCity({ he: '', ar: '', deliveryFee: '' });
  };

  // Remove delivery city
  const removeDeliveryCity = (idx) => {
    setForm(prev => ({
      ...prev,
      deliveryCities: prev.deliveryCities.filter((_, i) => i !== idx)
    }));
  };

  // Edit delivery city - populate form with existing city data
  const startEditingCity = (idx) => {
    const city = form.deliveryCities[idx];
    const cityHe = typeof city === 'string' ? city : city.he;
    const cityAr = typeof city === 'string' ? '' : city.ar;
    const cityDeliveryFee = typeof city === 'string' ? '' : (city.deliveryFee || '');
    
    setNewCity({
      he: cityHe,
      ar: cityAr,
      deliveryFee: cityDeliveryFee.toString()
    });
    setEditingCityIndex(idx);
  };

  // Update existing city
  const updateDeliveryCity = () => {
    if (editingCityIndex === null) return;
    
    const trimmedHe = newCity.he.trim();
    const trimmedAr = newCity.ar.trim();
    const deliveryFee = newCity.deliveryFee.trim();
    
    // Both language fields are required
    if (!trimmedHe || !trimmedAr) {
      alert('יש למלא את שם העיר בשתי השפות');
      return;
    }
    
    if (deliveryFee === '' || isNaN(Number(deliveryFee)) || Number(deliveryFee) < 0) {
      alert('יש להזין דמי משלוח לעיר (מספר ≥ 0)');
      return;
    }
    
    // Check if city already exists (excluding the one being edited)
    const cityExists = (form.deliveryCities || []).some(
      (city, idx) => {
        if (idx === editingCityIndex) return false; // Skip the city being edited
        const existingHe = typeof city === 'string' ? city : city.he;
        const existingAr = typeof city === 'string' ? '' : city.ar;
        return existingHe.toLowerCase() === trimmedHe.toLowerCase() || 
               existingAr.toLowerCase() === trimmedAr.toLowerCase();
      }
    );
    
    if (cityExists) {
      alert('העיר כבר קיימת ברשימה');
      return;
    }
    
    const cityData = {
      he: trimmedHe,
      ar: trimmedAr,
      deliveryFee: Number(deliveryFee),
    };
    
    setForm(prev => ({
      ...prev,
      deliveryCities: prev.deliveryCities.map((city, idx) => 
        idx === editingCityIndex ? cityData : city
      )
    }));
    
    // Reset form
    setNewCity({ he: '', ar: '', deliveryFee: '' });
    setEditingCityIndex(null);
  };

  // Cancel editing
  const cancelEditingCity = () => {
    setNewCity({ he: '', ar: '', deliveryFee: '' });
    setEditingCityIndex(null);
  };

  // Auto-save features to Firebase
  const saveFeatureToFirebase = async (features) => {
    try {
      console.log('🔄 Auto-saving features to Firebase:', features);
      const ref = doc(db, 'menus', activeBusinessId);
      await updateDoc(ref, {
        'config.features': features,
      });
      console.log('✅ Features auto-saved successfully!');
    } catch (error) {
      console.error('❌ Error auto-saving features:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const ref = doc(db, 'menus', activeBusinessId);
    try {
      console.log('=== SAVE OPERATION START ===');
      console.log('Active Business ID:', activeBusinessId);
      console.log('Current form features:', form.features);
      console.log('About to save to Firebase path: menus/' + activeBusinessId);
      
      const updateData = {
        'config.deliveryFee': deleteField(),
        'config.isOpen': form.isOpen,
        'config.workingHours': serializeWorkingHours(form.workingHours),
        'config.contact': form.contact,
        'config.prepTimeOptions': form.prepTimeOptions,
        'config.deliveryCities': form.deliveryCities,
        'config.storeStatusMode': form.storeStatusMode,
        // Capacity UI removed; keep 0 so menu-app dine-in logic does not block on stale values
        'config.tablesCapacity': 0,
        'config.features': form.features,
        'config.heroTagline': form.heroTagline,
        'config.loyalty': {
          enabled: !!form.loyalty.enabled,
          currencyPerPoint: Number(form.loyalty.currencyPerPoint) || DEFAULT_LOYALTY.currencyPerPoint,
          redeemValuePerPoint: Number(form.loyalty.redeemValuePerPoint) || DEFAULT_LOYALTY.redeemValuePerPoint
        },
        'config.referral': {
          referrerAmount: Number(form.referral.referrerAmount) || DEFAULT_REFERRAL.referrerAmount,
          refereeAmount: Number(form.referral.refereeAmount) || DEFAULT_REFERRAL.refereeAmount,
          appLink: typeof form.referral.appLink === 'string' ? form.referral.appLink.trim() : DEFAULT_REFERRAL.appLink
        }
      };
      
      console.log('Full update data being sent to Firebase:', updateData);
      console.log('Features object being saved:', updateData['config.features']);
      
      await updateDoc(ref, updateData);
      console.log('✅ Successfully saved to Firebase!');
      
      // Verify the save by reading back from Firebase
      console.log('Verifying save by reading back from Firebase...');
      const verifySnap = await getDoc(ref);
      if (verifySnap.exists()) {
        const verifyData = verifySnap.data();
        console.log('Verification - Features in Firebase after save:', verifyData.config?.features);
      }
      
      alert('✅ נשמר בהצלחה!');
    } catch (err) {
      console.error('❌ Error saving business settings:', err);
      console.error('Error details:', err.message);
      alert('❌ שגיאה בשמירה: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Coupon management functions (use activeBusinessId so Firestore rules match)
  const loadCoupons = async () => {
    if (!activeBusinessId) return;
    try {
      setCouponsLoading(true);
      const allCoupons = await getAllCoupons(null, activeBusinessId);
      setCoupons(allCoupons);
    } catch (error) {
      toast.error('שגיאה בטעינת הקופונים');
      console.error('Error loading coupons:', error);
    } finally {
      setCouponsLoading(false);
    }
  };

  const handleCreateCoupon = () => {
    setEditingCoupon(null);
    setShowCouponForm(true);
  };

  const handleEditCoupon = (coupon) => {
    setEditingCoupon(coupon);
    setShowCouponForm(true);
  };

  const handleDeleteCoupon = async (coupon) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הקופון "${coupon.code}"?`)) {
      try {
        await deleteCoupon(coupon.id, activeBusinessId);
        toast.success('הקופון נמחק בהצלחה!');
        loadCoupons();
      } catch (error) {
        toast.error('שגיאה במחיקת הקופון');
        console.error('Error deleting coupon:', error);
      }
    }
  };

  const handleToggleCouponStatus = async (coupon) => {
    try {
      const newStatus = !coupon.isActive;
      await updateCoupon(coupon.id, { isActive: newStatus }, activeBusinessId);
      toast.success(`הקופון ${newStatus ? 'הופעל' : 'בוטל'} בהצלחה!`);
      loadCoupons();
    } catch (error) {
      toast.error('שגיאה בשינוי סטטוס הקופון');
      console.error('Error toggling coupon status:', error);
    }
  };

  const handleCouponFormSave = () => {
    setShowCouponForm(false);
    setEditingCoupon(null);
    loadCoupons();
  };

  // Load coupons when coupon section is opened or business changes
  useEffect(() => {
    if (showCoupons && activeBusinessId) {
      loadCoupons();
    }
  }, [showCoupons, activeBusinessId]);

  // Notification management functions
  const loadUsers = async () => {
    try {
      // Load users from the global users collection (where push tokens are stored)
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      
      // Filter to only show customer users (not drivers) with phone numbers
      const usersData = usersSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => {
          // Must have a phone number (real customer)
          if (!user.phone || !user.phone.trim()) {
            return false;
          }
          
          // Check if user has any driver tokens - if so, exclude them
          if (user.pushTokens && Array.isArray(user.pushTokens)) {
            const hasDriverTokens = user.pushTokens.some(tokenObj => 
              tokenObj.active && tokenObj.appType === 'driver'
            );
            if (hasDriverTokens) {
              return false; // Exclude drivers
            }
          }
          
          // Include customer users
          return true;
        });
      
      console.log(`Loaded ${usersData.length} customer users (filtered out drivers and users without phone numbers)`);
      setAllUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('שגיאה בטעינת המשתמשים');
    }
  };

  const handleSendNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
      toast.error('אנא מלא את כל השדות הנדרשים');
      return;
    }

    if (notificationForm.title.length > 65) {
      toast.error('כותרת ההודעה ארוכה מדי (מקסימום 65 תווים)');
      return;
    }

    if (notificationForm.body.length > 240) {
      toast.error('גוף ההודעה ארוך מדי (מקסימום 240 תווים)');
      return;
    }

    if (notificationForm.targetAudience === 'specific' && notificationForm.selectedUsers.length === 0) {
      toast.error('אנא בחר לפחות משתמש אחד');
      return;
    }

    try {
      setSendingNotification(true);
      
      const targetUsers = notificationForm.targetAudience === 'all' ? 'all' : notificationForm.selectedUsers;
      console.log('[NOTIFICATION] Sending notification:', {
        title: notificationForm.title,
        body: notificationForm.body,
        targetAudience: notificationForm.targetAudience,
        targetUsers: targetUsers,
        allUsersCount: allUsers.length,
        selectedUsersCount: notificationForm.selectedUsers.length
      });
      
      const fnRegion = import.meta.env.VITE_FIREBASE_REGION || 'us-central1';
      const promoCallableName =
        import.meta.env.VITE_ADMIN_PROMO_CALLABLE || 'sendAdminPromotionalPush';
      const functions = getFunctions(firebaseApp, fnRegion);
      const sendPromoNotification = httpsCallable(functions, promoCallableName);
      
      const result = await sendPromoNotification({
        title: notificationForm.title,
        body: notificationForm.body,
        targetUsers: targetUsers,
        businessId: activeBusinessId
      });

      console.log('[NOTIFICATION] Result from Cloud Function:', result.data);
      if (result.data.expoErrorSummary?.length) {
        console.error('[NOTIFICATION] Expo push errors (from server):', result.data.expoErrorSummary);
      }
      
      // Always log debug info if available
      if (result.data.debug) {
        console.group('🔍 [NOTIFICATION] Debug Information:');
        console.log('📊 Total users processed:', result.data.debug.totalUsers);
        console.log('✅ Users with customer tokens:', result.data.debug.usersWithCustomerTokens);
        console.log('🚫 Users with driver tokens (excluded):', result.data.debug.usersWithDriverTokens);
        console.log('❌ Users with no tokens:', result.data.debug.usersWithNoTokens);
        console.log('📱 Customer tokens found:', result.data.debug.customerTokensFound);
        console.log('🚗 Driver tokens found (excluded):', result.data.debug.driverTokensFound);
        if (result.data.debug.chunksSent) {
          console.log('📦 Chunks sent:', result.data.debug.chunksSent);
        }
        console.groupEnd();
      }
      
      if (result.data.sentTo === 0) {
        console.warn('[NOTIFICATION] ⚠️ No users received notification.');
        if (result.data.debug) {
          if (result.data.debug.usersWithNoTokens === result.data.debug.totalUsers) {
            console.error('❌ All users have no tokens! Users need to enable push notifications in the app.');
          } else if (result.data.debug.usersWithDriverTokens === result.data.debug.totalUsers) {
            console.error('❌ All users are drivers! No customer users found.');
          } else if (result.data.debug.customerTokensFound === 0) {
            console.error('❌ No customer tokens found even though some users should have them. Check token format.');
          }
        }
        const expoHint =
          result.data.expoErrorSummary?.length > 0
            ? ` (${result.data.expoErrorSummary.slice(0, 2).join(' · ')})`
            : '';
        toast.error(
          `ההודעה נשלחה אבל לא הגיעה לאף משתמש (0 משתמשים). בדוק את הקונסול לפרטים.${expoHint}`,
          { duration: 8000, icon: '⚠️' }
        );
      } else {
        toast.success(`הודעה נשלחה בהצלחה ל-${result.data.sentTo} משתמשים!`);
      }
      
      // Reset form
      setNotificationForm({
        title: '',
        body: '',
        targetAudience: 'all',
        selectedUsers: []
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('שגיאה בשליחת ההודעה: ' + (error.message || 'שגיאה לא ידועה'));
    } finally {
      setSendingNotification(false);
    }
  };

  // Load users when notification section is opened
  useEffect(() => {
    if (showNotifications && allUsers.length === 0) {
      loadUsers();
    }
  }, [showNotifications]);

  // Load drivers when driver zones section is opened
  const loadDrivers = async () => {
    if (!activeBusinessId) return;
    setDriversLoading(true);
    try {
      const driversRef = collection(db, 'menus', activeBusinessId, 'users');
      const driversSnapshot = await getDocs(query(driversRef, where('role', '==', 'driver')));
      
      const driversData = driversSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        allowedDeliveryCities: doc.data().allowedDeliveryCities || []
      }));
      
      setDrivers(driversData);
    } catch (error) {
      console.error('Error loading drivers:', error);
      toast.error('שגיאה בטעינת הנהגים');
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  };

  // Update driver's allowed delivery cities
  const updateDriverZones = async (driverId, allowedCities) => {
    if (!activeBusinessId) return;
    try {
      const driverRef = doc(db, 'menus', activeBusinessId, 'users', driverId);
      await updateDoc(driverRef, {
        allowedDeliveryCities: allowedCities
      });
      toast.success('אזורי המשלוח עודכנו בהצלחה!');
      // Refresh drivers list
      loadDrivers();
    } catch (error) {
      console.error('Error updating driver zones:', error);
      toast.error('שגיאה בעדכון אזורי המשלוח');
    }
  };

  // Toggle city for driver
  const toggleDriverCity = (driverId, cityObj) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    
    const currentCities = driver.allowedDeliveryCities || [];
    
    // Check if city is already in allowed list
    const cityExists = currentCities.some(c => {
      const cHe = typeof c === 'string' ? c : c.he;
      const cAr = typeof c === 'string' ? '' : c.ar;
      const cityHe = cityObj.he;
      const cityAr = cityObj.ar;
      
      return (
        (cHe && cityHe && cHe.toLowerCase() === cityHe.toLowerCase()) ||
        (cAr && cityAr && cAr.toLowerCase() === cityAr.toLowerCase())
      );
    });
    
    let newCities;
    if (cityExists) {
      // Remove city
      newCities = currentCities.filter(c => {
        const cHe = typeof c === 'string' ? c : c.he;
        const cAr = typeof c === 'string' ? '' : c.ar;
        const cityHe = cityObj.he;
        const cityAr = cityObj.ar;
        
        return !(
          (cHe && cityHe && cHe.toLowerCase() === cityHe.toLowerCase()) ||
          (cAr && cityAr && cAr.toLowerCase() === cityAr.toLowerCase())
        );
      });
    } else {
      // Add city
      newCities = [...currentCities, cityObj];
    }
    
    updateDriverZones(driverId, newCities);
  };

  // Load drivers when driver zones section is opened
  useEffect(() => {
    if (showDriverZones && drivers.length === 0 && !driversLoading) {
      loadDrivers();
    }
  }, [showDriverZones]);

  if (loading) return <p>טוען...</p>;

  return (
    <div style={{ margin: '10px auto', padding: 20, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #e0e0e0', display: 'flex', flexDirection: 'column', gap: 15 }}>
      {/* Modern compact upper section */}
      <div
        style={{
          background: '#f7f8fa',
          borderRadius: 16,
          boxShadow: '0 1px 4px #f0f0f0',
          marginBottom: 8,
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          direction: 'rtl',
        }}
      >
        {/* Row 1: Store status + weekly off days (multi-select dropdown) */}
        <div className="business-settings-row" style={{ marginBottom: 12 }}>
          <div style={{ flex: '1 1 calc(50% - 6px)', minWidth: 'calc(50% - 6px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Store Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, minHeight: '20px', display: 'flex', alignItems: 'center' }}>حالة المتجر</label>
              <select
                name="storeStatusMode"
                value={form.storeStatusMode}
                onChange={handleChange}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid #e0e0e0',
                  fontSize: 16,
                  background: '#fff',
                  textAlign: 'right',
                  boxSizing: 'border-box',
                  width: '100%',
                  padding: '0 12px',
                }}
              >
                <option value="auto">تلقائي (حسب ساعات العمل)</option>
                <option value="open">مفتوح الآن</option>
                <option value="busy">مشغول حالياً</option>
                <option value="closed">مغلق الآن</option>
              </select>
            </div>
          </div>
          <div className="business-settings-field off-days-dropdown-wrap" style={{ flex: '1 1 calc(50% - 6px)', minWidth: 'calc(50% - 6px)', position: 'relative' }}>
            {!form.workingHours.perDayEnabled ? (
              <>
                <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, minHeight: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>أيام الإجازة</span>
                </label>
                <details className="off-days-dropdown">
                  <summary>
                    {(form.workingHours.offDays || []).length === 0
                      ? 'مفتوح كل الأسبوع'
                      : (form.workingHours.offDays || [])
                          .map((k) => OFF_DAY_WEEKDAYS.find((d) => d.key === k))
                          .filter(Boolean)
                          .map((d) => d.label)
                          .join('، ')}
                  </summary>
                  <div className="off-days-dropdown-panel">
                    <span style={{ fontSize: 12, color: '#777', display: 'block', marginBottom: 8, lineHeight: 1.45 }}>
                      <span style={{ display: 'block' }} dir="rtl">
                        اختر أيام العطلة للمحل.
                      </span>
                    </span>
                    {OFF_DAY_WEEKDAYS.map(({ key, label }) => {
                      const checked = (form.workingHours.offDays || []).includes(key);
                      return (
                        <label
                          key={key}
                          className="off-days-dropdown-row"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOffDay(key)}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: '#999',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 44,
                  marginTop: 24,
                }}
                dir="rtl"
              >
                أيام الإجازة تُحدّد لكل يوم في الجدول (مغلق).
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Opening Hours — single schedule or per-day */}
        <div style={{ marginBottom: 12, width: '100%' }}>
          <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 8, minHeight: '20px', display: 'flex', alignItems: 'center' }}>ساعات العمل</label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              cursor: 'pointer',
              fontSize: 14,
              color: '#333',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={!!form.workingHours.perDayEnabled}
              onChange={(e) => togglePerDayEnabled(e.target.checked)}
            />
            <span dir="rtl">عندي ساعات عمل غير بأيام ثانيه</span>
          </label>

          {!form.workingHours.perDayEnabled ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, minHeight: '20px', display: 'flex', alignItems: 'center' }}>שעת סגירה</label>
                <input
                  type="time"
                  name="close"
                  dir="ltr"
                  value={form.workingHours.close}
                  onChange={handleChange}
                  style={{
                    height: 44,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: '1px solid #e0e0e0',
                    fontSize: 16,
                    background: '#fff',
                    direction: 'ltr',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, minHeight: '20px', display: 'flex', alignItems: 'center' }}>שעת פתיחה</label>
                <input
                  type="time"
                  name="open"
                  dir="ltr"
                  value={form.workingHours.open}
                  onChange={handleChange}
                  style={{
                    height: 44,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: '1px solid #e0e0e0',
                    fontSize: 16,
                    background: '#fff',
                    direction: 'ltr',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowPerDayHoursEditor((v) => !v)}
                style={{
                  width: '100%',
                  border: '1px solid #e7e7e7',
                  borderRadius: 12,
                  background: '#fff',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span dir="rtl" style={{ fontSize: 13, color: '#666' }}>
                  {`مفتوح ${perDayOpenCount} أيام • مغلق ${perDayClosedCount} أيام`}
                </span>
                <span style={{ color: '#007bff', fontWeight: 600, fontSize: 14 }}>
                  {showPerDayHoursEditor ? 'إخفاء التفاصيل ▲' : 'تعديل التفاصيل ▼'}
                </span>
              </button>

              {showPerDayHoursEditor && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {OFF_DAY_WEEKDAYS.map(({ key, label }) => {
                    const row = form.workingHours.byDay?.[key] || emptyDayRow();
                    const closed = !!row.closed;
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid #e8e8e8',
                          background: '#fafafa',
                        }}
                      >
                        <span style={{ minWidth: 72, fontWeight: 600, fontSize: 14 }}>{label}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={closed}
                            onChange={() => togglePerDayClosed(key)}
                          />
                          <span dir="rtl">مغلق</span>
                        </label>
                        <input
                          type="time"
                          dir="ltr"
                          disabled={closed}
                          value={row.open || ''}
                          onChange={(e) => updateByDay(key, 'open', e.target.value)}
                          style={{
                            height: 40,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid #e0e0e0',
                            fontSize: 15,
                            opacity: closed ? 0.5 : 1,
                            flex: '1 1 100px',
                            maxWidth: 140,
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#888' }}>—</span>
                        <input
                          type="time"
                          dir="ltr"
                          disabled={closed}
                          value={row.close || ''}
                          onChange={(e) => updateByDay(key, 'close', e.target.value)}
                          style={{
                            height: 40,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid #e0e0e0',
                            fontSize: 15,
                            opacity: closed ? 0.5 : 1,
                            flex: '1 1 100px',
                            maxWidth: 140,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hero tagline inputs */}
        <div style={{ marginTop: 16, width: '100%', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowHeroTagline(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 6,
              padding: 0,
            }}
          >
            כותרת פתיחה באפליקציה
            <span style={{ fontSize: 16 }}>{showHeroTagline ? '▲' : '▼'}</span>
          </button>
          {showHeroTagline && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#777', lineHeight: 1.4 }}>
              המשפט שיופיע מעל הקטגוריות בהתחלה.
              </span>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, color: '#444' }}>
                  🇮🇱 עברית
                  <input
                    type="text"
                    value={form.heroTagline.he || ''}
                    onChange={(e) => handleHeroTaglineChange('he', e.target.value)}
                    placeholder="מה בא לך לאכול היום?"
                    style={{
                      height: 40,
                      borderRadius: 8,
                      border: '1px solid #e0e0e0',
                      padding: '0 12px',
                      fontSize: 15,
                      textAlign: 'right',
                      direction: 'rtl',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, color: '#444' }}>
                  🇵🇸 عربي
                  <input
                    type="text"
                    value={form.heroTagline.ar || ''}
                    onChange={(e) => handleHeroTaglineChange('ar', e.target.value)}
                    placeholder="ايش جاي عبالك تاكل اليوم؟"
                    style={{
                      height: 40,
                      borderRadius: 8,
                      border: '1px solid #e0e0e0',
                      padding: '0 12px',
                      fontSize: 15,
                      textAlign: 'right',
                      direction: 'rtl',
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Delivery Cities Section - Collapsible */}
        <div style={{ marginTop: 18, width: '100%', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowDeliveryCities(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 6,
              padding: 0
            }}
          >
            ערים למשלוח (דו-לשוני)
            <span style={{ fontSize: 16 }}>{showDeliveryCities ? '▲' : '▼'}</span>
          </button>
          {showDeliveryCities && (
            <>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6, marginRight: 2 }}>
            הוסף ערים שאליהן ניתן לשלוח. לכל עיר חובה להגדיר דמי משלוח (לכל עיר בנפרד — אין עוד דמי ברירת מחדל גלובליים).
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0', width: '100%', justifyContent: 'flex-start', alignItems: 'center', rowGap: 10, minHeight: 40
          }}>
            {(form.deliveryCities || []).length === 0 ? (
              <span style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>לא הוגדרו ערים עדיין</span>
            ) : (
              (form.deliveryCities || []).map((city, idx) => {
                const cityHe = typeof city === 'string' ? city : city.he;
                const cityAr = typeof city === 'string' ? '' : city.ar;
                const cityDeliveryFee = typeof city === 'string' ? null : city.deliveryFee;
                return (
                  <span 
                    key={idx} 
                    onClick={() => startEditingCity(idx)}
                    style={{ 
                      background: editingCityIndex === idx 
                        ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                      color: '#fff',
                      borderRadius: 8, 
                      padding: '6px 8px', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14, 
                      fontWeight: 500,
                      minWidth: 70, 
                      margin: '0 2px',
                      boxShadow: editingCityIndex === idx 
                        ? '0 4px 12px rgba(245, 87, 108, 0.5)' 
                        : '0 2px 8px rgba(102, 126, 234, 0.3)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: editingCityIndex === idx ? 'scale(1.05)' : 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      if (editingCityIndex !== idx) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (editingCityIndex !== idx) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                      }
                    }}
                  >
                    {/* Delivery fee at top-left corner */}
                    {cityDeliveryFee !== null && cityDeliveryFee !== undefined && (
                      <span style={{ 
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontSize: 10, 
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.25)',
                        padding: '2px 5px',
                        borderRadius: 4,
                        lineHeight: 1
                      }}>
                        ₪{cityDeliveryFee}
                      </span>
                    )}
                    
                    {/* Delete button at top-right corner */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDeliveryCity(idx);
                      }} 
                      style={{ 
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        background: 'rgba(255,255,255,0.25)', 
                        border: 'none', 
                        color: '#fff', 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        fontSize: 10, 
                        lineHeight: 1,
                        width: 14,
                        height: 14,
                        minWidth: 14,
                        minHeight: 14,
                        maxWidth: 14,
                        maxHeight: 14,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        padding: 0,
                        zIndex: 10,
                        boxSizing: 'border-box',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.4)';
                        e.target.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.25)';
                        e.target.style.transform = 'scale(1)';
                      }}
                    >×</button>
                    
                    {/* City names centered */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 2, 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      paddingTop: cityDeliveryFee ? 8 : 4,
                      paddingRight: 4,
                      paddingLeft: 4,
                      paddingBottom: 2,
                      minHeight: 40
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, direction: 'rtl', textAlign: 'center', lineHeight: 1.2 }}>{cityHe}</span>
                      {cityAr && <span style={{ fontSize: 11, opacity: 0.9, direction: 'rtl', textAlign: 'center', lineHeight: 1.2 }}>{cityAr}</span>}
                    </div>
                  </span>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, width: '100%', paddingRight: 2, paddingLeft: 2 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={newCity.he}
                onChange={e => setNewCity(prev => ({ ...prev, he: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCity.he.trim() && newCity.ar.trim()) {
                      editingCityIndex !== null ? updateDeliveryCity() : addDeliveryCity();
                    }
                  }
                }}
                placeholder="שם העיר בעברית (למשל: חיפה)"
                style={{ 
                  flex: 1,
                  height: 44, 
                  padding: '0 12px', 
                  borderRadius: 10, 
                  border: '1px solid #e0e0e0', 
                  fontSize: 15, 
                  background: '#fff', 
                  textAlign: 'right', 
                  boxSizing: 'border-box',
                  direction: 'rtl'
                }}
              />
              <span style={{ fontSize: 12, color: '#888', fontWeight: 600, minWidth: 20 }}>🇮🇱</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={newCity.ar}
                onChange={e => setNewCity(prev => ({ ...prev, ar: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCity.he.trim() && newCity.ar.trim()) {
                      editingCityIndex !== null ? updateDeliveryCity() : addDeliveryCity();
                    }
                  }
                }}
                placeholder="اسم المدينة بالعربية (مثلاً: حيفا)"
                style={{ 
                  flex: 1,
                  height: 44, 
                  padding: '0 12px', 
                  borderRadius: 10, 
                  border: '1px solid #e0e0e0', 
                  fontSize: 15, 
                  background: '#fff', 
                  textAlign: 'right', 
                  boxSizing: 'border-box',
                  direction: 'rtl'
                }}
              />
              <span style={{ fontSize: 12, color: '#888', fontWeight: 600, minWidth: 20 }}>🇵🇸</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                value={newCity.deliveryFee}
                onChange={e => setNewCity(prev => ({ ...prev, deliveryFee: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newCity.he.trim() && newCity.ar.trim()) {
                      editingCityIndex !== null ? updateDeliveryCity() : addDeliveryCity();
                    }
                  }
                }}
                placeholder="דמי משלוח לעיר (חובה, ₪)"
                min="0"
                step="0.5"
                style={{ 
                  flex: 1,
                  height: 44, 
                  padding: '0 12px', 
                  borderRadius: 10, 
                  border: '1px solid #e0e0e0', 
                  fontSize: 15, 
                  background: '#fff', 
                  textAlign: 'right', 
                  boxSizing: 'border-box',
                  direction: 'rtl'
                }}
              />
              <span style={{ fontSize: 12, color: '#888', fontWeight: 600, minWidth: 20 }}>🚚</span>
            </div>
            {editingCityIndex !== null && (
              <div style={{ 
                background: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: 8, 
                padding: '8px 12px', 
                marginBottom: 8,
                fontSize: 13,
                color: '#856404',
                textAlign: 'center',
                fontWeight: 600
              }}>
                ✏️ עריכת עיר - לחץ "עדכן" לשמירה או "ביטול" לביטול
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={editingCityIndex !== null ? updateDeliveryCity : addDeliveryCity}
                disabled={!newCity.he.trim() || !newCity.ar.trim() || newCity.deliveryFee.trim() === '' || isNaN(Number(newCity.deliveryFee)) || Number(newCity.deliveryFee) < 0 || (editingCityIndex === null && (form.deliveryCities || []).length >= 20)}
                style={{ 
                  flex: editingCityIndex !== null ? 1 : 'auto',
                  width: editingCityIndex !== null ? 'auto' : '100%',
                  height: 44, 
                  borderRadius: 10, 
                  background: (!newCity.he.trim() || !newCity.ar.trim() || newCity.deliveryFee.trim() === '' || isNaN(Number(newCity.deliveryFee)) || Number(newCity.deliveryFee) < 0 || (editingCityIndex === null && (form.deliveryCities || []).length >= 20)) 
                    ? '#ccc' 
                    : (editingCityIndex !== null ? '#f5576c' : '#667eea'), 
                  color: '#fff', 
                  border: 'none', 
                  fontWeight: 600, 
                  fontSize: 16, 
                  cursor: (!newCity.he.trim() || !newCity.ar.trim() || newCity.deliveryFee.trim() === '' || isNaN(Number(newCity.deliveryFee)) || Number(newCity.deliveryFee) < 0 || (editingCityIndex === null && (form.deliveryCities || []).length >= 20)) ? 'not-allowed' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: (!newCity.he.trim() || !newCity.ar.trim() || newCity.deliveryFee.trim() === '' || isNaN(Number(newCity.deliveryFee)) || Number(newCity.deliveryFee) < 0 || (editingCityIndex === null && (form.deliveryCities || []).length >= 20))
                    ? 'none' 
                    : (editingCityIndex !== null ? '0 2px 8px rgba(245, 87, 108, 0.3)' : '0 2px 8px rgba(102, 126, 234, 0.3)')
                }}
              >
                {editingCityIndex !== null ? '✓ עדכן עיר' : 'הוסף עיר'}
              </button>
              {editingCityIndex !== null && (
                <button
                  onClick={cancelEditingCity}
                  style={{ 
                    flex: 1,
                    height: 44, 
                    borderRadius: 10, 
                    background: '#6c757d', 
                    color: '#fff', 
                    border: 'none', 
                    fontWeight: 600, 
                    fontSize: 16, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(108, 117, 125, 0.3)'
                  }}
                >
                  ✕ ביטול
                </button>
              )}
            </div>
          </div>
          {(form.deliveryCities || []).length >= 20 && (
            <div style={{ color: '#e00', fontSize: 13, marginTop: 4, textAlign: 'center' }}>מקסימום 20 ערים</div>
          )}
            </>
          )}
        </div>
        
        {/* Features/Delivery Methods Section */}
        <div style={{ marginTop: 16, width: '100%', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowFeatures(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 6,
              padding: 0,
            }}
          >
            אפשרויות הזמנה זמינות
            <span style={{ fontSize: 16 }}>{showFeatures ? '▲' : '▼'}</span>
          </button>
          {showFeatures && (
            <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 10, lineHeight: 1.4 }}>
                בחר אילו אפשרויות הזמנה יהיו זמינות ללקוחות שלך
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="feature_enablePickup"
                    checked={form.features.enablePickup}
                    onChange={handleChange}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                    איסוף עצמי
                  </span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="feature_enableDelivery"
                    checked={form.features.enableDelivery}
                    onChange={handleChange}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                    משלוח
                  </span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="feature_enableEatIn"
                    checked={form.features.enableEatIn}
                    onChange={handleChange}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                    אכילה במקום
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Loyalty & Referral configuration - Collapsible */}
        <div style={{ marginTop: 16, width: '100%', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowLoyaltyReferral(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 6,
              padding: 0
            }}
          >
            תוכנית נקודות ותוכנית שותפים
            <span style={{ fontSize: 16 }}>{showLoyaltyReferral ? '▲' : '▼'}</span>
          </button>
          {showLoyaltyReferral && (
            <>
              {/* Loyalty configuration */}
              <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginBottom: 8, display: 'block' }}>
                  תוכנית נקודות ללקוחות
                </label>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 10, lineHeight: 1.4 }}>
                  שלוט בכמה נקודות הלקוחות צוברים וכמה הן שוות. השינויים מתעדכנים באפליקציה מידית.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={!!form.loyalty.enabled}
                      onChange={(e) => handleLoyaltyChange('enabled', e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    הפעל תוכנית נקודות
                  </label>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>₪ לצבירת נקודה</span>
                      <input
                        type="number"
                        min={1}
                        value={form.loyalty.currencyPerPoint}
                        onChange={(e) => handleLoyaltyChange('currencyPerPoint', e.target.value)}
                        disabled={!form.loyalty.enabled}
                        style={{
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid #e0e0e0',
                          fontSize: 16,
                          background: form.loyalty.enabled ? '#fff' : '#f5f5f5',
                          textAlign: 'right',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>₪ ערך נקודה בהחזר</span>
                      <input
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={form.loyalty.redeemValuePerPoint}
                        onChange={(e) => handleLoyaltyChange('redeemValuePerPoint', e.target.value)}
                        disabled={!form.loyalty.enabled}
                        style={{
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid #e0e0e0',
                          fontSize: 16,
                          background: form.loyalty.enabled ? '#fff' : '#f5f5f5',
                          textAlign: 'right',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
                    לדוגמה: אם ההגדרה היא 100 ₪ = 1 נקודה ושווי נקודה הוא 1 ₪, אז על כל 100 ₪ המשתמש צובר נקודה אחת ויכול להשתמש בה כשקל אחד בהנחה.
                  </div>
                </div>
              </div>

              {/* Referral configuration */}
              <div style={{ marginTop: 16, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginBottom: 8, display: 'block' }}>
                  תוכנית שותפים (Referral Program)
                </label>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 10, lineHeight: 1.4 }}>
                  שלוט בסכומי התגמול הקבועים למשתפים ולמשתמשים החדשים שהם מביאים. התגמול הוא סכום קבוע ולא תלוי בגובה ההזמנה.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>תגמול למשתף (₪)</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={form.referral.referrerAmount || form.referral.referrerPercentage || DEFAULT_REFERRAL.referrerAmount}
                        onChange={(e) => handleReferralChange('referrerAmount', e.target.value)}
                        style={{
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid #e0e0e0',
                          fontSize: 16,
                          background: '#fff',
                          textAlign: 'right',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                        סכום קבוע שהמשתף יקבל כנקודות
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>תגמול למשתמש חדש (₪)</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={form.referral.refereeAmount || form.referral.refereePercentage || DEFAULT_REFERRAL.refereeAmount}
                        onChange={(e) => handleReferralChange('refereeAmount', e.target.value)}
                        style={{
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid #e0e0e0',
                          fontSize: 16,
                          background: '#fff',
                          textAlign: 'right',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                        סכום קבוע שהמשתמש החדש יקבל כנקודות
                      </div>
                    </div>
                  </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>קישור אפליקציה לשיתוף</span>
                      <input
                        type="url"
                        value={form.referral.appLink || DEFAULT_REFERRAL.appLink}
                        onChange={(e) => handleReferralChange('appLink', e.target.value)}
                        placeholder="https://your-app-link.example"
                        style={{
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 10,
                          border: '1px solid #e0e0e0',
                          fontSize: 15,
                          background: '#fff',
                          textAlign: 'left',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                        הקישור שיופיע בהודעת השיתוף של קוד ההפניה באפליקציית הלקוח.
                      </div>
                    </div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
                    💡 <strong>דוגמה:</strong> אם ההגדרות הן 20 ₪ למשתף ו-10 ₪ למשתמש חדש, אז המשתף יקבל 20 ₪ נקודות והמשתמש החדש יקבל 10 ₪ נקודות, ללא תלות בגובה ההזמנה.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Prep time options row - moved to last row, styled */}
        <div style={{ marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={() => setShowPrepTimeOptions(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              fontWeight: 600,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 8,
              gap: 6,
              padding: 0,
            }}
          >
            אפשריות זמני הכנה להזמנות
            <span style={{ fontSize: 18 }}>{showPrepTimeOptions ? '▲' : '▼'}</span>
          </button>

          {showPrepTimeOptions && (
            <>
              <label style={{ fontSize: 13, color: '#888', fontWeight: 500, marginRight: 2, marginBottom: 2, display: 'block' }}>אפשרויות זמן הכנה</label>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, marginRight: 2 }}>
                הוסף כל אפשרות שתרצה לקביעת זמן הכנת הזמנה, אחת בכל פעם. נתן דקות, שעות, וימים. תוכל להסיר אפשרות בלחיצה על ×.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, width: '100%', justifyContent: 'space-between', paddingRight: 2, paddingLeft: 2 }}>
                <input
                  type="number"
                  min={1}
                  value={newPrepValue}
                  onChange={e => setNewPrepValue(e.target.value)}
                  placeholder="מספר"
                  style={{ width: '90px', height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 16, background: '#fff', textAlign: 'right', boxSizing: 'border-box' }}
                />
                <select value={newPrepUnit} onChange={e => setNewPrepUnit(e.target.value)} style={{ width: '100px', height: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 16, background: '#fff', textAlign: 'right', boxSizing: 'border-box' }}>
                  <option value="minutes">דקות</option>
                  <option value="hours">שעות</option>
                  <option value="days">ימים</option>
                </select>
                <button
                  onClick={addPrepTimeOption}
                  disabled={
                    !newPrepValue ||
                    isNaN(Number(newPrepValue)) ||
                    Number(newPrepValue) <= 0 ||
                    (form.prepTimeOptions || []).some(opt => opt.value === Number(newPrepValue) && opt.unit === newPrepUnit) ||
                    (form.prepTimeOptions || []).length >= 6
                  }
                  style={{ width: '90px', height: 44, borderRadius: 10, background: '#007aff', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!newPrepValue || isNaN(Number(newPrepValue)) || Number(newPrepValue) <= 0 || (form.prepTimeOptions || []).some(opt => opt.value === Number(newPrepValue) && opt.unit === newPrepUnit) || (form.prepTimeOptions || []).length >= 6) ? 0.5 : 1 }}
                >הוסף</button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12,
                margin: '12px 0 8px',
                width: '100%',
                alignItems: 'stretch'
              }}>
                {(form.prepTimeOptions || []).map((opt, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#e0e0e0',
                      borderRadius: 10,
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 13,
                      justifyContent: 'space-between',
                      minHeight: 44,
                      boxSizing: 'border-box',
                    }}
                  >
                    {opt.value} {opt.unit === 'minutes' ? 'דקות' : opt.unit === 'hours' ? 'שעה' : 'יום'}
                    <button onClick={() => removePrepTimeOption(idx)} style={{ marginRight: 6, background: 'none', border: 'none', color: '#e00', fontWeight: 700, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              {(form.prepTimeOptions || []).length >= 6 && (
                <div style={{ color: '#e00', fontSize: 13, marginTop: 4, textAlign: 'center' }}>מקסימום 6 אפשרויות</div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Contact info section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowContact(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 6,
          }}
        >
          {showContact ? 'הסתר פרטי יצירת קשר' : 'הצג פרטי יצירת קשר'}
          <span style={{ fontSize: 18 }}>{showContact ? '▲' : '▼'}</span>
        </button>
        {showContact && (
          <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אינסטגרם:
            <input
              type="text"
              name="instagram"
              value={form.contact.instagram}
              onChange={handleChange}
              placeholder="@yourbusiness"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            טלפון:
            <input
              type="text"
              name="phone"
              value={form.contact.phone}
              onChange={handleChange}
              placeholder="04-000-0000"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אתר אינטרנט:
            <input
              type="text"
              name="website"
              value={form.contact.website}
              onChange={handleChange}
              placeholder="https://yourwebsite.com"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            Waze:
            <input
              type="text"
              name="waze"
              value={form.contact.waze}
              onChange={handleChange}
              placeholder="https://waze.com/ul/... או קואורדינטות: 32.0853,34.7818"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            <span style={{ color: '#d32f2f', fontWeight: 600 }}>⭐</span> קואורדינטות מדויקות (Latitude, Longitude):
            <input
              type="text"
              name="coordinates"
              value={form.contact.coordinates}
              onChange={handleChange}
              placeholder="32.0853,34.7818"
              style={{ 
                width: '100%', 
                padding: 10, 
                borderRadius: 8, 
                border: form.contact.coordinates ? '2px solid #4caf50' : '1px solid #bbb', 
                marginTop: 6, 
                fontSize: 16,
                backgroundColor: form.contact.coordinates ? '#f1f8f4' : '#fff'
              }}
            />
            <div style={{ fontSize: 11, color: form.contact.coordinates ? '#4caf50' : '#666', marginTop: 4, fontWeight: form.contact.coordinates ? 500 : 400 }}>
              {form.contact.coordinates ? (
                <>✅ קואורדינטות מוגדרות: {form.contact.coordinates} - זה יעזור להצגת המיקום במפה</>
              ) : (
                <>💡 הזן קואורדינטות מדויקות (lat,lng) למיקום המדויק של העסק. זה נדרש להצגת המיקום במפה. ניתן למצוא ב-Google Maps {'>'} לחץ על המיקום {'>'} העתק קואורדינטות</>
              )}
            </div>
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            כתובת לאיסוף (Pickup Address):
            <input
              type="text"
              name="businessAddress"
              value={form.contact.businessAddress || ''}
              onChange={handleChange}
              placeholder="بير الكسور شارع البير 10"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              הכתובת שמוצגת במסך התשלום באפשרות איסוף
            </div>
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            הערת איסוף (Pickup Note):
            <input
              type="text"
              name="pickupNote"
              value={form.contact.pickupNote || ''}
              onChange={handleChange}
              placeholder="جاهز للاستلام خلال 30 دقيقة."
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              טקסט משני שמוצג מתחת לכתובת האיסוף
            </div>
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            Google Maps:
            <input
              type="text"
              name="googleMapsUrl"
              value={form.contact.googleMapsUrl}
              onChange={handleChange}
              placeholder="https://maps.app.goo.gl/o3K3yXmw33nby6p27?g_st=ic"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              💡 הזן קישור Google Maps של העסק שלך. ניתן למצוא אותו ב-Google Maps {'>'} שתף {'>'} העתק קישור
            </div>
          </label>
          <label style={{ fontWeight: 500, color: '#444' }}>
            אימייל:
            <input
              type="email"
              name="email"
              value={form.contact.email}
              onChange={handleChange}
              placeholder="info@yourbusiness.com"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #bbb', marginTop: 6, fontSize: 16 }}
            />
          </label>
        </div>
          </>
        )}
      </div>

      {/* Coupon Management Section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowCoupons(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 6,
          }}
        >
          {showCoupons ? 'הסתר ניהול קופונים' : 'ניהול קופונים'}
          <span style={{ fontSize: 18 }}>{showCoupons ? '▲' : '▼'}</span>
        </button>
        
        {showCoupons && (
          <div style={{ marginTop: 16 }}>
            <Toaster position="top-center" />
            
            {/* Coupon filter buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { value: 'all', label: 'הכל' },
                { value: 'active', label: 'פעיל' },
                { value: 'inactive', label: 'לא פעיל' },
                { value: 'expired', label: 'פג תוקף' }
              ].map(filterOption => (
                <button
                  key={filterOption.value}
                  onClick={() => setCouponFilter(filterOption.value)}
                  style={{
                    background: couponFilter === filterOption.value ? '#007aff' : '#f0f0f0',
                    color: couponFilter === filterOption.value ? '#fff' : '#666',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>

            {/* Create coupon button */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button
                onClick={handleCreateCoupon}
                style={{
                  background: '#34C759',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <IoMdAdd size={16} />
                יצירת קופון חדש
              </button>
            </div>

            {/* Coupons list */}
            {couponsLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 14, color: '#666' }}>טוען...</div>
              </div>
            ) : coupons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 14, color: '#666' }}>אין קופונים</div>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {coupons
                  .filter(coupon => {
                    switch (couponFilter) {
                      case 'active':
                        return getCouponStatus(coupon) === COUPON_STATUS.ACTIVE;
                      case 'inactive':
                        return getCouponStatus(coupon) === COUPON_STATUS.INACTIVE;
                      case 'expired':
                        return isCouponExpired(coupon);
                      default:
                        return true;
                    }
                  })
                  .map(coupon => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      onEdit={handleEditCoupon}
                      onDelete={handleDeleteCoupon}
                      onToggleStatus={handleToggleCouponStatus}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Promotional Notifications Section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowNotifications(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 6,
          }}
        >
          <IoMdNotifications size={20} />
          {showNotifications ? 'הסתר שליחת הודעות' : 'שליחת הודעות ללקוחות 📢'}
          <span style={{ fontSize: 18 }}>{showNotifications ? '▲' : '▼'}</span>
        </button>
        
        {showNotifications && (
          <div style={{ marginTop: 16, padding: 16, background: '#f8f9fa', borderRadius: 12 }}>
            <Toaster position="top-center" />
            
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16, textAlign: 'right', lineHeight: 1.6 }}>
              שלח הודעות Push לכל הלקוחות או למשתמשים ספציפיים בלחיצת כפתור
            </div>

            {/* Notification Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Title Input */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#333', textAlign: 'right' }}>
                  כותרת ההודעה * ({notificationForm.title.length}/65)
                </label>
                <input
                  type="text"
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value.slice(0, 65) }))}
                  placeholder="עסקת השבוע! 🎉 | عرض الأسبوع!"
                  maxLength={65}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid ' + (notificationForm.title.length > 65 ? '#FF3B30' : '#e0e0e0'),
                    borderRadius: 8,
                    fontSize: 15,
                    background: '#fff',
                    textAlign: 'right',
                    boxSizing: 'border-box',
                    direction: 'rtl'
                  }}
                  required
                />
              </div>

              {/* Body Textarea */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#333', textAlign: 'right' }}>
                  גוף ההודעה * ({notificationForm.body.length}/240)
                </label>
                <textarea
                  value={notificationForm.body}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, body: e.target.value.slice(0, 240) }))}
                  placeholder="קבל 20% הנחה על כל המנות היום בלבד! | احصل على خصم 20% على جميع الأطباق اليوم فقط!"
                  rows={4}
                  maxLength={240}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid ' + (notificationForm.body.length > 240 ? '#FF3B30' : '#e0e0e0'),
                    borderRadius: 8,
                    fontSize: 15,
                    background: '#fff',
                    textAlign: 'right',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    direction: 'rtl'
                  }}
                  required
                />
              </div>

              {/* Target Audience */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#333', textAlign: 'right' }}>
                  קהל יעד
                </label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-start', direction: 'rtl' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 12px', background: notificationForm.targetAudience === 'all' ? '#007aff' : '#fff', color: notificationForm.targetAudience === 'all' ? '#fff' : '#333', borderRadius: 8, border: '2px solid ' + (notificationForm.targetAudience === 'all' ? '#007aff' : '#e0e0e0'), fontWeight: 500, transition: 'all 0.2s' }}>
                    <input
                      type="radio"
                      name="targetAudience"
                      value="all"
                      checked={notificationForm.targetAudience === 'all'}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, targetAudience: e.target.value, selectedUsers: [] }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14 }}>כל המשתמשים</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 12px', background: notificationForm.targetAudience === 'specific' ? '#007aff' : '#fff', color: notificationForm.targetAudience === 'specific' ? '#fff' : '#333', borderRadius: 8, border: '2px solid ' + (notificationForm.targetAudience === 'specific' ? '#007aff' : '#e0e0e0'), fontWeight: 500, transition: 'all 0.2s' }}>
                    <input
                      type="radio"
                      name="targetAudience"
                      value="specific"
                      checked={notificationForm.targetAudience === 'specific'}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14 }}>משתמשים ספציפיים</span>
                  </label>
                </div>
              </div>

              {/* Specific Users Selection */}
              {notificationForm.targetAudience === 'specific' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#333', textAlign: 'right' }}>
                    בחר משתמשים ({notificationForm.selectedUsers.length} נבחרו)
                  </label>
                  <div style={{ 
                    maxHeight: 200, 
                    overflowY: 'auto', 
                    border: '2px solid #e0e0e0', 
                    borderRadius: 8, 
                    padding: 8,
                    background: '#fff'
                  }}>
                    {allUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 16, color: '#666', fontSize: 13 }}>
                        טוען משתמשים...
                      </div>
                    ) : (
                      allUsers.map(user => (
                        <label key={user.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 8, 
                          padding: '8px 12px', 
                          cursor: 'pointer',
                          borderRadius: 6,
                          background: notificationForm.selectedUsers.includes(user.id) ? '#e3f2fd' : 'transparent',
                          transition: 'all 0.2s',
                          direction: 'rtl'
                        }}>
                          <input
                            type="checkbox"
                            checked={notificationForm.selectedUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNotificationForm(prev => ({ 
                                  ...prev, 
                                  selectedUsers: [...prev.selectedUsers, user.id] 
                                }));
                              } else {
                                setNotificationForm(prev => ({ 
                                  ...prev, 
                                  selectedUsers: prev.selectedUsers.filter(id => id !== user.id) 
                                }));
                              }
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 14, color: '#333', flex: 1 }}>
                            {user.name || user.phone || user.email || user.displayName || user.id}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Preview Section */}
              <div style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                borderRadius: 12, 
                padding: 16,
                marginTop: 8
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 8, textAlign: 'right', fontWeight: 600 }}>
                  👁️ תצוגה מקדימה
                </div>
                <div style={{ 
                  background: 'rgba(255,255,255,0.15)', 
                  backdropFilter: 'blur(10px)',
                  borderRadius: 10, 
                  padding: 12,
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, direction: 'rtl' }}>
                    <IoMdNotifications size={24} color="#fff" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4, textAlign: 'right' }}>
                        {notificationForm.title || 'כותרת ההודעה תופיע כאן'}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, textAlign: 'right' }}>
                        {notificationForm.body || 'גוף ההודעה יופיע כאן'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendNotification}
                disabled={sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()}
                style={{
                  width: '100%',
                  height: 50,
                  background: (sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()) 
                    ? '#ccc' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: (sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  boxShadow: (sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()) 
                    ? 'none' 
                    : '0 4px 15px rgba(102, 126, 234, 0.4)',
                  transform: (sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()) ? 'scale(1)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!sendingNotification && notificationForm.title.trim() && notificationForm.body.trim()) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = (sendingNotification || !notificationForm.title.trim() || !notificationForm.body.trim()) 
                    ? 'none' 
                    : '0 4px 15px rgba(102, 126, 234, 0.4)';
                }}
              >
                {sendingNotification ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    שולח...
                  </>
                ) : (
                  <>
                    <IoMdSend size={18} />
                    שלח הודעה לכל המשתמשים
                  </>
                )}
              </button>

              <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginTop: -8 }}>
                💡 הודעות יישלחו רק למשתמשים עם הודעות Push מופעלות
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Driver Delivery Zones Section */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowDriverZones(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 6,
          }}
        >
          <IoMdPeople size={20} />
          {showDriverZones ? 'הסתר ניהול אזורי משלוח לנהגים' : 'ניהול אזורי משלוח לנהגים 🚚'}
          <span style={{ fontSize: 18 }}>{showDriverZones ? '▲' : '▼'}</span>
        </button>
        
        {showDriverZones && (
          <div style={{ marginTop: 16, padding: 16, background: '#f8f9fa', borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16, textAlign: 'right', lineHeight: 1.6 }}>
              הגדר אילו ערים כל נהג יכול לקבל הזמנות אליהן. נהגים יקבלו התראות רק על הזמנות לערים שבהן הם מורשים לספק שירות.
            </div>

            {driversLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 14, color: '#666' }}>טוען נהגים...</div>
              </div>
            ) : drivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 14, color: '#666' }}>אין נהגים רשומים</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                  הוסף נהגים בדף ניהול משתמשים
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {drivers.map((driver) => {
                  const driverAllowedCities = driver.allowedDeliveryCities || [];
                  
                  return (
                    <div
                      key={driver.id}
                      style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: 16,
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 4 }}>
                          {driver.name || driver.displayName || driver.email || 'נהג ללא שם'}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {driver.email}
                        </div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                          {driverAllowedCities.length > 0 
                            ? `${driverAllowedCities.length} ערים מורשות` 
                            : 'אין ערים מורשות - הנהג לא יקבל הזמנות'}
                        </div>
                      </div>

                      {form.deliveryCities && form.deliveryCities.length > 0 ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>
                            בחר ערים מורשות:
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 8,
                            maxHeight: 200,
                            overflowY: 'auto',
                            padding: 8,
                            background: '#f8f9fa',
                            borderRadius: 6
                          }}>
                            {form.deliveryCities.map((cityObj, idx) => {
                              const cityHe = typeof cityObj === 'string' ? cityObj : cityObj.he;
                              const cityAr = typeof cityObj === 'string' ? '' : cityObj.ar;
                              
                              const isAllowed = driverAllowedCities.some(c => {
                                if (typeof c === 'string') {
                                  return c.toLowerCase() === cityHe.toLowerCase() || c.toLowerCase() === cityAr.toLowerCase();
                                }
                                return (
                                  (c.he && cityHe && c.he.toLowerCase() === cityHe.toLowerCase()) ||
                                  (c.ar && cityAr && c.ar.toLowerCase() === cityAr.toLowerCase())
                                );
                              });

                              return (
                                <button
                                  key={idx}
                                  onClick={() => toggleDriverCity(driver.id, typeof cityObj === 'string' ? { he: cityObj, ar: '' } : cityObj)}
                                  style={{
                                    background: isAllowed ? '#34C759' : '#e0e0e0',
                                    color: isAllowed ? '#fff' : '#333',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 2,
                                    transition: 'all 0.2s',
                                    minWidth: 80
                                  }}
                                >
                                  <span>{cityHe}</span>
                                  {cityAr && <span style={{ fontSize: 10, opacity: 0.9 }}>{cityAr}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          padding: 12, 
                          background: '#fff3cd', 
                          border: '1px solid #ffc107', 
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#856404',
                          textAlign: 'center'
                        }}>
                          ⚠️ אין ערים מוגדרות. הגדר ערים למשלוח בחלק "ערים למשלוח" למעלה כדי לנהל אזורי משלוח לנהגים.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons side by side */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, marginTop: 18, justifyContent: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="loginButton primary"
          style={{ fontSize: 18, padding: '6px 20px', borderRadius: 8, minWidth: 120 }}
        >
          {saving ? 'שומר...' : 'שמור'}
        </button>
        <button
          onClick={() => window.location.href = '/meals'}
          className="loginButton secondary"
          style={{ fontSize: 16, padding: '6px 20px', borderRadius: 8, minWidth: 120 }}
        >
          חזרה
        </button>
      </div>

      {/* Coupon Form Modal */}
      <CouponForm
        coupon={editingCoupon}
        onSave={handleCouponFormSave}
        onCancel={() => {
          setShowCouponForm(false);
          setEditingCoupon(null);
        }}
        isOpen={showCouponForm}
        activeBusinessId={activeBusinessId}
      />
    </div>
  );
};

// Coupon Card Component
const CouponCard = ({ coupon, onEdit, onDelete, onToggleStatus }) => {
  const status = getCouponStatus(coupon);
  const isExpired = isCouponExpired(coupon);
  
  const getStatusColor = () => {
    switch (status) {
      case COUPON_STATUS.ACTIVE:
        return '#34C759';
      case COUPON_STATUS.INACTIVE:
        return '#FF9500';
      case COUPON_STATUS.EXPIRED:
      case 'usage_limit_reached':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case COUPON_STATUS.ACTIVE:
        return 'פעיל';
      case COUPON_STATUS.INACTIVE:
        return 'לא פעיל';
      case COUPON_STATUS.EXPIRED:
        return 'פג תוקף';
      case 'usage_limit_reached':
        return 'הגיע למגבלת שימוש';
      default:
        return 'לא ידוע';
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('הקוד הועתק!');
  };

  return (
    <div style={{
      background: '#f8f9fa',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      border: '1px solid #e9ecef'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>
              {coupon.code}
            </span>
            <button
              onClick={() => copyToClipboard(coupon.code)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <IoMdCopy size={12} color="#007aff" />
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: getStatusColor(),
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600
            }}>
              {getStatusText()}
            </span>
            <span style={{
              background: coupon.discountType === COUPON_TYPES.PERCENTAGE ? '#007aff' : '#34C759',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600
            }}>
              {formatCouponDisplay(coupon)}
            </span>
          </div>
          
          {coupon.description && (
            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: 12 }}>
              {coupon.description}
            </p>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#666' }}>
            {coupon.expiryDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IoMdCalendar size={10} />
                <span>פג תוקף: {formatDateForDisplay(coupon.expiryDate)}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IoMdPeople size={10} />
              <span>
                שימוש כולל: {coupon.usageCount ?? 0}
                {coupon.maxUsage != null ? ` / ${coupon.maxUsage}` : ''}
              </span>
            </div>
            {coupon.maxUsagePerUser != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IoMdPeople size={10} />
                <span>עד {coupon.maxUsagePerUser} לכל משתמש</span>
              </div>
            )}
            
            {coupon.minimumOrder && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IoMdPricetag size={10} />
                <span>מינימום: ₪{coupon.minimumOrder}</span>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => onToggleStatus(coupon)}
            style={{
              background: status === COUPON_STATUS.ACTIVE ? '#FF9500' : '#34C759',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600
            }}
          >
            {status === COUPON_STATUS.ACTIVE ? 'בטל הפעלה' : 'הפעל'}
          </button>
          
          <button
            onClick={() => onEdit(coupon)}
            style={{
              background: '#007aff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <IoMdCreate size={10} />
            ערוך
          </button>
          
          <button
            onClick={() => onDelete(coupon)}
            style={{
              background: '#FF3B30',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <IoMdTrash size={10} />
            מחק
          </button>
        </div>
      </div>
    </div>
  );
};

// Coupon Form Component
const CouponForm = ({ coupon, onSave, onCancel, isOpen, activeBusinessId }) => {
  const [formData, setFormData] = useState({
    code: '',
    type: COUPON_TYPES.PERCENTAGE,
    value: '',
    description: '',
    expiresAt: '',
    usageLimit: '',
    maxUsagePerUser: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    status: COUPON_STATUS.ACTIVE
  });

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code || '',
        type: coupon.discountType || COUPON_TYPES.PERCENTAGE,
        value: coupon.discountValue || '',
        description: coupon.description || '',
        expiresAt: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().split('T')[0] : '',
        usageLimit: coupon.maxUsage || '',
        maxUsagePerUser: coupon.maxUsagePerUser ?? '',
        minOrderAmount: coupon.minimumOrder || '',
        maxDiscountAmount: coupon.maxDiscountAmount || '',
        status: coupon.isActive ? COUPON_STATUS.ACTIVE : COUPON_STATUS.INACTIVE
      });
    } else {
      setFormData({
        code: '',
        type: COUPON_TYPES.PERCENTAGE,
        value: '',
        description: '',
        expiresAt: '',
        usageLimit: '',
        maxUsagePerUser: '',
        minOrderAmount: '',
        maxDiscountAmount: '',
        status: COUPON_STATUS.ACTIVE
      });
    }
  }, [coupon, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.code || !formData.value) {
      toast.error('אנא מלא את כל השדות הנדרשים');
      return;
    }

    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        description: formData.description,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        maxUsagePerUser: formData.maxUsagePerUser ? parseInt(formData.maxUsagePerUser, 10) : null,
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
        status: formData.status
      };

      const businessId = activeBusinessId || brandConfig.id;
      if (coupon) {
        await updateCoupon(coupon.id, couponData, businessId);
        toast.success('הקופון עודכן בהצלחה!');
      } else {
        await createCoupon(couponData, businessId);
        toast.success('הקופון נוצר בהצלחה!');
      }
      
      onSave();
    } catch (error) {
      toast.error('שגיאה בשמירת הקופון');
      console.error('Error saving coupon:', error);
    }
  };

  const generateNewCode = () => {
    setFormData({ ...formData, code: generateCouponCode() });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
      overflow: 'hidden'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {coupon ? 'עריכת קופון' : 'יצירת קופון חדש'}
          </h3>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4
            }}
          >
            <IoMdClose />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                קוד הקופון *
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', width: '100%', maxWidth: '100%' }}>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="תרשום כאן ובאנגלית"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={generateNewCode}
                  style={{
                    background: '#007aff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  צור
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                סוג הנחה *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
                required
              >
                <option value={COUPON_TYPES.PERCENTAGE}>אחוז</option>
                <option value={COUPON_TYPES.FIXED_AMOUNT}>סכום קבוע</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                ערך הנחה * {formData.type === COUPON_TYPES.PERCENTAGE ? '(%)' : '(₪)'}
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                min="0"
                max={formData.type === COUPON_TYPES.PERCENTAGE ? "100" : undefined}
                step={formData.type === COUPON_TYPES.PERCENTAGE ? "1" : "0.01"}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                תיאור הקופון
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
                placeholder="תיאור אופציונלי לקופון..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                  תאריך פג תוקף
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                  מגבלת שימוש
                </label>
                <input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                  placeholder="ללא הגבלה"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                  מקסימום שימושים לכל משתמש
                </label>
                <input
                  type="number"
                  value={formData.maxUsagePerUser}
                  onChange={(e) => setFormData({ ...formData, maxUsagePerUser: e.target.value })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                  placeholder="ללא הגבלה (למשל 1 להזמנה ראשונה)"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                  הזמנה מינימלית (₪)
                </label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {formData.type === COUPON_TYPES.PERCENTAGE && (
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                    הנחה מקסימלית (₪)
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: 6,
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
                סטטוס
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              >
                <option value={COUPON_STATUS.ACTIVE}>פעיל</option>
                <option value={COUPON_STATUS.INACTIVE}>לא פעיל</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: '#34C759',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <IoMdCheckmark size={16} />
              {coupon ? 'שמור שינויים' : 'צור קופון'}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                background: '#8E8E93',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BusinessManagePage; 