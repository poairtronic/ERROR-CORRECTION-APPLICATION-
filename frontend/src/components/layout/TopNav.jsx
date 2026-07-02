import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function TopNav() {
  const { user } = useAuth();
  const location = useLocation();

  // Basic breadcrumb generation based on path
  const pathnames = location.pathname.split('/').filter(x => x);
  
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle could go here */}
        <div className="breadcrumbs text-sm text-slate-500 font-medium capitalize flex gap-2">
          <span>Home</span>
          {pathnames.map((name, index) => (
            <span key={index} className="flex gap-2">
              <span>/</span>
              <span className={index === pathnames.length - 1 ? 'text-slate-900 font-semibold' : ''}>
                {name.replace('-', ' ')}
              </span>
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">
          {user?.username} ({user?.role})
        </span>
      </div>
    </header>
  );
}
