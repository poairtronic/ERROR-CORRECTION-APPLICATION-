import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FiUser, FiShield } from 'react-icons/fi';

export default function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('user'); // 'user' or 'admin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      
      // Admin Portal Constraint
      if (loginType === 'admin' && user.role !== 'ADMIN') {
        logout();
        setError('Access Denied: This portal is restricted to Administrators only.');
        setLoading(false);
        return;
      }

      toast.success(`Welcome to the ${loginType === 'admin' ? 'Admin' : 'User'} Portal!`);
      
      // Navigate to appropriate landing page
      if (user.role === 'ADMIN' && loginType === 'admin') {
        navigate('/users', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials';
      setError(msg);
    } finally {
      if (loginType !== 'admin' || !error) setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid var(--border)' }}>
          <button 
            type="button"
            style={{ 
              flex: 1, padding: '16px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: 'none',
              background: loginType === 'user' ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: loginType === 'user' ? 'var(--primary)' : 'var(--text-dim)',
              borderBottom: loginType === 'user' ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => { setLoginType('user'); setError(''); }}
          >
            <FiUser size={18} /> Staff Portal
          </button>
          <button 
            type="button"
            style={{ 
              flex: 1, padding: '16px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', border: 'none',
              background: loginType === 'admin' ? 'rgba(168,85,247,0.1)' : 'transparent',
              color: loginType === 'admin' ? '#c084fc' : 'var(--text-dim)',
              borderBottom: loginType === 'admin' ? '2px solid #c084fc' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => { setLoginType('admin'); setError(''); }}
          >
            <FiShield size={18} /> Admin Portal
          </button>
        </div>

        <div style={{ padding: '32px' }}>
          <div className="login-logo" style={{ marginBottom: '24px' }}>
            <div className="hex" style={loginType === 'admin' ? { background: 'linear-gradient(135deg, #a855f7, #7e22ce)' } : {}}>ECR</div>
            <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Error Correction System</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {loginType === 'admin' ? 'Administration Console' : 'Velan Metrology · Quality Control'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="form-group">
              <label>Username / Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={loginType === 'admin' ? 'admin@velan.com' : 'Enter your email'}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
              style={{ 
                marginTop: '16px', width: '100%', justifyContent: 'center', padding: '12px',
                background: loginType === 'admin' ? '#9333ea' : 'var(--primary)'
              }}
            >
              {loading ? 'Authenticating…' : (loginType === 'admin' ? 'Access Admin Console' : 'Sign In')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
