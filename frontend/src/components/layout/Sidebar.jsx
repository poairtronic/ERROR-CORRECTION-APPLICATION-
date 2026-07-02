import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FiHome, FiFileText, FiUsers, FiDatabase, FiBell, FiLogOut } from 'react-icons/fi';

const roleLabels = { ADMIN: 'Administrator', OPERATOR: 'Operator', INSPECTOR: 'Inspector', SENIOR_MANAGER: 'Senior Manager', GENERAL_MANAGER: 'General Manager', STORE_MANAGER: 'Store Manager' };

export default function Sidebar({ notifCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role?.toUpperCase();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>ECR SYSTEM</h2>
        <p>Error Correction Reports</p>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiHome className="icon" /> Dashboard
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiFileText className="icon" /> Reports
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiBell className="icon" />
          Notifications
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </NavLink>

        {(role === 'ADMIN') && (
          <>
            <div className="nav-section-title" style={{ marginTop: 12 }}>Admin</div>
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiUsers className="icon" /> Users
            </NavLink>
            <NavLink to="/master-data" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiDatabase className="icon" /> Master Data
            </NavLink>
            <NavLink to="/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FiFileText className="icon" /> System Audit
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.username || 'User'}</div>
            <div className="user-role">{roleLabels[role] || role}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            <FiLogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
