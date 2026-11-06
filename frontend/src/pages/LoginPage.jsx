import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import './LoginPage.css';

export default function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [loginType, setLoginType] = useState('user'); // 'user' (Staff) or 'admin' (Administrator)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleTabSwitch = (type) => {
    setLoginType(type);
    setError('');
  };

  const handleCapsCheck = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) {
      setError(`Enter your ${loginType === 'admin' ? 'username' : 'employee ID or email'} and password.`);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const user = await login(u, password, loginType);

      // Admin Portal Constraint
      if (loginType === 'admin' && user.role !== 'ADMIN') {
        logout();
        setError('Access Denied: This portal is restricted to Administrators only.');
        setLoading(false);
        return;
      }

      // Staff Portal Constraint
      if (loginType === 'user' && user.role === 'ADMIN') {
        logout();
        setError('Access Denied: Administrators are not allowed to log in via the Staff Portal.');
        setLoading(false);
        return;
      }

      toast.success(`Welcome to the ${loginType === 'admin' ? 'Admin' : 'User'} Portal!`);

      // Navigate to appropriate landing page
      const from = location.state?.from?.pathname || '/';
      if (user.role === 'ADMIN' && loginType === 'admin') {
        navigate('/users', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg && serverMsg !== 'Invalid credentials') {
        setError(serverMsg);
      } else {
        setError('Incorrect ID or password. Check and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    const em = forgotEmail.trim();
    if (!em) {
      setForgotError('Please enter your email address or username.');
      return;
    }

    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: em });
      setForgotSuccess(res.data?.message || 'If an account exists with that email, a password reset link has been sent. Please check your inbox.');
      toast.success('Password reset email sent! Check your inbox.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send password reset email. Please try again.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotPassword = (e) => {
    e.preventDefault();
    setView('forgot');
    setForgotError('');
    setForgotSuccess('');
    if (username && username.trim()) {
      setForgotEmail(username.trim());
    }
  };

  return (
    <div className="vqh-login-page">
      <aside className="brand">
        <div className="logo">
          <div className="logo-mark">VQH</div>
          <div>
            <b>Velan Quality Hub</b>
            <span>Velan Metrology · Quality Management</span>
          </div>
        </div>
        <div className="hero">
          <h1>Verify the error. Fix it at the source.</h1>
          <p>Log gauge defects, confirm the measured deviation against tolerance, and close the corrective action.</p>
          <div className="modules">
            <span>Defect reports</span>
            <span>Corrective actions</span>
            <span>Vendor attribution</span>
            <span>Quality analytics</span>
          </div>
        </div>
      </aside>

      <main className="side">
        <div className="top-note">
          <span className="dot"></span>
          Systems operational
        </div>

        <div className="card">
          {view === 'forgot' ? (
            <div>
              <h2>Reset password</h2>
              <p className="sub">
                Enter your account email address and we will send you a link to reset your password.
              </p>

              <form id="forgotForm" noValidate onSubmit={handleForgotPasswordSubmit}>
                {forgotError && (
                  <div className="err on" role="alert" style={{ marginBottom: '14px' }}>
                    {forgotError}
                  </div>
                )}

                {forgotSuccess && (
                  <div
                    style={{
                      marginBottom: '14px',
                      padding: '12px 14px',
                      border: '1px solid rgba(63, 191, 138, .45)',
                      background: 'rgba(63, 191, 138, .12)',
                      color: '#a3f0cb',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      lineHeight: '1.5',
                    }}
                  >
                    ✔ {forgotSuccess}
                  </div>
                )}

                <div className="f">
                  <label htmlFor="forgotEmail">Employee ID or email address</label>
                  <input
                    id="forgotEmail"
                    name="forgotEmail"
                    type="text"
                    placeholder="e.g. employee@velanmetrology.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <button className="go" id="btnForgot" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? 'Sending link…' : 'Send reset link'}
                </button>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="link"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      color: 'var(--accent)',
                      fontSize: '13.5px',
                    }}
                    onClick={() => {
                      setView('login');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                  >
                    ← Back to sign in
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h2>Sign in</h2>
              <p className="sub">Use your company credentials to open the quality workspace.</p>

              <div className="seg" role="tablist" aria-label="Account type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginType === 'user'}
                  data-role="staff"
                  onClick={() => handleTabSwitch('user')}
                >
                  Staff
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginType === 'admin'}
                  data-role="admin"
                  onClick={() => handleTabSwitch('admin')}
                >
                  Administrator
                </button>
              </div>

              <form id="loginForm" noValidate onSubmit={handleSubmit}>
                <div className={`err ${error ? 'on' : ''}`} id="err" role="alert">
                  {error}
                </div>

                <div className="f">
                  <label htmlFor="username" id="userLabel">
                    {loginType === 'admin' ? 'Admin username' : 'Employee ID or email'}
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder={loginType === 'admin' ? 'admin' : 'e.g. VM1042'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="f pw">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleCapsCheck}
                    onKeyUp={handleCapsCheck}
                  />
                  <button
                    type="button"
                    className="eye"
                    id="eye"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                  <div className={`caps ${capsLockOn ? 'on' : ''}`} id="caps">
                    Caps Lock is on.
                  </div>
                </div>

                <div className="row">
                  <label className="chk">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Keep me signed in
                  </label>
                  <a className="link" href="#forgot" onClick={openForgotPassword}>
                    Forgot password?
                  </a>
                </div>

                <button className="go" id="go" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          )}

          <p className="help" id="loginHelp">
            Need access or a reset? Contact your department head or IT support. Accounts are issued by the Quality department.
          </p>
        </div>

        <div className="foot">
          <span>© Velan Metrology</span>
          <span>Authorized users only · Activity is logged</span>
        </div>
      </main>
    </div>
  );
}
