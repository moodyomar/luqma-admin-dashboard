import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableOptionValueRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 4 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        marginBottom: 8,
        padding: 8,
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        background: '#fff',
      }}
      {...attributes}
      className="sortable-option-value-row"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          direction: 'rtl',
          flexWrap: 'wrap',
        }}
      >
        <div
          {...listeners}
          style={{
            cursor: 'grab',
            color: '#666',
            fontSize: 14,
            padding: '6px 8px',
            background: '#f0f0f0',
            borderRadius: 6,
            border: '1px solid #ddd',
            flexShrink: 0,
            lineHeight: 1,
            userSelect: 'none',
            touchAction: 'none',
          }}
          title="اسحب لترتيب هذا الخيار"
          aria-label="سحب لترتيب الصف"
        >
          ⋮⋮
        </div>
        <div
          className="value-row"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
