import React from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SimpleMealCard from "./SimpleMealCard";

export default function SimpleSortableMealsList({
  meals,
  categoryId,
  onReorder,
  onChangeMealInstant,
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = meals.findIndex((m) => m.id === active.id);
    const newIndex = meals.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(meals, oldIndex, newIndex).map((m, i) => ({ ...m, order: i }));
    onReorder(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={meals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        {meals.map((meal, idx) => (
          <SimpleMealCard
            key={meal.id}
            id={meal.id}
            meal={meal}
            categoryId={categoryId}
            index={idx}
            onChangeInstant={onChangeMealInstant}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}









