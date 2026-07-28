import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle, FiPlus } from 'react-icons/fi';
import { SIMPLIFIED_WORKFLOW } from '../../utils/constants';
import DashboardQueueTable from '../../components/dashboards/DashboardQueueTable';
import { formatDate } from '../../utils/formatters';

export default function InspectorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['inspector-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const { data: draftReports = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['inspector-drafts'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports?status=DRAFT');
      return data || [];
    }
  });

  const isLoading = reportsLoading || draftsLoading;

  const pendingInspections = reports.filter(r => r.status === 'PENDING_INSPECTION');
  const completedToday = reports.filter(r => 
    r.auditLogs?.some(log => log.actionType === 'STATUS_CHANGE' && log.fromStatus === 'PENDING_INSPECTION' && new Date(log.timestamp).toDateString() === new Date().toDateString())
  ).length;

  // Calculate dynamic average inspection time
  const getInspectionDurations = (r) => {
    if (!r.auditLogs || r.auditLogs.length === 0) return [];
    
    // Find all status changes out of PENDING_INSPECTION
    const exits = r.auditLogs
      .filter(log => log.actionType === 'STATUS_CHANGE' && log.fromStatus === 'PENDING_INSPECTION')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
    const durations = [];
    for (const exit of exits) {
      const exitTime = new Date(exit.timestamp);
      // Find latest status change into PENDING_INSPECTION before this exit
      const entry = r.auditLogs
        .filter(log => log.actionType === 'STATUS_CHANGE' && log.toStatus === 'PENDING_INSPECTION' && new Date(log.timestamp) < exitTime)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
      const entryTime = entry ? new Date(entry.timestamp) : new Date(r.createdAt);
      const diffMs = exitTime - entryTime;
      if (diffMs > 0) {
        durations.push(diffMs);
      }
    }
    return durations;
  };

  const allDurations = reports.flatMap(getInspectionDurations);
  const avgDurationMs = allDurations.length > 0
    ? allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length
    : 0;

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '0m';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${totalSeconds}s`;
  };

  const averageTimeStr = formatDuration(avgDurationMs);

  const columns = [
    { label: 'Report ID', key: 'id' },
    { label: 'SC / PO Number', key: 'scOrPoNo', render: (r) => `${r.scNo || '—'} / ${r.poNo || '—'}` },
    { label: 'Component', key: 'componentName' },
    { label: 'Error Type', key: 'errorTypeName' },
    { label: 'Raised By', key: 'raisedBy', render: (r) => r.raisedBy?.name || '—' },
    { label: 'Date Raised', key: 'createdAt', style: { color: 'var(--text-muted)' }, render: (r) => formatDate(r.createdAt) }
  ];

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
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{averageTimeStr}</div>
            <div className="stat-desc">Per inspection</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiCheckCircle /> Inspection Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <DashboardQueueTable 
              data={pendingInspections} 
              columns={columns} 
              emptyMessage="No pending inspections." 
              actionLabel="Inspect" 
            />
          )}
        </div>

        {draftReports.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-title">📝 Draft Reports</div>
            {isLoading ? <div className="spinner" /> : (
              <DashboardQueueTable 
                data={draftReports} 
                columns={columns} 
                emptyMessage="No draft reports." 
                actionLabel="Edit Draft" 
                onActionClick={(r) => navigate(`/reports/edit/${r.id}`)}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
