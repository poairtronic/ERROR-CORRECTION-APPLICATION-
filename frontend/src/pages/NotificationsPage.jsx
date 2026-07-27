import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiBell, FiCheck, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useNotifications } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import { Table } from '../components/ui/Table';

export default function NotificationsPage() {
  const { setUnreadCount } = useNotifications();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = useCallback(() => {
    setLoading(true);
    api.get('/notifications').then(r => {
      setNotifs(r.data || []);
      setUnreadCount(r.data.filter(n => !n.read).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [setUnreadCount]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { toast.error('Failed to mark as read'); }
  }, [setUnreadCount]);

  const markAll = async () => {
    const unread = notifs.filter(n => !n.read);
    await Promise.all(unread.map(n => api.patch(`/notifications/${n.id}/read`).catch(() => {})));
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
    toast.success('All marked as read');
  };

  const stats = useMemo(() => ({
    unread: notifs.filter(n => !n.read).length,
    read: notifs.filter(n => n.read).length,
    delivered: notifs.filter(n => n.status === 'DELIVERED').length,
    failed: notifs.filter(n => n.status === 'FAILED').length,
  }), [notifs]);

  const columns = useMemo(() => [
    { header: 'Type', render: (n) => <span className="badge">{n.type}</span> },
    { header: 'Message', render: (n) => <span style={{ fontWeight: n.read ? 400 : 600, maxWidth: '250px', display: 'block' }}>{n.message}</span> },
    {
      header: 'Report',
      render: (n) => n.reportId ? (
        <Link to={`/reports/${n.reportId}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
          {n.report?.reportNumber || n.reportId}
        </Link>
      ) : '—'
    },
    {
      header: 'App Status',
      render: (n) => (
        <>
          {n.status === 'DELIVERED' && <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiCheckCircle /> Delivered</span>}
          {n.status === 'SENT' && <span style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiCheck /> Sent</span>}
          {n.status === 'QUEUED' && <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiRefreshCw /> Queued</span>}
          {n.status === 'FAILED' && <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiAlertCircle /> Failed</span>}
        </>
      )
    },
    {
      header: 'Read Status',
      render: (n) => n.read ? (
        <span style={{ color: '#4ade80' }}>Read</span>
      ) : (
        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>Unread</span>
      )
    },
    { header: 'Timestamp', render: (n) => <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(n.createdAt).toLocaleString('en-IN')}</span> },
    {
      header: 'Actions',
      render: (n) => !n.read ? (
        <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
          Mark Read
        </button>
      ) : '—'
    }
  ], [markRead]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Notification Dashboard</h1>
          <p>Real-time lifecycle tracking of all your notifications</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={fetchNotifs}><FiRefreshCw /> Refresh</button>
          {stats.unread > 0 && (
            <button className="btn btn-ghost" onClick={markAll}><FiCheck /> Mark all read</button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Unread</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats.unread}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Read</div>
            <div className="stat-value">{stats.read}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Delivered/Ack&apos;d</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.delivered}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{stats.failed}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-title"><FiBell /> Notification Timeline</div>
          <Table columns={columns} data={notifs} loading={loading} emptyMessage="No notifications yet." />
        </div>
      </div>
    </>
  );
}
