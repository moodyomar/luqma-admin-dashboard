// utils/menuUtils.js

export const generateMealId = (prefix = 'm') => {
  return `${prefix}_${Date.now()}`;
};

export const cleanText = (text) => {
  return text?.trimStart() || '';
};

export const createEmptyMeal = () => ({
  id: generateMealId(),
  name: { ar: '', he: '' },
  price: '',
  description: { ar: '', he: '' },
  image: '',
});

export const isValidMeal = (meal) => {
  return meal?.name?.ar && meal?.name?.he && meal?.price;
};
