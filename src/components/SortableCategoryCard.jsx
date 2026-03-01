import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableCategoryCard({ id, cat, onEdit, onHide, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const isMobile = window.innerWidth < 768;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: '#f9f9f9',
        padding: isMobile ? '8px' : '10px',
        borderRadius: 6,
        border: '1px solid #ddd',
        marginBottom: 8,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div 
              className="categoriesControlsWrapper"
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '8px' : '10px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
                {/* ✅ Drag handle (only this triggers drag) */}
                <div
                    {...listeners}
                    style={{
                        cursor: 'grab',
                        color: '#666',
                        fontSize: isMobile ? '16px' : '18px',
                        padding: isMobile ? '3px 6px' : '4px 8px',
                        background: '#eee',
                        borderRadius: 4,
                        display: 'inline-block',
                        width: 'fit-content',
                        flexShrink: 0
                    }}
                    title="اسحب للتغيير الترتيب"
                >
                    ☰
                </div>

                {/* ✅ Category name: Arabic first, Hebrew in parentheses if both */}
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {cat.name?.ar || cat.name?.he}
                    {cat.name?.ar && cat.name?.he && (
                        <span style={{ marginRight: 6, color: '#666', fontSize: isMobile ? '11px' : '13px' }}>({cat.name.he})</span>
                    )}
                    {cat.hidden && (
                        <span style={{ marginRight: 8, color: 'gray', fontSize: isMobile ? '10px' : '12px' }}>مخفي</span>
                    )}
                </div>

                {/* ✅ Buttons */}
                <div 
                  className="categoriesBtnsControl"
                  style={{
                    display: 'flex',
                    gap: isMobile ? '4px' : '5px',
                    flexShrink: 0,
                    flexWrap: isMobile ? 'wrap' : 'nowrap'
                  }}
                >
                    <button 
                      onClick={onEdit} 
                      style={{ 
                        marginRight: 0,
                        fontSize: isMobile ? '11px' : '14px',
                        padding: isMobile ? '6px 10px' : '8px 12px',
                        minWidth: isMobile ? 'auto' : 'auto',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      تعديل
                    </button>
                    <button 
                      onClick={onHide} 
                      style={{ 
                        marginRight: 0, 
                        color: 'blue',
                        fontSize: isMobile ? '11px' : '14px',
                        padding: isMobile ? '6px 10px' : '8px 12px',
                        minWidth: isMobile ? 'auto' : 'auto',
                        whiteSpace: 'nowrap'
                      }}
                    >
                        {cat.hidden ? 'إظهار' : 'إخفاء'}
                    </button>
                    <button 
                      onClick={onDelete} 
                      style={{ 
                        marginRight: 0, 
                        color: 'red',
                        fontSize: isMobile ? '11px' : '14px',
                        padding: isMobile ? '6px 10px' : '8px 12px',
                        minWidth: isMobile ? 'auto' : 'auto',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      حذف
                    </button>
                </div>
            </div>
        </div>
    );
}
