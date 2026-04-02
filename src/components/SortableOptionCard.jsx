import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableOptionCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 2 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 16 }}
      {...attributes}
      className="sortable-option-card"
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          direction: 'rtl',
        }}
      >
        <div
          {...listeners}
          style={{
            cursor: 'grab',
            color: '#555',
            fontSize: 18,
            padding: '8px 10px',
            background: '#eee',
            borderRadius: 8,
            border: '1px solid #ddd',
            flexShrink: 0,
            lineHeight: 1,
            userSelect: 'none',
            touchAction: 'none',
          }}
          title="اسحب لإعادة ترتيب الإضافة"
          aria-label="سحب لإعادة الترتيب"
        >
          ☰
        </div>
        <div
          className="option-card"
          style={{
            flex: 1,
            minWidth: 0,
            border: '2px solid #e0e0e0',
            borderRadius: 12,
            padding: 16,
            background: '#fafafa',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
