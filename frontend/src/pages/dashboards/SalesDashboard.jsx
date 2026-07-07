import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export default function SalesDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['sales-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis-sales'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/kpis');
      return data;
    },
    staleTime: 30000
  });

  const approvedReports = reports.filter(r => r.status === 'APPROVED' || r.status === 'CLOSED');
  
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  
  const totalCost = kpis?.totalCost || 0;
  // Assume vendor recoveries is a dummy metric, we can just show totalLoss for now
  const vendorRecoveries = kpis?.totalLoss || 0;

  const isLoading = reportsLoading || kpisLoading;

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
            <div className="stat-value" style={{ color: '#f87171' }}>{formatCurrency(totalCost)}</div>
            <div className="stat-desc">Year to Date</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Estimated Loss</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{formatCurrency(vendorRecoveries)}</div>
            <div className="stat-desc">System wide loss</div>
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
                      <td style={{ color: r.inspection?.costEstimate ? '#f87171' : 'inherit' }}>
                        {r.inspection?.costEstimate ? formatCurrency(r.inspection.costEstimate) : 'Pending Inspect'}
                      </td>
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
