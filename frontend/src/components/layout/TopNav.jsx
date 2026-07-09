import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FiSearch, FiUser, FiX } from 'react-icons/fi';
import { useState } from 'react';

export function TopNav() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/reports?search=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  // Basic breadcrumb generation based on path
  const pathnames = location.pathname.split('/').filter(x => x);
  
  return (
    <header className="topbar topbar-global">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '8px', textTransform: 'capitalize' }}>
          <span>Home</span>
          {pathnames.map((name, index) => (
            <span key={index} style={{ display: 'flex', gap: '8px' }}>
              <span>/</span>
              <span style={index === pathnames.length - 1 ? { color: 'var(--text)', fontWeight: 600 } : {}}>
                {name.replace('-', ' ')}
              </span>
            </span>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <form onSubmit={handleSearch} style={{ position: 'relative', width: 250 }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input 
            placeholder="Global search..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 36, width: '100%', height: 36 }}
          />
        </form>
        <button 
          className="profile-trigger-btn" 
          onClick={() => setIsDrawerOpen(true)}
          title="View Profile"
          type="button"
        >
          <FiUser />
        </button>
      </div>

      {/* Profile Drawer Backdrop */}
      <div 
        className={`profile-drawer-backdrop ${isDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Profile Drawer */}
      <div className={`profile-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="profile-drawer-header">
          <h3>User Profile</h3>
          <button className="profile-drawer-close" onClick={() => setIsDrawerOpen(false)} type="button">
            <FiX />
          </button>
        </div>
        
        <div className="profile-avatar-large">
          {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
        </div>

        <div className="profile-info-section">
          <div className="profile-info-item">
            <span className="profile-info-label">Name</span>
            <span className="profile-info-value">{user?.username || 'N/A'}</span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-label">Position / Role</span>
            <span className="profile-info-value" style={{ textTransform: 'capitalize' }}>
              {user?.role ? user.role.replace('_', ' ').toLowerCase() : 'N/A'}
            </span>
          </div>

          <div className="profile-info-item">
            <span className="profile-info-label">Email ID</span>
            <span className="profile-info-value">{user?.email || 'N/A'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

