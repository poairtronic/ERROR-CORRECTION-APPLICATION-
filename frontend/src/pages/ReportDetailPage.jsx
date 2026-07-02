import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiEdit2 } from 'react-icons/fi';

const STATUS_COLORS = { DRAFT:'draft',PENDING_INSPECTION:'pending',PENDING_SM_REVIEW:'review',PENDING_GM_APPROVAL:'approval',APPROVED:'approved',REJECTED:'rejected',CLOSED:'closed' };
const STATUS_LABELS = { DRAFT:'Draft',PENDING_INSPECTION:'Pending Inspection',PENDING_SM_REVIEW:'SM Review',PENDING_GM_APPROVAL:'GM Approval',APPROVED:'Approved',REJECTED:'Rejected',CLOSED:'Closed' };

function ActionModal({ title, onClose, onConfirm, actionLabel, variant = 'success', children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={`btn btn-${variant}`} onClick={onConfirm}>{actionLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'inspect'|'sm-review'|'gm-approve'|'gm-reject'
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const role = user?.role?.toUpperCase();

  const fetchReport = () => {
    api.get(`/defect-reports/${id}`).then(r => setReport(r.data)).catch(() => toast.error('Report not found')).finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, [id]);

  const doAction = async (endpoint, body) => {
    setSubmitting(true);
    try {
      await api.patch(`/defect-reports/${id}/${endpoint}`, body);
      toast.success('Action completed successfully!');
      setModal(null);
      fetchReport();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-content"><div className="spinner" /></div>;
  if (!report) return <div className="page-content"><div className="empty-state"><div className="icon">❌</div><p>Report not found.</p></div></div>;

  const status = report.status;

  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 4 }}>
            <FiArrowLeft /> Back
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Report <span className={`badge badge-${STATUS_COLORS[status] || 'draft'}`}>{STATUS_LABELS[status] || status}</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>ID: {id}</p>
        </div>
        <div className="flex gap-8">
          {role === 'INSPECTOR' && status === 'PENDING_INSPECTION' && (
            <button className="btn btn-success" onClick={() => setModal('inspect')}><FiCheckCircle /> Mark Inspected</button>
          )}
          {role === 'SM' && status === 'PENDING_SM_REVIEW' && (
            <button className="btn btn-success" onClick={() => setModal('sm-review')}><FiCheckCircle /> SM Review</button>
          )}
          {role === 'GM' && status === 'PENDING_GM_APPROVAL' && (
            <>
              <button className="btn btn-success" onClick={() => setModal('gm-approve')}><FiCheckCircle /> Approve</button>
              <button className="btn btn-danger" onClick={() => setModal('gm-reject')}><FiXCircle /> Reject</button>
            </>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="detail-grid">
          <div className="card">
            <div className="card-title">Report Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Description', report.defectDescription],
                ['Component', report.componentName || '—'],
                ['Error Type', report.errorTypeName || '—'],
                ['Part Number', report.partNumber || '—'],
                ['Batch Number', report.batchNumber || '—'],
                ['Quantity Affected', report.quantity || '—'],
                ['Raised By', report.raisedBy?.name || '—'],
                ['Date Raised', new Date(report.createdAt).toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label} className="detail-field">
                  <div className="detail-label">{label}</div>
                  <div className="detail-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Audit Trail</div>
            {report.auditLogs?.length > 0 ? (
              <div className="timeline">
                {report.auditLogs.map((log, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-line">
                      <div className="timeline-dot" />
                      <div className="timeline-line-bar" />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-event">{log.action}</div>
                      <div className="timeline-time">{new Date(log.createdAt).toLocaleString('en-IN')} · {log.user?.name}</div>
                      {log.notes && <div className="timeline-note">{log.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div className="icon">📝</div><p>No audit trail yet.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Inspect Modal */}
      {modal === 'inspect' && (
        <ActionModal title="Inspector Review" onClose={() => setModal(null)} actionLabel={submitting ? 'Submitting…' : 'Submit Review'} variant="success" onConfirm={() => doAction('inspect', { notes })}>
          <div className="form-group"><label>Inspection Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add inspection findings…" /></div>
        </ActionModal>
      )}
      {modal === 'sm-review' && (
        <ActionModal title="Senior Manager Review" onClose={() => setModal(null)} actionLabel={submitting ? 'Submitting…' : 'Submit Review'} variant="success" onConfirm={() => doAction('sm-review', { notes })}>
          <div className="form-group"><label>Review Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add review notes…" /></div>
        </ActionModal>
      )}
      {modal === 'gm-approve' && (
        <ActionModal title="Approve Report" onClose={() => setModal(null)} actionLabel={submitting ? 'Approving…' : 'Approve'} variant="success" onConfirm={() => doAction('gm-approve', { approved: true, notes })}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Are you sure you want to approve this defect report?</p>
          <div className="form-group"><label>Notes (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add approval notes…" /></div>
        </ActionModal>
      )}
      {modal === 'gm-reject' && (
        <ActionModal title="Reject Report" onClose={() => setModal(null)} actionLabel={submitting ? 'Rejecting…' : 'Reject'} variant="danger" onConfirm={() => doAction('gm-approve', { approved: false, notes })}>
          <div className="form-group"><label>Reason for Rejection *</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain why this report is being rejected…" required /></div>
        </ActionModal>
      )}
    </>
  );
}
