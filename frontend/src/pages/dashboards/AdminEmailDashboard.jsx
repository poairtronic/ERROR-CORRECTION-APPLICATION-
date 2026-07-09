import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiMail, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import api from '../../services/apiClient';

export default function AdminEmailDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const { data } = await api.get('/email/logs');
      return data;
    }
  });

  const handleResend = async (id) => {
    try {
      await api.post('/email/resend', { id });
      refetch();
    } catch (err) {
      console.error('Failed to resend:', err);
    }
  };

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'SENT').length,
    pending: logs.filter(l => l.status === 'PENDING').length,
    sending: logs.filter(l => l.status === 'PROCESSING').length,
    failed: logs.filter(l => l.status === 'FAILED' || l.status === 'CANCELLED').length,
  };

  const filteredLogs = logs.filter(log => 
    log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-label">Total Emails</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sent Successfully</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.sent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Queued (Pending)</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sending (In Transit)</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.sending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed / Cancelled</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{stats.failed}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="card-title" style={{ margin: 0 }}><FiMail /> Queue Logs</div>
            <input 
              type="text" 
              placeholder="Search logs by recipient or subject..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ width: '320px', padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center' }}>No logs found.</td></tr>
                  ) : filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td>
                        {log.status === 'SENT' && <span className="badge badge-success"><FiCheckCircle /> Sent</span>}
                        {log.status === 'PENDING' && <span className="badge badge-warning"><FiRefreshCw className="spin" /> Queued</span>}
                        {log.status === 'PROCESSING' && <span className="badge badge-info" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}><FiRefreshCw className="spin" /> Sending</span>}
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
                      <td>
                        {(log.status === 'FAILED' || log.status === 'CANCELLED') && (
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => handleResend(log.id)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            Resend
                          </button>
                        )}
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
