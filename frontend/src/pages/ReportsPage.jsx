import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi';

const STATUS_COLORS = {
  DRAFT: 'draft', PENDING_INSPECTION: 'pending', PENDING_SM_REVIEW: 'review',
  PENDING_GM_APPROVAL: 'approval', APPROVED: 'approved', REJECTED: 'rejected', CLOSED: 'closed'
};
const STATUS_LABELS = {
  DRAFT: 'Draft', PENDING_INSPECTION: 'Pending Inspection', PENDING_SM_REVIEW: 'SM Review',
  PENDING_GM_APPROVAL: 'GM Approval', APPROVED: 'Approved', REJECTED: 'Rejected', CLOSED: 'Closed'
};

export default function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    api.get('/defect-reports').then(r => setReports(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = reports.filter(r => {
    const matchSearch = !search || (r.id + r.componentName + r.errorTypeName).toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Defect Reports</h1>
          <p>{filtered.length} reports</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
          <FiPlus /> New Report
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="flex gap-12 mb-16" style={{ flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 200 }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {loading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Description</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Status</th>
                    <th>Raised By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><div className="icon">📋</div><p>No reports found.</p></div></td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="tr-link" onClick={() => navigate(`/reports/${r.id}`)}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.defectDescription}</td>
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
