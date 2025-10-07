// pages/CouponManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  IoMdAdd, 
  IoMdCreate, 
  IoMdTrash, 
  IoMdCopy, 
  IoMdCheckmark, 
  IoMdClose,
  IoMdCalendar,
  IoMdPeople,
  IoMdPricetag
} from 'react-icons/io';
import {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  generateCouponCode,
  formatCouponDisplay,
  getCouponStatus,
  isCouponExpired,
  COUPON_TYPES,
  COUPON_STATUS
} from '../utils/couponUtils';
import './styles.css';

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
        return 'نشط';
      case COUPON_STATUS.INACTIVE:
        return 'غير نشط';
      case COUPON_STATUS.EXPIRED:
        return 'منتهي الصلاحية';
      case 'usage_limit_reached':
        return 'تم الوصول للحد الأقصى';
      default:
        return 'غير معروف';
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ الكود!');
  };

  return (
    <div className="coupon-card" style={{
      background: '#fff',
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #f0f0f0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1d1d1f' }}>
              {coupon.code}
            </h3>
            <button
              onClick={() => copyToClipboard(coupon.code)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <IoMdCopy size={16} color="#007aff" />
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              background: getStatusColor(),
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600
            }}>
              {getStatusText()}
            </span>
            <span style={{
              background: coupon.type === COUPON_TYPES.PERCENTAGE ? '#007aff' : '#34C759',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600
            }}>
              {formatCouponDisplay(coupon)}
            </span>
          </div>
          
          {coupon.description && (
            <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: 14 }}>
              {coupon.description}
            </p>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, color: '#666' }}>
            {coupon.expiresAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IoMdCalendar size={14} />
                <span>ينتهي: {new Date(coupon.expiresAt).toLocaleDateString('ar-SA')}</span>
              </div>
            )}
            
            {coupon.usageLimit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IoMdPeople size={14} />
                <span>الاستخدام: {coupon.usageCount || 0}/{coupon.usageLimit}</span>
              </div>
            )}
            
            {coupon.minOrderAmount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IoMdPricetag size={14} />
                <span>الحد الأدنى: ₪{coupon.minOrderAmount}</span>
              </div>
            )}
            
            {coupon.maxDiscountAmount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IoMdPricetag size={14} />
                <span>الحد الأقصى: ₪{coupon.maxDiscountAmount}</span>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onToggleStatus(coupon)}
            style={{
              background: status === COUPON_STATUS.ACTIVE ? '#FF9500' : '#34C759',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {status === COUPON_STATUS.ACTIVE ? 'إلغاء التفعيل' : 'تفعيل'}
          </button>
          
          <button
            onClick={() => onEdit(coupon)}
            style={{
              background: '#007aff',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IoMdCreate size={14} />
            تعديل
          </button>
          
          <button
            onClick={() => onDelete(coupon)}
            style={{
              background: '#FF3B30',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IoMdTrash size={14} />
            حذف
          </button>
        </div>
      </div>
    </div>
  );
};

const CouponForm = ({ coupon, onSave, onCancel, isOpen }) => {
  const [formData, setFormData] = useState({
    code: '',
    type: COUPON_TYPES.PERCENTAGE,
    value: '',
    description: '',
    expiresAt: '',
    usageLimit: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    status: COUPON_STATUS.ACTIVE
  });

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code || '',
        type: coupon.type || COUPON_TYPES.PERCENTAGE,
        value: coupon.value || '',
        description: coupon.description || '',
        expiresAt: coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '',
        usageLimit: coupon.usageLimit || '',
        minOrderAmount: coupon.minOrderAmount || '',
        maxDiscountAmount: coupon.maxDiscountAmount || '',
        status: coupon.status || COUPON_STATUS.ACTIVE
      });
    } else {
      setFormData({
        code: generateCouponCode(),
        type: COUPON_TYPES.PERCENTAGE,
        value: '',
        description: '',
        expiresAt: '',
        usageLimit: '',
        minOrderAmount: '',
        maxDiscountAmount: '',
        status: COUPON_STATUS.ACTIVE
      });
    }
  }, [coupon, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.code || !formData.value) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
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
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
        status: formData.status
      };

      if (coupon) {
        await updateCoupon(coupon.id, couponData);
        toast.success('تم تحديث الكوبون بنجاح!');
      } else {
        await createCoupon(couponData);
        toast.success('تم إنشاء الكوبون بنجاح!');
      }
      
      onSave();
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الكوبون');
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
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            {coupon ? 'تعديل الكوبون' : 'إنشاء كوبون جديد'}
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4
            }}
          >
            <IoMdClose />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                كود الكوبون *
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 16
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
                    borderRadius: 8,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  توليد
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                نوع الخصم *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16
                }}
                required
              >
                <option value={COUPON_TYPES.PERCENTAGE}>نسبة مئوية</option>
                <option value={COUPON_TYPES.FIXED_AMOUNT}>مبلغ ثابت</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                قيمة الخصم * {formData.type === COUPON_TYPES.PERCENTAGE ? '(%)' : '(₪)'}
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
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                وصف الكوبون
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16,
                  resize: 'vertical'
                }}
                placeholder="وصف اختياري للكوبون..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  تاريخ الانتهاء
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  حد الاستخدام
                </label>
                <input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                  placeholder="لا محدود"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                  الحد الأدنى للطلب (₪)
                </label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                />
              </div>

              {formData.type === COUPON_TYPES.PERCENTAGE && (
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    الحد الأقصى للخصم (₪)
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      fontSize: 16
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                الحالة
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16
                }}
              >
                <option value={COUPON_STATUS.ACTIVE}>نشط</option>
                <option value={COUPON_STATUS.INACTIVE}>غير نشط</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: '#34C759',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <IoMdCheckmark size={20} />
              {coupon ? 'حفظ التغييرات' : 'إنشاء الكوبون'}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                background: '#8E8E93',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CouponManagementPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const allCoupons = await getAllCoupons();
      setCoupons(allCoupons);
    } catch (error) {
      toast.error('حدث خطأ أثناء تحميل الكوبونات');
      console.error('Error loading coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleCreateCoupon = () => {
    setEditingCoupon(null);
    setShowForm(true);
  };

  const handleEditCoupon = (coupon) => {
    setEditingCoupon(coupon);
    setShowForm(true);
  };

  const handleDeleteCoupon = async (coupon) => {
    if (window.confirm(`هل أنت متأكد من حذف الكوبون "${coupon.code}"؟`)) {
      try {
        await deleteCoupon(coupon.id);
        toast.success('تم حذف الكوبون بنجاح!');
        loadCoupons();
      } catch (error) {
        toast.error('حدث خطأ أثناء حذف الكوبون');
        console.error('Error deleting coupon:', error);
      }
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const newStatus = coupon.status === COUPON_STATUS.ACTIVE ? COUPON_STATUS.INACTIVE : COUPON_STATUS.ACTIVE;
      await updateCoupon(coupon.id, { status: newStatus });
      toast.success(`تم ${newStatus === COUPON_STATUS.ACTIVE ? 'تفعيل' : 'إلغاء تفعيل'} الكوبون بنجاح!`);
      loadCoupons();
    } catch (error) {
      toast.error('حدث خطأ أثناء تغيير حالة الكوبون');
      console.error('Error toggling coupon status:', error);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingCoupon(null);
    loadCoupons();
  };

  const filteredCoupons = coupons.filter(coupon => {
    switch (filter) {
      case 'active':
        return getCouponStatus(coupon) === COUPON_STATUS.ACTIVE;
      case 'inactive':
        return getCouponStatus(coupon) === COUPON_STATUS.INACTIVE;
      case 'expired':
        return isCouponExpired(coupon);
      default:
        return true;
    }
  });

  return (
    <div style={{ padding: '20px', maxWidth: 1200, margin: '0 auto' }}>
      <Toaster position="top-center" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#1d1d1f' }}>
          إدارة الكوبونات
        </h1>
        
        <button
          onClick={handleCreateCoupon}
          style={{
            background: '#007aff',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(0,122,255,0.3)'
          }}
        >
          <IoMdAdd size={20} />
          إنشاء كوبون جديد
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { value: 'all', label: 'جميع الكوبونات' },
          { value: 'active', label: 'نشطة' },
          { value: 'inactive', label: 'غير نشطة' },
          { value: 'expired', label: 'منتهية الصلاحية' }
        ].map(filterOption => (
          <button
            key={filterOption.value}
            onClick={() => setFilter(filterOption.value)}
            style={{
              background: filter === filterOption.value ? '#007aff' : '#f0f0f0',
              color: filter === filterOption.value ? '#fff' : '#666',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 18, color: '#666' }}>جاري التحميل...</div>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 18, color: '#666', marginBottom: 16 }}>
            لا توجد كوبونات {filter !== 'all' ? 'في هذا التصنيف' : ''}
          </div>
          {filter === 'all' && (
            <button
              onClick={handleCreateCoupon}
              style={{
                background: '#007aff',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              إنشاء أول كوبون
            </button>
          )}
        </div>
      ) : (
        <div>
          {filteredCoupons.map(coupon => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={handleEditCoupon}
              onDelete={handleDeleteCoupon}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      <CouponForm
        coupon={editingCoupon}
        onSave={handleFormSave}
        onCancel={() => {
          setShowForm(false);
          setEditingCoupon(null);
        }}
        isOpen={showForm}
      />
    </div>
  );
};

export default CouponManagementPage;
