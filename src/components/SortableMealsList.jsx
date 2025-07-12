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
import SortableMealCard from "./SortableMealCard";

export default function SortableMealsList({
  meals,
  categoryId,
  onChangeMeal,
  onDeleteMeal,
  expandedMeals,
  onToggleMeal,
  allMealsInCategory,
  onReorder,
  categories,
  onMoveCategory,
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
          <SortableMealCard
            key={meal.id}
            id={meal.id}
            meal={meal}
            categoryId={categoryId}
            index={idx}
            onChange={(updated) => onChangeMeal(updated, idx)}
            onChangeInstant={onChangeMealInstant}
            onDelete={() => onDeleteMeal(idx)}
            expanded={expandedMeals[meal.id]}
            onToggle={() => onToggleMeal(meal.id)}
            allMealsInCategory={allMealsInCategory}
            onMoveCategory={(newCategoryId) => onMoveCategory(meal, categoryId, newCategoryId)}
            categories={categories}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
} 