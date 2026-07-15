import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiTrendingUp } from 'react-icons/fi';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function AccountsDashboard() {
  const { user } = useAuth();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['accounts-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/kpis');
      return data;
    },
    staleTime: 30000
  });

  const pendingVerification = reports.filter(r => r.status === 'PENDING_ACCOUNTS_REVIEW');
  const finalQueue = reports.filter(r => ['APPROVED', 'REJECTED', 'COMPONENTS_ISSUED', 'REWORK_IN_PROGRESS', 'NEW_PRODUCTION', 'CLOSED'].includes(r.status));
  
  const totalCost = kpis?.totalCost || 0;
  const vendorRecoveries = kpis?.totalLoss || 0;
  const isLoading = reportsLoading || kpisLoading;

  const pendingColumns = [
    { label: 'Report ID', key: 'id' },
    { label: 'Component', key: 'componentName' },
    { 
      label: 'Initial Cost Est.', 
      key: 'costEstimate',
      render: (r) => (
        <span>
          {r.inspectionDetail?.costEstimate ? formatCurrency(r.inspectionDetail.costEstimate) : '—'}
        </span>
      )
    },
    { 
      label: 'Responsible Party', 
      key: 'responsibleParty',
      render: (r) => r.inspectionDetail?.responsibleParty || '—'
    },
    { label: 'Date Raised', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

  const finalColumns = [
    { label: 'Report ID', key: 'id' },
    { label: 'Component', key: 'componentName' },
    { 
      label: 'Cost Impact', 
      key: 'costEstimate',
      render: (r) => (
        <span style={{ color: r.inspectionDetail?.costEstimate ? '#f87171' : 'inherit' }}>
          {r.inspectionDetail?.costEstimate ? formatCurrency(r.inspectionDetail.costEstimate) : '—'}
        </span>
      )
    },
    { 
      label: 'Status', 
      key: 'status',
      render: (r) => <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
    },
    { label: 'Date Closed', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Accounts & Financial Dashboard</h1>
          <p>Welcome back, {user?.username} · Cost Impact Overview</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Verification</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingVerification.length}</div>
            <div className="stat-desc">Awaiting cost check</div>
          </div>
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
            <div className="stat-label">Finalized Reports</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{finalQueue.length}</div>
            <div className="stat-desc">Approved & Rejected</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title"><FiTrendingUp /> Pending Cost Verification Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={pendingVerification} 
              columns={pendingColumns} 
              emptyMessage="No reports pending cost verification."
              actionLabel="Verify" 
            />
          )}
        </div>

        <div className="card">
          <div className="card-title"><FiTrendingUp /> Accounts Final Queue (Read-only)</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={finalQueue} 
              columns={finalColumns} 
              emptyMessage="No finalized reports available."
              actionLabel="View" 
            />
          )}
        </div>
      </div>
    </>
  );
}
