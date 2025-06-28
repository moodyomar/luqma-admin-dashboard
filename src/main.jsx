import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import LoginPage from '../pages/LoginPage';
import MealsPage from '../pages/MealsPage';
import OrdersPage from '../pages/OrdersPage';
import BusinessManagePage from '../pages/BusinessManagePage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/meals" element={<MealsPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/manage" element={<BusinessManagePage />} />
    </Routes>
  </BrowserRouter>
);
