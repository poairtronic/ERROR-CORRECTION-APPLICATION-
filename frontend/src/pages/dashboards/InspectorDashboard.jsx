import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle, FiPlus } from 'react-icons/fi';
import { SIMPLIFIED_WORKFLOW } from '../../utils/constants';

export default function InspectorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['inspector-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingInspections = reports.filter(r => r.status === 'PENDING_INSPECTION');
  const completedToday = reports.filter(r => 
    r.auditLogs?.some(log => log.action === 'INSPECTED' && new Date(log.createdAt).toDateString() === new Date().toDateString())
  ).length;

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Inspector Dashboard</h1>
            <p>Welcome back, {user?.username}</p>
          </div>
          {SIMPLIFIED_WORKFLOW && (
            <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
              <FiPlus /> Create New Report
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Inspections</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingInspections.length}</div>
            <div className="stat-desc">In queue</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Today</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{completedToday}</div>
            <div className="stat-desc">Great job!</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Average Time</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>14m</div>
            <div className="stat-desc">Per inspection</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiCheckCircle /> Inspection Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Raised By</th>
                    <th>Date Raised</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInspections.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No pending inspections.</p></div></td></tr>
                  ) : pendingInspections.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td>{r.raisedBy?.name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reports/${r.id}`)}>Inspect</button>
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
