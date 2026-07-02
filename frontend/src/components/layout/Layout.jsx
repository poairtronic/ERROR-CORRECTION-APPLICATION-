import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { TopNav } from './TopNav';
import api from '../../services/apiClient';

export default function Layout() {
  const { isAuthenticated } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/notifications?unread=true').then(r => {
      setNotifCount(Array.isArray(r.data) ? r.data.length : 0);
    }).catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="layout">
      <Sidebar notifCount={notifCount} />
      <div className="main">
        <TopNav />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

