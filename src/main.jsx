import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import App from './App';
import LoginPage from '../pages/LoginPage';
import MealsPage from '../pages/MealsPage';
import OrdersPage from '../pages/OrdersPage';
import BusinessManagePage from '../pages/BusinessManagePage';
import DriverOrdersPage from '../pages/DriverOrdersPage';
import UserManagementPage from '../pages/UserManagementPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Admin Routes */}
        <Route path="/meals" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MealsPage />
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <OrdersPage />
          </ProtectedRoute>
        } />
        <Route path="/manage" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <BusinessManagePage />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        } />
        
        {/* Driver Routes */}
        <Route path="/driver/orders" element={
          <ProtectedRoute allowedRoles={['driver']}>
            <DriverOrdersPage />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
