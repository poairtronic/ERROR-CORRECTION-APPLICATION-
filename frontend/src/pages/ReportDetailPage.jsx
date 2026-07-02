import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiPrinter, FiImage, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import Dialog from '../components/ui/Dialog';

import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';

function ActionModal({ title, onClose, onConfirm, actionLabel, variant = 'success', children, loading = false }) {
  return (
    <Dialog open={true} onClose={onClose} title={title}>
      <div style={{ minWidth: 400 }}>
        {children}
        <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={`btn btn-${variant}`} onClick={onConfirm} disabled={loading}>{loading ? 'Submitting…' : actionLabel}</button>
        </div>
      </div>
    </Dialog>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role?.toUpperCase();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // 'inspect'|'sm-review'|'gm-approve'|'gm-reject'
  const [notes, setNotes] = useState('');

  const { data: report, isLoading: loading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => (await api.get(`/defect-reports/${id}`)).data
  });

  const actionMutation = useMutation({
    mutationFn: async ({ endpoint, body }) => api.patch(`/defect-reports/${id}/${endpoint}`, body),
    onSuccess: () => {
      toast.success('Action completed successfully!');
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed')
  });

  const [inspectData, setInspectData] = useState({
    errorType: '', rootCause: '', responsibleParty: '', decision: '',
    responsibleId: '', alternativeNote: '', costEstimate: '', timeEstimateHours: '', lossAmount: ''
  });
  
  const [smData, setSmData] = useState({
    loopholeNote: '', costEstimate: '', timeEstimateHours: '',
    lossAmount: '', decisionNote: '', biasedFlag: false, forwardToGm: 'true'
  });

  const openSmReviewModal = () => {
    setSmData({
      loopholeNote: report.smReview?.loopholeNote || '', 
      costEstimate: report.inspectionDetail?.costEstimate ?? '', 
      timeEstimateHours: report.inspectionDetail?.timeEstimateHours ?? '',
      lossAmount: report.inspectionDetail?.lossAmount ?? '', 
      decisionNote: report.smReview?.decisionNote || '', 
      biasedFlag: report.smReview?.biasedFlag || false, 
      forwardToGm: 'true'
    });
    setModal('sm-review');
  };

  const doAction = (endpoint, body) => {
    actionMutation.mutate({ endpoint, body });
  };

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleEditSave = async (field) => {
    try {
      await api.patch(`/defect-reports/${id}/field`, { field, value: editValue });
      toast.success('Field updated successfully');
      setEditingField(null);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update field');
    }
  };

  const canEdit = (fieldKey) => {
    if (!fieldKey) return false;
    if (role === 'GENERAL_MANAGER' && status === 'PENDING_GM_APPROVAL') return true;
    if (role === 'SENIOR_MANAGER' && status === 'PENDING_SM_REVIEW') {
      const smAllowed = ['defectDescription', 'stageOfFailure', 'errorType', 'rootCause', 'decision', 'loopholeNote', 'costEstimate', 'timeEstimateHours', 'lossAmount', 'decisionNote'];
      return smAllowed.includes(fieldKey);
    }
    return false;
  };

  if (loading) return <div className="page-content"><div className="spinner" /></div>;
  if (!report) return <div className="page-content"><div className="empty-state"><div className="icon">❌</div><p>Report not found.</p></div></div>;

  const status = report.status;

  return (
    <>
      <div className="topbar no-print">
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
          <button className="btn btn-ghost" onClick={() => window.print()}><FiPrinter /> Print</button>
          {role === 'INSPECTOR' && status === 'PENDING_INSPECTION' && (
            <button className="btn btn-success" onClick={() => setModal('inspect')}><FiCheckCircle /> Mark Inspected</button>
          )}
          {role === 'SENIOR_MANAGER' && status === 'PENDING_SM_REVIEW' && (
            <button className="btn btn-success" onClick={openSmReviewModal}><FiCheckCircle /> SM Review</button>
          )}
          {role === 'GENERAL_MANAGER' && status === 'PENDING_GM_APPROVAL' && (
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
                ['Description', report.defectDescription, 'defectDescription'],
                ['Component', report.componentName || '—', 'componentName'],
                ['Stage of Failure', report.stageOfFailure || '—', 'stageOfFailure'],
                ['Error Type', report.errorTypeName || report.inspectionDetail?.errorType || '—', 'errorType'],
                ['Root Cause', report.inspectionDetail?.rootCause || '—', 'rootCause'],
                ['Decision', report.inspectionDetail?.decision || '—', 'decision'],
                ['Cost Estimate', report.inspectionDetail?.costEstimate !== undefined ? `$${report.inspectionDetail.costEstimate}` : '—', 'costEstimate'],
                ['Time Estimate', report.inspectionDetail?.timeEstimateHours !== undefined ? `${report.inspectionDetail.timeEstimateHours} Hours` : '—', 'timeEstimateHours'],
                ['Loss Amount', report.inspectionDetail?.lossAmount !== null && report.inspectionDetail?.lossAmount !== undefined ? `$${report.inspectionDetail.lossAmount}` : '—', 'lossAmount'],
                ['Part Number', report.partNumber || '—', 'partNumber'],
                ['Batch Number', report.batchNumber || '—', 'batchNumber'],
                ['Quantity Affected', report.quantity || '—', 'quantity'],
                ['Raised By', report.raisedBy?.name || '—', undefined],
                ['Date Raised', new Date(report.createdAt).toLocaleString('en-IN'), undefined],
              ].map(([label, value, fieldKey]) => (
                <div key={label} className="detail-field-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="detail-label">{label}</div>
                    {editingField === fieldKey ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <input className="form-control" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn btn-success btn-sm" onClick={() => handleEditSave(fieldKey)}><FiSave /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}><FiX /></button>
                      </div>
                    ) : (
                      <div className="detail-value">{value}</div>
                    )}
                  </div>
                  {canEdit(fieldKey) && editingField !== fieldKey && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingField(fieldKey); setEditValue(value === '—' ? '' : value); }}>
                      <FiEdit2 />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {report.attachments?.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-title"><FiImage /> Attachments</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {report.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Attachment ${i+1}`} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
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
        <ActionModal title="Inspector Review" onClose={() => setModal(null)} actionLabel="Submit Review" loading={actionMutation.isPending} onConfirm={() => doAction('inspect', inspectData)}>
          <div className="form-grid">
            <div className="form-group">
              <label>Error Type *</label>
              <input value={inspectData.errorType} onChange={e => setInspectData({...inspectData, errorType: e.target.value})} placeholder="e.g. Dimensional Error" required />
            </div>
            <div className="form-group">
              <label>Root Cause *</label>
              <input value={inspectData.rootCause} onChange={e => setInspectData({...inspectData, rootCause: e.target.value})} placeholder="e.g. Machine Calibration" required />
            </div>
            <div className="form-group">
              <label>Responsible Party *</label>
              <select value={inspectData.responsibleParty} onChange={e => setInspectData({...inspectData, responsibleParty: e.target.value})} required>
                <option value="">Select Party</option>
                <option value="OPERATOR">Operator</option>
                <option value="VENDOR">Vendor</option>
                <option value="PROCESS">Process</option>
                <option value="MACHINE">Machine</option>
              </select>
            </div>
            <div className="form-group">
              <label>Decision *</label>
              <select value={inspectData.decision} onChange={e => setInspectData({...inspectData, decision: e.target.value})} required>
                <option value="">Select Decision</option>
                <option value="REWORK">Rework</option>
                <option value="SCRAP">Scrap</option>
                <option value="ALTERNATIVE">Alternative Use</option>
              </select>
            </div>
            {(inspectData.responsibleParty === 'OPERATOR' || inspectData.responsibleParty === 'VENDOR') && (
              <div className="form-group full">
                <label>Responsible Entity ID/Name (Optional)</label>
                <input value={inspectData.responsibleId} onChange={e => setInspectData({...inspectData, responsibleId: e.target.value})} placeholder="e.g. Operator ID or Vendor Name" />
              </div>
            )}
            {inspectData.decision === 'ALTERNATIVE' && (
              <div className="form-group full">
                <label>Alternative Note (Optional)</label>
                <input value={inspectData.alternativeNote} onChange={e => setInspectData({...inspectData, alternativeNote: e.target.value})} placeholder="Explain alternative use..." />
              </div>
            )}
            <div className="form-group">
              <label>Cost Estimate ($) *</label>
              <input type="number" min="0" step="0.01" value={inspectData.costEstimate} onChange={e => setInspectData({...inspectData, costEstimate: Number(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Estimated Time (Hours) *</label>
              <input type="number" min="0" step="0.5" value={inspectData.timeEstimateHours} onChange={e => setInspectData({...inspectData, timeEstimateHours: Number(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Loss Amount ($) (Optional)</label>
              <input type="number" min="0" step="0.01" value={inspectData.lossAmount} onChange={e => setInspectData({...inspectData, lossAmount: e.target.value ? Number(e.target.value) : ''})} />
            </div>
          </div>
        </ActionModal>
      )}
      {modal === 'sm-review' && (
        <ActionModal title="Senior Manager Review" onClose={() => setModal(null)} actionLabel="Submit Review" loading={actionMutation.isPending} onConfirm={() => doAction('sm-review', { 
            ...smData, 
            costEstimate: Number(smData.costEstimate), 
            timeEstimateHours: Number(smData.timeEstimateHours),
            lossAmount: smData.lossAmount ? Number(smData.lossAmount) : undefined,
            forwardToGm: smData.forwardToGm === 'true'
        })}>
          <div className="form-grid">
            <div className="form-group full">
              <label>Loophole Note *</label>
              <textarea value={smData.loopholeNote} onChange={e => setSmData({...smData, loopholeNote: e.target.value})} placeholder="Describe systemic loopholes..." required rows={2} />
            </div>
            <div className="form-group">
              <label>Cost Estimate *</label>
              <input type="number" min="0" value={smData.costEstimate} onChange={e => setSmData({...smData, costEstimate: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Time Estimate (Hours) *</label>
              <input type="number" min="0" value={smData.timeEstimateHours} onChange={e => setSmData({...smData, timeEstimateHours: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Loss Amount (Optional)</label>
              <input type="number" min="0" value={smData.lossAmount} onChange={e => setSmData({...smData, lossAmount: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Forward to GM?</label>
              <select value={smData.forwardToGm} onChange={e => setSmData({...smData, forwardToGm: e.target.value})}>
                <option value="true">Yes, Forward to GM</option>
                <option value="false">No, Reject Report</option>
              </select>
            </div>
            <div className="form-group full" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={smData.biasedFlag} onChange={e => setSmData({...smData, biasedFlag: e.target.checked})} id="biasedFlag" />
              <label htmlFor="biasedFlag" style={{ margin: 0 }}>Mark as Biased / Conflict of Interest</label>
            </div>
            <div className="form-group full">
              <label>Decision Note *</label>
              <textarea value={smData.decisionNote} onChange={e => setSmData({...smData, decisionNote: e.target.value})} placeholder="Provide final decision notes..." required rows={2} />
            </div>
          </div>
        </ActionModal>
      )}
      {modal === 'gm-approve' && (
        <ActionModal title="Approve Report" onClose={() => setModal(null)} actionLabel="Approve" loading={actionMutation.isPending} onConfirm={() => doAction('gm-approve', { approved: true, notes })}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Are you sure you want to approve this defect report?</p>
          <div className="form-group"><label>Notes (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add approval notes…" /></div>
        </ActionModal>
      )}
      {modal === 'gm-reject' && (
        <ActionModal title="Reject Report" onClose={() => setModal(null)} actionLabel="Reject" variant="danger" loading={actionMutation.isPending} onConfirm={() => doAction('gm-approve', { approved: false, notes })}>
          <div className="form-group"><label>Reason for Rejection *</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explain why this report is being rejected…" required /></div>
        </ActionModal>
      )}
    </>
  );
}
