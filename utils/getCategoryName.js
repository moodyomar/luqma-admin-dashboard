// src/utils/getCategoryName.js
export const getCategoryName = (categories, id, lang) => {
  const cat = categories?.find((c) => c.id === id);
  if (!cat) return id;
  if (lang === 'ar') return cat.name.ar;
  if (lang === 'he') return cat.name.he;
  return `${cat.name.ar} | ${cat.name.he}`;
};
