import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ReportsPage from './pages/ReportsPage';
import NewReportPage from './pages/NewReportPage';
import ReportDetailPage from './pages/ReportDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import MasterDataPage from './pages/MasterDataPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import { RoleGuard } from './components/layout/RoleGuard';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/new" element={<NewReportPage />} />
              <Route path="/reports/:id" element={<ReportDetailPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/users" element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <UsersPage />
                </RoleGuard>
              } />
              <Route path="/master-data" element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <MasterDataPage />
                </RoleGuard>
              } />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
