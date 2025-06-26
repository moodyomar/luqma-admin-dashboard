// components/SortableCategoriesList.jsx
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

import SortableCategoryCard from "./SortableCategoryCard";

export default function SortableCategoriesList({
  categories,
  mealsData,
  searchTerm,
  setSearchTerm,
  expandedCategories,
  setExpandedCategories,
  expandedMeals,
  updateMeal,
  deleteMeal,
  toggleMeal,
  setMealsData,
  onUpdate,
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex).map(
      (c, i) => ({ ...c, order: i + 1 })
    );

    onUpdate(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {categories.map((category) => (
          <SortableCategoryCard
            key={category.id}
            category={category}
            meals={mealsData.items[category.id] || []}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            expanded={expandedCategories[category.id]}
            setExpandedCategories={setExpandedCategories}
            expandedMeals={expandedMeals}
            updateMeal={updateMeal}
            deleteMeal={deleteMeal}
            toggleMeal={toggleMeal}
            setMealsData={setMealsData}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
