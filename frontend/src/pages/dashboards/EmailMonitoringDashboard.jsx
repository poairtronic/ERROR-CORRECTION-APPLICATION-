import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FiMail, FiRefreshCw, FiAlertCircle, FiCheckCircle, FiClock, FiSearch, 
  FiFilter, FiDownload, FiEye, FiPlay, FiStopCircle, FiInfo, FiLayers 
} from 'react-icons/fi';
import api from '../../services/apiClient';
import { useNotifications } from '../../contexts/NotificationContext';
import toast from 'react-hot-toast';

export default function EmailMonitoringDashboard() {
  const { socket } = useNotifications();
  
  // State variables
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [recipient, setRecipient] = useState('');
  const [template, setTemplate] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  
  // Selected email for details view modal
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [showActionPrompt, setShowActionPrompt] = useState(null); // 'resend' | 'retry' | 'cancel'

  // Fetch summaries
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['email-summary'],
    queryFn: async () => {
      const { data } = await api.get('/email-monitoring/summary');
      return data;
    }
  });

  // Fetch logs list
  const { data: listData, isLoading, refetch: refetchList } = useQuery({
    queryKey: ['email-list', page, search, status, recipient, template, sortBy, sortOrder],
    queryFn: async () => {
      const { data } = await api.get('/email-monitoring/list', {
        params: {
          page,
          limit,
          search,
          status,
          recipient,
          template,
          sortBy,
          sortOrder,
        }
      });
      return data;
    }
  });

  // Fetch selected email details
  const { data: detailData, refetch: refetchDetail } = useQuery({
    queryKey: ['email-detail', selectedEmailId],
    queryFn: async () => {
      if (!selectedEmailId) return null;
      const { data } = await api.get(`/email-monitoring/${selectedEmailId}`);
      return data;
    },
    enabled: !!selectedEmailId
  });

  // Setup WebSocket real-time refresh
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log('WS event [email_logs_updated] received, refreshing dashboard...');
      refetchSummary();
      refetchList();
      if (selectedEmailId) {
        refetchDetail();
      }
    };

    socket.on('email_logs_updated', handleUpdate);

    return () => {
      socket.off('email_logs_updated', handleUpdate);
    };
  }, [socket, selectedEmailId]);

  // Operations
  const triggerResend = async () => {
    try {
      await api.post(`/email-monitoring/${selectedEmailId}/resend`, { reason: actionReason });
      toast.success('Resend request queued successfully');
      setIsModalOpen(false);
      setShowActionPrompt(null);
      setActionReason('');
      refetchSummary();
      refetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend email');
    }
  };

  const triggerRetry = async () => {
    try {
      await api.post(`/email-monitoring/${selectedEmailId}/retry`, { reason: actionReason });
      toast.success('Email retry execution queued');
      setIsModalOpen(false);
      setShowActionPrompt(null);
      setActionReason('');
      refetchSummary();
      refetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to retry email');
    }
  };

  const triggerCancel = async () => {
    try {
      await api.post(`/email-monitoring/${selectedEmailId}/cancel`, { reason: actionReason });
      toast.success('Email delivery cancelled');
      setIsModalOpen(false);
      setShowActionPrompt(null);
      setActionReason('');
      refetchSummary();
      refetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel email');
    }
  };

  // Export
  const handleExport = () => {
    const params = new URLSearchParams({
      search,
      status,
      recipient,
      template,
    }).toString();
    
    // Direct link trigger for file download attachment
    const exportUrl = `${api.defaults.baseURL || ''}/email-monitoring/export?${params}`;
    
    // Add Authorization header token dynamically using fetch
    const token = localStorage.getItem('ecr_token');
    fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-logs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => {
      console.error('Failed export:', err);
      toast.error('Failed to export email logs');
    });
  };

  // Client side downloads
  const downloadHtml = () => {
    if (!detailData?.email?.content) return;
    const blob = new Blob([detailData.email.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${detailData.email.id}.html`;
    a.click();
  };

  const downloadLog = () => {
    if (!detailData?.email) return;
    const blob = new Blob([JSON.stringify(detailData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-log-${detailData.email.id}.json`;
    a.click();
  };

  const items = listData?.items || [];
  const totalItems = listData?.total || 0;
  const totalPages = Math.ceil(totalItems / limit);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Enterprise Email Monitoring</h1>
          <p>Real-time delivery status, queue monitoring, and administration actions</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={handleExport}>
            <FiDownload /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => { refetchSummary(); refetchList(); }}>
            <FiRefreshCw /> Sync Logs
          </button>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Statistics Cards */}
        {summary && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-label">In-Flight Queue</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="stat-value">{summary.queued + summary.processing}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  ({summary.queued} Queued, {summary.processing} Processing)
                </span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-label">Sent Successfully</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="stat-value" style={{ color: 'var(--success)' }}>{summary.sent}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                  {summary.successRate}% Success
                </span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-label">Failed & Cancelled</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="stat-value" style={{ color: 'var(--danger)' }}>{summary.failed + summary.cancelled}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>
                  {summary.failureRate}% Failures
                </span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid #a855f7' }}>
              <div className="stat-label">Avg. Delivery Latency</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="stat-value" style={{ color: '#a855f7' }}>
                  {summary.avgDeliveryTimeSeconds}s
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Today: {summary.todayCount} sent
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Charts & Analytics Visualizer */}
        {summary && (
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Visual Chart 1: Success Ratios */}
            <div className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiLayers /> Delivery Status Proportions
              </h3>
              <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Sent Successfully</span>
                    <span style={{ fontWeight: 600 }}>{summary.sent} ({summary.successRate}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-dim)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${summary.successRate}%`, backgroundColor: 'var(--success)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Hard Failed / Cancelled</span>
                    <span style={{ fontWeight: 600 }}>{summary.failed + summary.cancelled} ({summary.failureRate}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-dim)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${summary.failureRate}%`, backgroundColor: 'var(--danger)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>Queued or In-Flight Retries</span>
                    <span style={{ fontWeight: 600 }}>
                      {summary.queued + summary.processing} ({( (summary.queued + summary.processing) / (summary.total || 1) * 100 ).toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-dim)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((summary.queued + summary.processing) / (summary.total || 1) * 100)}%`, backgroundColor: 'var(--warning)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Chart 2: Time Aggregations */}
            <div className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiClock /> Delivery Time Trends
              </h3>
              <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Aggregated Today:</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{summary.todayCount} emails</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Aggregated This Week:</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{summary.weekCount} emails</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Aggregated This Month:</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{summary.monthCount} emails</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and List */}
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Search report, recipient, subject, email ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-control"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div style={{ width: '180px' }}>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="form-control"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING (Queued)</option>
                <option value="PROCESSING">PROCESSING (In-Flight)</option>
                <option value="SENT">SENT</option>
                <option value="FAILED">FAILED (Retry-delay)</option>
                <option value="CANCELLED">CANCELLED (Fatal)</option>
              </select>
            </div>

            <div style={{ width: '180px' }}>
              <input
                type="text"
                placeholder="Filter Recipient email..."
                value={recipient}
                onChange={(e) => { setRecipient(e.target.value); setPage(1); }}
                className="form-control"
              />
            </div>

            <div style={{ width: '180px' }}>
              <select
                value={template}
                onChange={(e) => { setTemplate(e.target.value); setPage(1); }}
                className="form-control"
              >
                <option value="">All Templates</option>
                <option value="ReportCreated">pending-review</option>
                <option value="ReportApproved">approved</option>
                <option value="ReportRejected">rejected</option>
                <option value="ReportUpdated">returned / completed</option>
                <option value="DailySummary">daily-summary</option>
                <option value="WeeklySummary">weekly-summary</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => { setSortBy('createdAt'); setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC'); }}>
                      Created At {sortBy === 'createdAt' && (sortOrder === 'ASC' ? '▲' : '▼')}
                    </th>
                    <th>Recipient / Role</th>
                    <th>Subject / ECR Report</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Retries</th>
                    <th>Latency</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                        No email log records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '13px' }}>
                          <div>{new Date(item.createdAt).toLocaleDateString('en-IN')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            {new Date(item.createdAt).toLocaleTimeString('en-IN')}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.recipient}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{item.recipientRole}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.subject}</div>
                          {item.relatedReportId && (
                            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                              Report ID: {item.reportNumber || item.relatedReportId}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-dim)', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.event}
                          </span>
                        </td>
                        <td>
                          {item.status === 'SENT' && <span className="badge badge-success"><FiCheckCircle /> SENT</span>}
                          {item.status === 'PENDING' && <span className="badge badge-warning"><FiClock className="spin" /> QUEUED</span>}
                          {item.status === 'PROCESSING' && <span className="badge badge-info"><FiRefreshCw className="spin" /> SENDING</span>}
                          {item.status === 'FAILED' && <span className="badge badge-danger"><FiAlertCircle /> FAILED</span>}
                          {item.status === 'CANCELLED' && <span className="badge badge-danger" style={{ opacity: 0.6 }}><FiStopCircle /> CANCELLED</span>}
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 600 }}>{item.retryCount}</td>
                        <td style={{ fontSize: '13px' }}>
                          {item.deliveryTimeSeconds !== null ? `${item.deliveryTimeSeconds}s` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => { setSelectedEmailId(item.id); setIsModalOpen(true); }}
                            title="View complete email details & previews"
                          >
                            <FiEye /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Showing page {page} of {totalPages} ({totalItems} total logs)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details View Modal */}
      {isModalOpen && detailData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex',
          justifyContent: 'center', alignItems: 'center', padding: '24px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '900px', height: '90vh', display: 'flex',
            flexDirection: 'column', overflow: 'hidden', padding: 0
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Email Transmission Ledger Details</h2>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                  ID: {detailData.email.id}
                </span>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => { setIsModalOpen(false); setSelectedEmailId(null); }}>
                ✕ Close
              </button>
            </div>

            {/* Modal Body Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Row 1: Core details metadata */}
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-dim)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Recipient</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{detailData.email.recipient}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Role: {detailData.recipientRole}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-dim)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Event Template</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{detailData.email.event}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Status: {detailData.email.status}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-dim)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Delivery Info</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    Message ID: {detailData.email.providerMessageId || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Retries executed: {detailData.email.retryCount}
                  </div>
                </div>
              </div>

              {/* Timeline logs */}
              <div>
                <h4 style={{ margin: '0 0 10px' }}><FiLayers /> Delivery Timeline & Trace</h4>
                <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'bold' }}>[STEP 1] Report Log Generated</span>
                    <p style={{ margin: '2px 0 0', fontSize: '13px' }}>
                      Record initialized at {new Date(detailData.email.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {detailData.email.sentTime && (
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 'bold' }}>[STEP 2] Transmission Dispatched</span>
                      <p style={{ margin: '2px 0 0', fontSize: '13px' }}>
                        API server returned status SENT at {new Date(detailData.email.sentTime).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}
                  {detailData.auditLogs.map(audit => (
                    <div key={audit.id}>
                      <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 'bold' }}>
                        [AUDIT LOG] {audit.action} Action executed
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '13px' }}>
                        By {audit.adminUsername} on {new Date(audit.timestamp).toLocaleString('en-IN')}
                        <br/>
                        <span style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-dim)' }}>
                          Reason: {audit.reason}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* HTML frame preview */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>Compiled Frame HTML Preview</h4>
                  <button className="btn btn-sm btn-outline" onClick={downloadHtml}>
                    <FiDownload /> Download HTML File
                  </button>
                </div>
                <iframe
                  title="email-preview"
                  srcDoc={detailData.email.content}
                  style={{
                    width: '100%', height: '350px', border: '1px solid var(--border)',
                    borderRadius: '6px', backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* API Provider Response log */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>API Provider Response Trace</h4>
                  <button className="btn btn-sm btn-outline" onClick={downloadLog}>
                    <FiDownload /> Download Full Log
                  </button>
                </div>
                <pre style={{
                  backgroundColor: 'var(--bg-dim)', padding: '14px', borderRadius: '6px',
                  fontSize: '12px', overflowX: 'auto', maxHeight: '200px'
                }}>
                  {JSON.stringify(detailData.providerResponse, null, 2)}
                </pre>
              </div>

              {/* Error Stack traces */}
              {detailData.providerResponse?.stackTrace && (
                <div>
                  <h4 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>Failure Stack Trace</h4>
                  <pre style={{
                    backgroundColor: 'var(--bg-dim)', padding: '14px', borderRadius: '6px',
                    fontSize: '12px', overflowX: 'auto', color: 'var(--danger)', maxHeight: '200px'
                  }}>
                    {detailData.providerResponse.stackTrace}
                  </pre>
                </div>
              )}

            </div>

            {/* Modal Footer (Admin Operations) */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={() => setShowActionPrompt('resend')}>
                  <FiPlay /> Force Resend
                </button>
                <button className="btn btn-outline" onClick={() => setShowActionPrompt('retry')}>
                  <FiRefreshCw /> Manual Retry
                </button>
                {detailData.email.status === 'PENDING' && (
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setShowActionPrompt('cancel')}>
                    <FiStopCircle /> Cancel Delivery
                  </button>
                )}
              </div>
              <button className="btn btn-outline" onClick={() => { setIsModalOpen(false); setSelectedEmailId(null); }}>
                Dismiss
              </button>
            </div>

            {/* Action prompt dialog */}
            {showActionPrompt && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex',
                justifyContent: 'center', alignItems: 'center', padding: '24px'
              }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                  <h3>Confirm {showActionPrompt.toUpperCase()}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    Specify the administrative override justification reason below:
                  </p>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter operation reason..."
                    className="form-control"
                    rows={3}
                    style={{ marginBottom: '16px', width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={() => setShowActionPrompt(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      if (showActionPrompt === 'resend') triggerResend();
                      else if (showActionPrompt === 'retry') triggerRetry();
                      else if (showActionPrompt === 'cancel') triggerCancel();
                    }}>
                      Confirm Action
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
