import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { FiFileText, FiClock, FiCheckCircle, FiXCircle, FiPlus } from 'react-icons/fi';

const STATUS_COLORS = {
  DRAFT: 'draft', PENDING_INSPECTION: 'pending', PENDING_SM_REVIEW: 'review',
  PENDING_GM_APPROVAL: 'approval', APPROVED: 'approved', REJECTED: 'rejected', CLOSED: 'closed'
};
const STATUS_LABELS = {
  DRAFT: 'Draft', PENDING_INSPECTION: 'Pending Inspection', PENDING_SM_REVIEW: 'SM Review',
  PENDING_GM_APPROVAL: 'GM Approval', APPROVED: 'Approved', REJECTED: 'Rejected', CLOSED: 'Closed'
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/defect-reports').then(r => { setReports(r.data || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'PENDING_INSPECTION').length,
    review: reports.filter(r => ['PENDING_SM_REVIEW','PENDING_GM_APPROVAL'].includes(r.status)).length,
    approved: reports.filter(r => r.status === 'APPROVED').length,
    rejected: reports.filter(r => r.status === 'REJECTED').length,
  };

  const recent = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.username} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
          <FiPlus /> New Report
        </button>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Reports</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{stats.total}</div>
            <div className="stat-desc">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Inspection</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats.pending}</div>
            <div className="stat-desc">Awaiting inspector</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Under Review</div>
            <div className="stat-value" style={{ color: '#60a5fa' }}>{stats.review}</div>
            <div className="stat-desc">SM / GM stage</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.approved}</div>
            <div className="stat-desc">Closed successfully</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejected</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{stats.rejected}</div>
            <div className="stat-desc">Requires attention</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiFileText /> Recent Reports</div>
          {loading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Status</th>
                    <th>Raised By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No reports yet. Click &quot;New Report&quot; to get started.</p>
                      </div>
                    </td></tr>
                  ) : recent.map(r => (
                    <tr key={r.id} className="tr-link" onClick={() => navigate(`/reports/${r.id}`)}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[r.status] || 'draft'}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td>{r.raisedBy?.name || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
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
