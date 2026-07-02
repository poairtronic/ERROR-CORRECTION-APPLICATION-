import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiArchive } from 'react-icons/fi';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

export default function StoreManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['store-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingIssues = reports.filter(r => r.status === 'APPROVED');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Store Manager Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Issue Requests</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingIssues.length}</div>
            <div className="stat-desc">Components to be issued</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Components Issued Today</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>12</div>
            <div className="stat-desc">Inventory dispatched</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiArchive /> Issue Component Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Qty Req</th>
                    <th>Decision</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingIssues.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No pending components to issue.</p></div></td></tr>
                  ) : pendingIssues.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.quantity || '—'}</td>
                      <td>{r.decision || '—'}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[r.status] || 'draft'}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reports/${r.id}`)}>Issue</button>
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
