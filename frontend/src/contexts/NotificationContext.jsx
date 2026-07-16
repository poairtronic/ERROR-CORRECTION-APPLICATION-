import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import api from '../services/apiClient';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  const fetchUnread = async () => {
    try {
      const { data } = await api.get('/notifications?unread=true');
      const count = Array.isArray(data) ? data.length : 0;
      setUnreadCount(count);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to sync notifications', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    // Initial load
    fetchUnread();

    // Socket.IO connects to the server origin (root), not the /api path.
    // In production (Render): same-origin monolithic deploy → window.location.origin
    // In local dev: Vite runs on 5173 but backend is on 3000, so use localhost:3000
    const socketUrl = window.location.port === '5173'
      ? 'http://localhost:3000'
      : window.location.origin;

    // Connect – JWT is sent via HttpOnly cookie (withCredentials) or fallback auth
    const socket = io(socketUrl, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to notification server');
      // Step 6: Automatically sync state on connect/reconnect
      fetchUnread();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from notification server');
    });

    socket.on('notification', (payload, callback) => {
      // Step 8: Acknowledgement
      if (typeof callback === 'function') {
        callback({ received: true });
      } else if (payload.id) {
        // Fallback manual ACK
        socket.emit('acknowledge_notification', { id: payload.id });
      }

      toast.success(payload.message || 'New Notification', { icon: '🔔' });
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [payload, ...prev]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user]);

  const contextValue = useMemo(() => ({
    unreadCount,
    setUnreadCount,
    notifications,
    isConnected,
    socket: socketRef.current
  }), [unreadCount, notifications, isConnected]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
