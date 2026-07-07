import { useQuery } from '@tanstack/react-query';
import { FiMail, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import api from '../../services/apiClient';

export default function AdminEmailDashboard() {
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const { data } = await api.get('/email/logs');
      return data;
    }
  });

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'SENT').length,
    pending: logs.filter(l => l.status === 'PENDING').length,
    failed: logs.filter(l => l.status === 'FAILED' || l.status === 'CANCELLED').length,
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Email Queue Dashboard</h1>
          <p>System-wide SMTP and Email Log Monitoring</p>
        </div>
        <button className="btn btn-outline" onClick={() => refetch()}><FiRefreshCw /> Refresh</button>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Emails</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sent Successfully</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.sent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Queued / Sending</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed / Cancelled</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{stats.failed}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-title"><FiMail /> Queue Logs</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Retries</th>
                    <th>Error</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center' }}>No logs found.</td></tr>
                  ) : logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        {log.status === 'SENT' && <span className="badge badge-success"><FiCheckCircle /> Sent</span>}
                        {log.status === 'PENDING' && <span className="badge badge-warning"><FiRefreshCw className="spin" /> Queued</span>}
                        {(log.status === 'FAILED' || log.status === 'CANCELLED') && <span className="badge badge-danger"><FiAlertCircle /> {log.status}</span>}
                      </td>
                      <td>{log.recipient}</td>
                      <td>
                        <div>{log.subject}</div>
                        {log.relatedReportId && <a href={`/reports/${log.relatedReportId}`} style={{ fontSize: '12px', color: 'var(--primary)' }}>View Report</a>}
                      </td>
                      <td>{log.retryCount}</td>
                      <td style={{ color: '#f87171', fontSize: '12px', maxWidth: '200px', wordBreak: 'break-word' }}>{log.failureReason || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleString('en-IN')}
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
