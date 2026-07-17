import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiTool, FiPlus } from 'react-icons/fi';
import { SIMPLIFIED_WORKFLOW } from '../../utils/constants';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatDate } from '../../utils/formatters';

export default function OperatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['operator-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const myActiveReports = reports.filter(r => r.status !== 'CLOSED' && r.raisedBy?.id === user?.id);

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'SC / PO Number', key: 'scOrPoNo', render: (r) => `${r.scNo || '—'} / ${r.poNo || '—'}` },
    { label: 'Component', key: 'componentName' },
    { label: 'Error Type', key: 'errorTypeName' },
    { label: 'Date Raised', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) },
    { label: 'Status', key: 'status' }
  ];

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Operator Dashboard</h1>
            <p>Welcome back, {user?.username}</p>
          </div>
          {!SIMPLIFIED_WORKFLOW && (
            <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
              <FiPlus /> Create New Report
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-label">My Active Reports</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{myActiveReports.length}</div>
            <div className="stat-desc">Currently in workflow</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiTool /> My Recent Reports</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={myActiveReports.slice(0, 10)} 
              columns={columns} 
              emptyMessage="You have no active reports."
              actionLabel="View" 
            />
          )}
        </div>
      </div>
    </>
  );
}
