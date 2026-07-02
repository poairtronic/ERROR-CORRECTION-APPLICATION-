import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { Button } from '../components/ui/Button';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="empty-state" style={{ height: '80vh', justifyContent: 'center' }}>
      <div style={{ width: '80px', height: '80px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <FiLock size={40} />
      </div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>Access Denied</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px' }}>
        You do not have the required permissions to view this page. If you believe this is an error, please contact your administrator.
      </p>
      <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
    </div>
  );
}
