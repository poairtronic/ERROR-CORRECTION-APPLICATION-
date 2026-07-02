import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export default function SalesDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['sales-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const approvedReports = reports.filter(r => r.status === 'APPROVED' || r.status === 'CLOSED');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Sales & Financial Dashboard</h1>
          <p>Welcome back, {user?.username} · Cost Impact Overview</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total ECR Cost</div>
            <div className="stat-value" style={{ color: '#f87171' }}>$42,100</div>
            <div className="stat-desc">Year to Date</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vendor Recoveries</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>$12,500</div>
            <div className="stat-desc">Successfully claimed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved Reports</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{approvedReports.length}</div>
            <div className="stat-desc">Closed with costs</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiTrendingUp /> Recent Financial Impacts</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Cost Impact</th>
                    <th>Responsible Party</th>
                    <th>Date Closed</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedReports.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No approved reports available.</p></div></td></tr>
                  ) : approvedReports.slice(0, 10).map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>$1,200</td>
                      <td>{r.responsibleParty || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reports/${r.id}`)}>View</button>
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
