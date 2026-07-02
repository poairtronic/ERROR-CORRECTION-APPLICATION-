import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { TopNav } from './TopNav';
import api from '../../services/apiClient';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

export default function Layout() {
  const { isAuthenticated } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Initial fetch
    api.get('/notifications?unread=true').then(r => {
      setNotifCount(Array.isArray(r.data) ? r.data.length : 0);
    }).catch(() => {});

    // WebSocket connection
    const token = localStorage.getItem('ecr_token');
    const socket = io(import.meta.env.VITE_API_BASE || 'http://localhost:3000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Connected to notification server');
    });

    socket.on('notification', (data) => {
      toast.success(data.message, { icon: '🔔' });
      setNotifCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
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

