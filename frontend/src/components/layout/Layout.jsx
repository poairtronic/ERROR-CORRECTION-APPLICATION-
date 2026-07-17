import { useState, useCallback } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { TopNav } from './TopNav';


export default function Layout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return (
    <div className="layout">
      {/* Mobile overlay backdrop */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} 
        onClick={closeSidebar} 
      />
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="main">
        <TopNav onMenuToggle={toggleSidebar} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

