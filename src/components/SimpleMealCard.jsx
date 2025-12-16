import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import HideMealModal from './HideMealModal';

const SimpleMealCard = ({ 
  id, 
  meal, 
  categoryId, 
  index, 
  onChangeInstant 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const [showHideModal, setShowHideModal] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: meal.available === false || meal.unavailable === true ? '#f5f5f5' : '#fff',
    opacity: meal.available === false || meal.unavailable === true ? 0.5 : 1,
    border: '1px solid #ddd',
    borderRadius: 8,
    marginBottom: 6,
    boxShadow: '0 1px 3px #eee',
    position: 'relative',
  };

  const dragHandle = (
    <div
      {...listeners}
      {...attributes}
      style={{
        cursor: 'grab',
        color: '#888',
        fontSize: 18,
        background: 'rgba(243,243,243,0.85)',
        borderRadius: 4,
        padding: '4px 8px',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        flexShrink: 0,
      }}
      title="اسحب لإعادة الترتيب"
    >
      ☰
    </div>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="meal-card-header"
        style={{
          display: 'flex',
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 8,
          padding: '8px 10px',
          minHeight: 50,
          gap: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Meal image */}
        {meal.image && (
          <img 
            src={meal.image} 
            alt="meal" 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 6, 
              objectFit: 'cover', 
              margin: '0 6px 0 0',
              flexShrink: 0,
            }} 
          />
        )}
        
        {/* Meal name and price */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minWidth: 0,
            padding: '0 8px',
            overflow: 'hidden',
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            justifyContent: 'center', 
            width: '100%' 
          }}>
            <strong style={{ 
              fontSize: 15, 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              maxWidth: '100%', 
              flex: '1 1 auto', 
              minWidth: 0 
            }}>
              {meal.name?.ar || '—'}
            </strong>
            {meal.unavailable === true && (
              <span style={{ 
                fontSize: 9, 
                background: '#9e9e9e', 
                color: 'white', 
                padding: '2px 5px', 
                borderRadius: 4,
                fontWeight: 600
              }}>
                ⚠️
              </span>
            )}
            {meal.hideUntil && meal.available === false && (
              <span style={{ 
                fontSize: 9, 
                background: '#4CAF50', 
                color: 'white', 
                padding: '2px 5px', 
                borderRadius: 4,
                fontWeight: 600
              }}>
                🔄
              </span>
            )}
          </div>
          <span style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
            ₪{meal.price || '0'}
          </span>
        </div>

        {/* Buttons: Eye (hide/show) and Drag handle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            className="icon-square-btn eye"
            onClick={() => {
              // If unhiding (available is false or unavailable is true), do it directly
              if (meal.available === false || meal.unavailable === true) {
                const updated = { ...meal, available: true };
                // Remove hideUntil and unavailable if they exist
                if (updated.hideUntil) {
                  delete updated.hideUntil;
                }
                if (updated.unavailable) {
                  delete updated.unavailable;
                }
                if (onChangeInstant) {
                  onChangeInstant(categoryId, meal.id, updated);
                }
              } else {
                // If hiding, show modal
                setShowHideModal(true);
              }
            }}
            title={meal.available === false || meal.unavailable === true ? 'إظهار المادة' : 'إخفاء المادة'}
            style={{ 
              flexShrink: 0,
              width: '32px',
              height: '32px',
              minWidth: '32px',
              minHeight: '32px',
              maxWidth: '32px',
              maxHeight: '32px',
            }}
          >
            {meal.available === false || meal.unavailable === true ? (
              <FiEyeOff size={16} />
            ) : (
              <FiEye size={16} />
            )}
          </button>
          {dragHandle}
        </div>
      </div>

      {/* Hide Meal Modal */}
      <HideMealModal
        visible={showHideModal}
        onClose={() => setShowHideModal(false)}
        mealName={meal.name?.ar || meal.name?.he || ''}
        onHidePermanent={async () => {
          setShowHideModal(false);
          const updatedMeal = {
            ...meal,
            available: false,
          };
          // Remove hideUntil and unavailable if they exist
          if (updatedMeal.hideUntil) {
            delete updatedMeal.hideUntil;
          }
          if (updatedMeal.unavailable) {
            delete updatedMeal.unavailable;
          }
          if (onChangeInstant) {
            await onChangeInstant(categoryId, meal.id, updatedMeal);
          }
        }}
        onHideUntilTomorrow={async () => {
          setShowHideModal(false);
          // Calculate next day at 7 AM
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(7, 0, 0, 0); // 7 AM
          
          const updatedMeal = {
            ...meal,
            available: false,
            hideUntil: Timestamp.fromDate(tomorrow)
          };
          // Remove unavailable if it exists
          if (updatedMeal.unavailable) {
            delete updatedMeal.unavailable;
          }
          if (onChangeInstant) {
            await onChangeInstant(categoryId, meal.id, updatedMeal);
          }
        }}
        onMarkUnavailable={async () => {
          setShowHideModal(false);
          const updatedMeal = {
            ...meal,
            unavailable: true,
            available: true, // Keep available true so it shows in menu
          };
          // Remove hideUntil if it exists
          if (updatedMeal.hideUntil) {
            delete updatedMeal.hideUntil;
          }
          if (onChangeInstant) {
            await onChangeInstant(categoryId, meal.id, updatedMeal);
          }
        }}
        onMarkUnavailableUntilTomorrow={async () => {
          setShowHideModal(false);
          // Calculate next day at 7 AM
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(7, 0, 0, 0); // 7 AM
          
          const updatedMeal = {
            ...meal,
            unavailable: true,
            available: true, // Keep available true so it shows in menu
            hideUntil: Timestamp.fromDate(tomorrow)
          };
          if (onChangeInstant) {
            await onChangeInstant(categoryId, meal.id, updatedMeal);
          }
        }}
      />
    </div>
  );
};

export default SimpleMealCard;

