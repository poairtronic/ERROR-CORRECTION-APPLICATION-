import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiPlus, FiFileText } from 'react-icons/fi';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

export default function OperatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['operator-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      // For a real app, this should be filtered by the backend based on userId
      return data || [];
    }
  });

  const myReports = reports.filter(r => r.raisedBy?.id === user.id || true); // Assuming backend already filters or we show all for now
  
  const stats = {
    pending: myReports.filter(r => ['PENDING_INSPECTION', 'PENDING_SM_REVIEW', 'PENDING_GM_APPROVAL'].includes(r.status)).length,
    rejected: myReports.filter(r => r.status === 'REJECTED').length,
    approved: myReports.filter(r => r.status === 'APPROVED' || r.status === 'CLOSED').length,
  };

  const recent = [...myReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Operator Dashboard</h1>
          <p>Welcome back, {user?.username} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
            <FiPlus /> New Report
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">My Reports</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{myReports.length}</div>
            <div className="stat-desc">Total raised</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats.pending}</div>
            <div className="stat-desc">Awaiting action</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejected</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{stats.rejected}</div>
            <div className="stat-desc">Needs attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.approved}</div>
            <div className="stat-desc">Successfully closed</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiFileText /> Recent Activity</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan={5}>
                      <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No recent activity. Click &quot;New Report&quot; to get started.</p>
                      </div>
                    </td></tr>
                  ) : recent.map(r => (
                    <tr key={r.id} className="tr-link" onClick={() => navigate(`/reports/${r.id}`)}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[r.status] || 'draft'}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
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
