import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import { TopNav } from './TopNav';


export default function Layout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <TopNav />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

