import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MealCard from './MealCard';

export default function SortableMealCard({ id, meal, categoryId, index, onChange, onDelete, expanded, onToggle, allMealsInCategory, onMoveCategory, categories, onChangeInstant, onDuplicate }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        boxShadow: '0 1px 4px #eee',
        position: 'relative',
    };

    // Drag handle to be passed as a prop
    const dragHandle = () => (
        <div
            {...listeners}
            {...attributes}
            style={{
                cursor: 'grab',
                color: '#888',
                fontSize: 20,
                background: 'rgba(243,243,243,0.85)',
                borderRadius: 4,
                padding: '2px 8px',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            title="Drag to reorder meal"
        >
            ☰
        </div>
    );

    return (
        <div ref={setNodeRef} style={style}>
            <MealCard
                meal={meal}
                dragHandle={dragHandle}
                categoryId={categoryId}
                index={index}
                onChange={onChange}
                onChangeInstant={onChangeInstant}
                onDelete={onDelete}
                expanded={expanded}
                onToggle={onToggle}
                allMealsInCategory={allMealsInCategory}
                onMoveCategory={onMoveCategory}
                categories={categories}
                onDuplicate={onDuplicate}
            />
        </div>
    );
} 