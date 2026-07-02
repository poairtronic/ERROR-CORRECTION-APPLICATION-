import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiClock } from 'react-icons/fi';

export default function SeniorManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['sm-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingReviews = reports.filter(r => r.status === 'PENDING_SM_REVIEW');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Senior Manager Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Reviews</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingReviews.length}</div>
            <div className="stat-desc">Awaiting your approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Average Review Time</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>2.5 hrs</div>
            <div className="stat-desc">Current week</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiClock /> Pending Reviews Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Decision</th>
                    <th>Date Raised</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReviews.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No pending reviews.</p></div></td></tr>
                  ) : pendingReviews.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td>{r.decision || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reports/${r.id}`)}>Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
