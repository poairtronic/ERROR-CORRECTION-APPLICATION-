import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { FiHome, FiFileText, FiUsers, FiDatabase, FiBell, FiLogOut, FiPieChart, FiX } from 'react-icons/fi';

const roleLabels = { ADMIN: 'Administrator', OPERATOR: 'Operator', INSPECTOR: 'Inspector', SENIOR_MANAGER: 'Senior Manager', GENERAL_MANAGER: 'General Manager', STORE_MANAGER: 'Store Manager', ACCOUNTS: 'Accounts' };

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { unreadCount: notifCount, isConnected } = useNotifications();
  const navigate = useNavigate();
  const role = user?.role?.toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (onClose) onClose();
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>ECR SYSTEM</h2>
            <p>Error Correction Reports</p>
          </div>
          {/* Mobile close button */}
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <FiX size={20} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
          <FiHome className="icon" /> Dashboard
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
          <FiFileText className="icon" /> Reports
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
          <FiBell className="icon" />
          Notifications
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </NavLink>

        {['ADMIN', 'GENERAL_MANAGER', 'SENIOR_MANAGER'].includes(role) && (
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
            <FiPieChart className="icon" /> Analytics
          </NavLink>
        )}

        {(role === 'ADMIN') && (
          <>
            <div className="nav-section-title" style={{ marginTop: 12 }}>Admin</div>
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
              <FiUsers className="icon" /> Users
            </NavLink>
            <NavLink to="/master-data" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
              <FiDatabase className="icon" /> Master Data
            </NavLink>
            <NavLink to="/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
              <FiFileText className="icon" /> System Audit
            </NavLink>
            <NavLink to="/admin/emails" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
              <FiBell className="icon" /> Email Queue
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ padding: '0 8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: isConnected ? 'var(--success)' : 'var(--danger)',
            boxShadow: `0 0 8px ${isConnected ? 'var(--success)' : 'var(--danger)'}`
          }} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 500 }}>
            {isConnected ? 'Real-Time Active' : 'Disconnected'}
          </span>
        </div>
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
