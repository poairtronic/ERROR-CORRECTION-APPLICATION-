import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import './LoginPage.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setError('Password reset token is missing from the URL.');
      return;
    }

    const checkToken = async () => {
      setVerifying(true);
      setError('');
      try {
        const res = await api.post('/auth/verify-reset-token', { token });
        setTokenValid(true);
        setVerifiedEmail(res.data?.email || '');
      } catch (err) {
        setTokenValid(false);
        setError(err.response?.data?.message || 'This password reset link is invalid or has expired.');
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleCapsCheck = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again or request a new link.');
    } finally {
      setSubmitting(false);
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
          <h2>Create new password</h2>
          <p className="sub">
            {verifiedEmail ? `Setting new password for ${verifiedEmail}` : 'Enter your new account password below.'}
          </p>

          {verifying ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
              Verifying reset link…
            </div>
          ) : !tokenValid ? (
            <div>
              <div className="err on" role="alert" style={{ marginBottom: '20px' }}>
                {error || 'This password reset link is invalid or has expired.'}
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--muted)', marginBottom: '20px', lineHeight: '1.5' }}>
                Password reset links are valid for 1 hour and can only be used once. If you need a new link, please request a password reset again.
              </p>
              <Link to="/login" className="go" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Return to sign in
              </Link>
            </div>
          ) : success ? (
            <div>
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(63, 191, 138, .12)',
                  border: '1px solid rgba(63, 191, 138, .4)',
                  color: '#a3f0cb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  marginBottom: '20px',
                }}
              >
                ✔ Your password has been successfully updated! Redirecting to the sign in page…
              </div>
              <Link to="/login" className="go" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Sign in now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="err on" role="alert">
                  {error}
                </div>
              )}

              <div className="f pw">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="eye"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <div className={`caps ${capsLockOn ? 'on' : ''}`}>
                  Caps Lock is on.
                </div>
              </div>

              <div className="f pw">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  required
                />
              </div>

              <button className="go" type="submit" disabled={submitting}>
                {submitting ? 'Updating password…' : 'Save new password'}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Link
                  to="/login"
                  className="link"
                  style={{ fontSize: '13.5px' }}
                >
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}

          <p className="help" style={{ marginTop: '20px' }}>
            Need assistance? Contact your department head or IT support. Accounts are managed by the Quality department.
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

