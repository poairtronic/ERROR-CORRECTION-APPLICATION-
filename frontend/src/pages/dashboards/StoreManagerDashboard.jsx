import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle } from 'react-icons/fi';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatDate } from '../../utils/formatters';

export default function StoreManagerDashboard() {
  const { user } = useAuth();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['store-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingApprovals = reports.filter(r => r.status === 'APPROVED' && !r.componentsIssued);
  const issuedToday = reports.filter(r => r.componentsIssued && r.componentsIssuedAt && new Date(r.componentsIssuedAt).toDateString() === new Date().toDateString()).length;

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'SC / PO Number', key: 'scOrPoNo', render: (r) => `${r.scNo || '—'} / ${r.poNo || '—'}` },
    { label: 'Component', key: 'componentName' },
    { label: 'Error Type', key: 'errorTypeName' },
    { label: 'Store Decision', key: 'storeDecision' },
    { label: 'Date Raised', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Store Manager Dashboard</h1>
          <p>Welcome back, {user?.username} · Store Operations</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Reviews</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingApprovals.length}</div>
            <div className="stat-desc">Action Required</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Components Issued Today</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{issuedToday}</div>
            <div className="stat-desc">Replacement components</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiCheckCircle /> Approval Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={pendingApprovals} 
              columns={columns} 
              emptyMessage="No pending store approvals."
              actionLabel="Review" 
            />
          )}
        </div>
      </div>
    </>
  );
}
