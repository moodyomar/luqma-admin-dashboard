import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableCategoryCard({ id, cat, onEdit, onHide, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: '#f9f9f9',
        padding: 10,
        borderRadius: 6,
        border: '1px solid #ddd',
        marginBottom: 8,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div className="categoriesControlsWrapper">
                {/* ✅ Drag handle (only this triggers drag) */}
                <div
                    {...listeners}
                    style={{
                        cursor: 'grab',
                        marginBottom: 8,
                        color: '#666',
                        fontSize: 18,
                        padding: '4px 8px',
                        background: '#eee',
                        borderRadius: 4,
                        display: 'inline-block',
                        width: 'fit-content',
                    }}
                    title="اسحب للتغيير الترتيب"
                >
                    ☰
                </div>

                {/* ✅ Buttons remain fully clickable */}
                <div>
                    {/* {cat.name.ar} | {cat.name.he} */}
                    {cat.name.he}
                    {cat.hidden && (
                        <span style={{ marginRight: 8, color: 'gray', fontSize: 12 }}>مخفي</span>
                    )}
                </div>

                <div className="categoriesBtnsControl">
                    <button onClick={onEdit} style={{ marginRight: 10 }}>עריכה</button>
                    <button onClick={onHide} style={{ marginRight: 5, color: 'blue' }}>
                        {cat.hidden ? 'הצג' : 'הסתר'}
                    </button>
                    <button onClick={onDelete} style={{ marginRight: 5, color: 'red' }}>מחק</button>
                </div>
            </div>
        </div>
    );
}
