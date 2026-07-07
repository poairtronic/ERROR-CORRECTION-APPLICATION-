import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle } from 'react-icons/fi';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function GeneralManagerDashboard() {
  const { user } = useAuth();

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
  const budgetSummary = formatCurrency(kpis?.totalLoss);
  const vendorCases = kpis?.vendorCases || 0;
  const activeCases = kpis?.openReports || 0;
  const isLoading = reportsLoading || kpisLoading;

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'Component', key: 'componentName' },
    { label: 'Error Type', key: 'errorTypeName' },
    { 
      label: 'Cost Estimate', 
      key: 'costEstimate',
      render: (r) => (
        <span style={{ color: r.inspection?.costEstimate ? '#f87171' : 'inherit' }}>
          {r.inspection?.costEstimate ? formatCurrency(r.inspection.costEstimate) : 'Pending Inspect'}
        </span>
      )
    },
    { 
      label: 'Date Raised', 
      key: 'createdAt', 
      style: { color: 'var(--text-muted)' },
      render: (r) => formatDate(r.createdAt)
    }
  ];

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
            <DashboardQueueTable 
              data={pendingApprovals} 
              columns={columns} 
              emptyMessage="No pending approvals."
              actionLabel="Review" 
            />
          )}
        </div>
      </div>
    </>
  );
}
