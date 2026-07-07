import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiTrendingUp } from 'react-icons/fi';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function SalesDashboard() {
  const { user } = useAuth();

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
  
  const totalCost = kpis?.totalCost || 0;
  const vendorRecoveries = kpis?.totalLoss || 0;
  const isLoading = reportsLoading || kpisLoading;

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'Component', key: 'componentName' },
    { 
      label: 'Cost Impact', 
      key: 'costEstimate',
      render: (r) => (
        <span style={{ color: r.inspection?.costEstimate ? '#f87171' : 'inherit' }}>
          {r.inspection?.costEstimate ? formatCurrency(r.inspection.costEstimate) : 'Pending Inspect'}
        </span>
      )
    },
    { label: 'Responsible Party', key: 'responsibleParty' },
    { label: 'Date Closed', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

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
            <DashboardQueueTable 
              data={approvedReports.slice(0, 10)} 
              columns={columns} 
              emptyMessage="No approved reports available."
              actionLabel="View" 
            />
          )}
        </div>
      </div>
    </>
  );
}
