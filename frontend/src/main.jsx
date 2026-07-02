import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';
import { RoleGuard } from './components/layout/RoleGuard';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const NewReportPage = lazy(() => import('./pages/NewReportPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const MasterDataPage = lazy(() => import('./pages/MasterDataPage'));
const AuditViewerPage = lazy(() => import('./pages/AuditViewerPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));


import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
          <Suspense fallback={<div className="page-content"><div className="spinner" /></div>}>
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
                <Route path="/audit" element={
                  <RoleGuard allowedRoles={['ADMIN', 'GM', 'SM']}>
                    <AuditViewerPage />
                  </RoleGuard>
                } />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
