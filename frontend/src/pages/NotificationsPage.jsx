import React, { useEffect, useState } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';
import { FiBell, FiCheck } from 'react-icons/fi';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = () => {
    api.get('/notifications').then(r => setNotifs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    } catch { toast.error('Failed to mark as read'); }
  };

  const markAll = async () => {
    const unread = notifs.filter(n => !n.read);
    await Promise.all(unread.map(n => api.patch(`/notifications/${n.id}/read`).catch(() => {})));
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    toast.success('All marked as read');
  };

  return (
    <>
      <div className="topbar">
        <div><h1>Notifications</h1><p>{notifs.filter(n => !n.read).length} unread</p></div>
        {notifs.some(n => !n.read) && (
          <button className="btn btn-ghost btn-sm" onClick={markAll}><FiCheck /> Mark all read</button>
        )}
      </div>

      <div className="page-content">
        <div className="card">
          {loading ? <div className="spinner" /> : notifs.length === 0 ? (
            <div className="empty-state"><div className="icon"><FiBell size={36} /></div><p>No notifications yet.</p></div>
          ) : notifs.map(n => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)} style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: '1px solid var(--border)', cursor: !n.read ? 'pointer' : 'default',
              opacity: n.read ? 0.6 : 1,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: n.read ? 'transparent' : 'var(--primary)',
                border: n.read ? '2px solid var(--border)' : 'none',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{new Date(n.createdAt).toLocaleString('en-IN')}</div>
              </div>
              {!n.read && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); markRead(n.id); }}><FiCheck /></button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
