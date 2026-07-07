import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiClock } from 'react-icons/fi';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatDate } from '../../utils/formatters';

export default function SeniorManagerDashboard() {
  const { user } = useAuth();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['sm-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingReviews = reports.filter(r => r.status === 'PENDING_SM_REVIEW');

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'Component', key: 'componentName' },
    { label: 'Error Type', key: 'errorTypeName' },
    { label: 'Decision', key: 'decision' },
    { label: 'Date Raised', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Senior Manager Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Reviews</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingReviews.length}</div>
            <div className="stat-desc">Awaiting your approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Average Review Time</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>2.5 hrs</div>
            <div className="stat-desc">Current week</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiClock /> Pending Reviews Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={pendingReviews} 
              columns={columns} 
              emptyMessage="No pending reviews." 
              actionLabel="Review" 
            />
          )}
        </div>
      </div>
    </>
  );
}
