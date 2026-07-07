import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle } from 'react-icons/fi';

export default function GeneralManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['gm-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis-gm'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/kpis');
      return data;
    },
    staleTime: 30000
  });

  const pendingApprovals = reports.filter(r => r.status === 'PENDING_GM_APPROVAL');
  
  // Format currency helper
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const budgetSummary = formatCurrency(kpis?.totalLoss);
  const vendorCases = kpis?.vendorCases || 0;
  
  // Using openReports as a stand-in for general active cases or unassigned work instead of salaryDeductions
  const activeCases = kpis?.openReports || 0;

  const isLoading = reportsLoading || kpisLoading;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>General Manager Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingApprovals.length}</div>
            <div className="stat-desc">Requires attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Loss Impact (MTD)</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{budgetSummary}</div>
            <div className="stat-desc">Estimated rework loss</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vendor Cases</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{vendorCases}</div>
            <div className="stat-desc">Active issues</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Active Cases</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{activeCases}</div>
            <div className="stat-desc">System wide</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiCheckCircle /> Approval Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Cost Estimate</th>
                    <th>Date Raised</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No pending approvals.</p></div></td></tr>
                  ) : pendingApprovals.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td style={{ color: r.inspection?.costEstimate ? '#f87171' : 'inherit' }}>
                        {r.inspection?.costEstimate ? formatCurrency(r.inspection.costEstimate) : 'Pending Inspect'}
                      </td>
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
