import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function TopNav() {
  const { user } = useAuth();
  const location = useLocation();

  // Basic breadcrumb generation based on path
  const pathnames = location.pathname.split('/').filter(x => x);
  
  return (
    <header className="topbar">
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
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          {user?.username} <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>({user?.role})</span>
        </span>
      </div>
    </header>
  );
}
