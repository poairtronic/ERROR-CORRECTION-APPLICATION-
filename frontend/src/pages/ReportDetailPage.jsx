import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiPrinter, FiImage, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import Dialog from '../components/ui/Dialog';

import { STATUS_COLORS, STATUS_LABELS, PROCESS_TEMPLATES, getActiveStages, sumStageCosts } from '../utils/constants';

function ActionModal({ title, onClose, onConfirm, actionLabel, variant = 'success', children, loading = false }) {
  return (
    <Dialog open={true} onClose={onClose} title={title}>
      <form onSubmit={(e) => { e.preventDefault(); onConfirm(); }} style={{ minWidth: 400 }}>
        {children}
        <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className={`btn btn-${variant}`} disabled={loading}>{loading ? 'Submitting…' : actionLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}

const EMPTY_ARRAY = [];

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role?.toUpperCase();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // 'inspect'|'sm-review'|'gm-approve'|'gm-reject'
  const [notes, setNotes] = useState('');
  const [inspectionMode, setInspectionMode] = useState(null); // 'REWORK' | 'REJECTION' — gates the inspection form

  const { data: report, isLoading: loading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => (await api.get(`/defect-reports/${id}`)).data
  });

  const { data: notifications = EMPTY_ARRAY } = useQuery({
    queryKey: ['report-notifications', id],
    queryFn: async () => (await api.get(`/notifications/report/${id}`)).data
  });

  const { data: vendors = EMPTY_ARRAY } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get('/master-data/vendors')).data
  });

  const { data: operators = EMPTY_ARRAY } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      try {
        return (await api.get('/master-data/operators')).data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const { data: components = EMPTY_ARRAY } = useQuery({
    queryKey: ['components'],
    queryFn: async () => {
      try {
        return (await api.get('/master-data/components')).data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const { data: errorTypes = EMPTY_ARRAY } = useQuery({
    queryKey: ['error-types'],
    queryFn: async () => {
      try {
        return (await api.get('/master-data/error-types')).data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ endpoint, body }) => api.patch(`/defect-reports/${id}/${endpoint}`, body),
    onSuccess: () => {
      toast.success('Action completed successfully!');
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Action failed'));
    }
  });
  const [inspectData, setInspectData] = useState({
    errorType: '', rootCause: '', responsibleParty: '', decision: '',
    responsibleId: '', responsibleName: '', alternativeNote: '', costEstimate: '', timeEstimateHours: '', lossAmount: '', reworkDescription: '',
    rejectionProcessTemplate: '', rejectionFailedStage: '', rejectionStageCosts: {}, rejectionDescription: ''
  });

  const [smData, setSmData] = useState({
    loopholeNote: '', costEstimate: '', timeEstimateHours: '',
    lossAmount: '', decisionNote: '', biasedFlag: false, forwardToGm: 'true'
  });

  const [accountsData, setAccountsData] = useState({
    materialCost: '',
    labourCost: '',
    otherCost: '',
    costEstimate: '',
    lossAmount: '',
    costRemarks: ''
  });

  const openAccountsReviewModal = () => {
    setAccountsData({
      materialCost: report.inspectionDetail?.materialCost ?? 0,
      labourCost: report.inspectionDetail?.labourCost ?? 0,
      otherCost: report.inspectionDetail?.otherCost ?? 0,
      costEstimate: report.inspectionDetail?.costEstimate ?? 0,
      lossAmount: report.inspectionDetail?.lossAmount ?? '',
      costRemarks: report.inspectionDetail?.costRemarks ?? ''
    });
    setModal('accounts-review');
  };

  const handleAccountsFieldChange = (field, val) => {
    setAccountsData(d => {
      const updated = { ...d, [field]: val };
      const mat = updated.materialCost === '' ? 0 : Math.round(Number(updated.materialCost)) || 0;
      const lab = updated.labourCost === '' ? 0 : Math.round(Number(updated.labourCost)) || 0;
      const oth = updated.otherCost === '' ? 0 : Math.round(Number(updated.otherCost)) || 0;
      updated.costEstimate = String(mat + lab + oth);
      return updated;
    });
  };

  const handleAccountsSave = async () => {
    try {
      const mat = accountsData.materialCost === '' ? 0 : Math.round(Number(accountsData.materialCost)) || 0;
      const lab = accountsData.labourCost === '' ? 0 : Math.round(Number(accountsData.labourCost)) || 0;
      const oth = accountsData.otherCost === '' ? 0 : Math.round(Number(accountsData.otherCost)) || 0;
      const loss = accountsData.lossAmount === '' ? '' : Math.round(Number(accountsData.lossAmount)) || 0;
      const tot = accountsData.costEstimate === '' ? (mat + lab + oth) : Math.round(Number(accountsData.costEstimate)) || 0;

      // 1. Save costs
      await api.patch(`/defect-reports/${id}/fields`, {
        fields: [
          { field: 'materialCost', value: String(mat) },
          { field: 'labourCost', value: String(lab) },
          { field: 'otherCost', value: String(oth) },
          { field: 'costEstimate', value: String(tot) },
          { field: 'lossAmount', value: String(loss) },
          { field: 'costRemarks', value: accountsData.costRemarks || 'Verified' }
        ]
      });

      // 2. Submit to SM directly with NO alert popup
      await api.patch(`/defect-reports/${id}/status`, { 
        status: 'PENDING_SM_REVIEW', 
        note: accountsData.costRemarks || 'Financial verification completed' 
      });

      toast.success('Report verified and submitted to Senior Manager successfully');
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify and submit report');
    }
  };

  useEffect(() => {
    if (report) {
      const respParty = report.inspectionDetail?.responsibleParty || '';
      const respId = report.inspectionDetail?.responsibleId || '';
      let respName = '';
      if (respParty === 'OPERATOR') {
        respName = operators.find(o => o.id === respId)?.name || '';
      } else if (respParty === 'VENDOR') {
        respName = vendors.find(v => v.id === respId)?.name || '';
      }
      setInspectData({
        errorType: report.inspectionDetail?.errorType || '',
        rootCause: report.inspectionDetail?.rootCause || '',
        responsibleParty: respParty,
        decision: report.inspectionDetail?.decision || '',
        responsibleId: respId,
        responsibleName: respName,
        alternativeNote: report.inspectionDetail?.alternativeNote || '',
        costEstimate: report.inspectionDetail?.costEstimate || 0,
        timeEstimateHours: report.inspectionDetail?.timeEstimateHours || '',
        lossAmount: report.inspectionDetail?.lossAmount || '',
        reworkDescription: report.inspectionDetail?.reworkDescription || report.reworkDescription || '',
        rejectionProcessTemplate: report.rejectionProcessTemplate || '',
        rejectionFailedStage: report.rejectionFailedStage || '',
        rejectionStageCosts: report.rejectionStageCosts || {},
        rejectionDescription: report.inspectionDetail?.rejectionDescription || report.rejectionDescription || ''
      });
      if (report.inspectionType) {
        setInspectionMode(report.inspectionType);
      }
    }
  }, [report, operators, vendors]);

  const handleInspectTemplateChange = (template) => {
    setInspectData(d => ({
      ...d,
      rejectionProcessTemplate: template,
      rejectionFailedStage: '',
      rejectionStageCosts: {},
      costEstimate: 0
    }));
  };

  const handleInspectFailedStageChange = (stage) => {
    setInspectData(d => {
      const activeStages = getActiveStages(d.rejectionProcessTemplate, stage);
      const newCosts = {};
      activeStages.forEach(st => { newCosts[st] = d.rejectionStageCosts[st] || ''; });
      return {
        ...d,
        rejectionFailedStage: stage,
        rejectionStageCosts: newCosts,
        costEstimate: sumStageCosts(activeStages, newCosts)
      };
    });
  };

  const handleInspectStageCostChange = (stage, val) => {
    const numericVal = val === '' ? '' : Math.round(Number(val));
    setInspectData(d => {
      const newCosts = { ...d.rejectionStageCosts, [stage]: numericVal };
      const activeStages = getActiveStages(d.rejectionProcessTemplate, d.rejectionFailedStage);
      return { ...d, rejectionStageCosts: newCosts, costEstimate: sumStageCosts(activeStages, newCosts) };
    });
  };
  const openSmReviewModal = () => {
    setSmData({
      loopholeNote: report.smReview?.loopholeNote || '', 
      costEstimate: report.inspectionDetail?.costEstimate ?? '', 
      timeEstimateHours: report.inspectionDetail?.timeEstimateHours ?? '',
      lossAmount: report.inspectionDetail?.lossAmount ?? '', 
      decisionNote: report.smReview?.decisionNote || '', 
      biasedFlag: report.smReview?.biasedFlag || false, 
      forwardToGm: 'true',
      rejectionStageCosts: report.rejectionStageCosts || report.inspectionDetail?.rejectionStageCosts || {}
    });
    setModal('sm-review');
  };

  const doAction = (endpoint, body) => {
    actionMutation.mutate({ endpoint, body });
  };

  const handleInspectSubmit = () => {
    const isRework = inspectionMode === 'REWORK';
    const body = {
      ...inspectData,
      inspectionType: inspectionMode,
      errorType: isRework ? 'Rework' : 'Rejection',
      rootCause: isRework ? 'Rework' : 'Rejection',
      decision: isRework ? 'REWORK' : 'SCRAP',
      timeEstimateHours: inspectData.timeEstimateHours ? Number(inspectData.timeEstimateHours) : undefined,
      costEstimate: Number(inspectData.costEstimate) || 0,
      lossAmount: inspectData.lossAmount ? Number(inspectData.lossAmount) : undefined,
      reworkDescription: isRework ? inspectData.reworkDescription : undefined,
      rejectionProcessTemplate: !isRework ? inspectData.rejectionProcessTemplate : undefined,
      rejectionFailedStage: !isRework ? inspectData.rejectionFailedStage : undefined,
      rejectionStageCosts: !isRework ? inspectData.rejectionStageCosts : undefined,
      rejectionDescription: !isRework ? inspectData.rejectionDescription : undefined,
    };
    delete body.responsibleName;
    doAction('inspect', body);
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

  const handleEditRejectionStageCostsSave = async () => {
    try {
      const parsedCosts = JSON.parse(editValue || '{}');
      const template = report.rejectionProcessTemplate || report.inspectionDetail?.rejectionProcessTemplate;
      const failedStage = report.rejectionFailedStage || report.inspectionDetail?.rejectionFailedStage || report.stageOfFailure;
      const stages = PROCESS_TEMPLATES[template] || [];
      const idx = stages.indexOf(failedStage);
      const activeStages = idx !== -1 ? stages.slice(0, idx + 1) : [];
      const total = activeStages.reduce((sum, st) => sum + (Number(parsedCosts[st]) || 0), 0);

      await api.patch(`/defect-reports/${id}/field`, { field: 'rejectionStageCosts', value: editValue });
      await api.patch(`/defect-reports/${id}/field`, { field: 'costEstimate', value: String(total) });

      toast.success('Stage-wise costs and total cost updated successfully');
      setEditingField(null);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage-wise costs');
    }
  };

  const canEdit = (fieldKey) => {
    if (!fieldKey) return false;
    if (role === 'GENERAL_MANAGER' && status === 'PENDING_GM_APPROVAL') {
      const gmAllowed = ['costEstimate', 'stageOfFailure', 'rejectionStageCosts', 'lossAmount', 'componentName', 'errorTypeName'];
      return gmAllowed.includes(fieldKey);
    }
    if (role === 'SENIOR_MANAGER' && status === 'PENDING_SM_REVIEW') {
      const smAllowed = ['defectDescription', 'stageOfFailure', 'errorType', 'rootCause', 'decision', 'loopholeNote', 'costEstimate', 'timeEstimateHours', 'lossAmount', 'decisionNote', 'rejectionStageCosts', 'componentName', 'errorTypeName'];
      return smAllowed.includes(fieldKey);
    }
    if (role === 'ACCOUNTS' && status === 'PENDING_ACCOUNTS_REVIEW') {
      const accountsAllowed = ['materialCost', 'labourCost', 'otherCost', 'lossAmount', 'costRemarks', 'costEstimate', 'rejectionStageCosts', 'componentName', 'errorTypeName'];
      return accountsAllowed.includes(fieldKey);
    }
    return false;
  };

  const inspectSelectedTemplateStages = inspectData.rejectionProcessTemplate ? (PROCESS_TEMPLATES[inspectData.rejectionProcessTemplate] || []) : [];
  const inspectFailedStageIndex = inspectSelectedTemplateStages.indexOf(inspectData.rejectionFailedStage);
  const inspectStagesUpToFailure = inspectFailedStageIndex !== -1 ? inspectSelectedTemplateStages.slice(0, inspectFailedStageIndex + 1) : [];

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
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            Report <span className={`badge badge-${STATUS_COLORS[status] || 'draft'}`}>{STATUS_LABELS[status] || status}</span>
            {report.componentsIssued && <span className="badge badge-success">Components Issued</span>}
            {report.inspectionType && (
              <span className="badge" style={{
                background: report.inspectionType === 'REWORK' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: report.inspectionType === 'REWORK' ? '#16a34a' : '#dc2626',
                border: `1px solid ${report.inspectionType === 'REWORK' ? '#22c55e33' : '#ef444433'}`,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.5px'
              }}>
                {report.inspectionType === 'REWORK' ? '🟢' : '🔴'} {report.inspectionType}
              </span>
            )}
            {report.smReview?.biasedFlag && (
              <span className="badge badge-danger" style={{ background: '#ef4444', color: '#ffffff' }}>
                ⚠️ BIASED / CONFLICT OF INTEREST
              </span>
            )}
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>ID: {report.reportNumber}</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={() => window.print()}><FiPrinter /> Print</button>
          {role === 'INSPECTOR' && status === 'PENDING_INSPECTION' && !inspectionMode && (
            <button className="btn btn-success" onClick={() => setModal('inspect-decision')}><FiCheckCircle /> Begin Inspection</button>
          )}
          {role === 'INSPECTOR' && status === 'PENDING_INSPECTION' && inspectionMode && (
            <button className="btn btn-success" onClick={() => setModal('inspect')}><FiCheckCircle /> Submit {inspectionMode} Inspection</button>
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
          {role === 'STORE_MANAGER' && status === 'APPROVED' && !report.componentsIssued && (
            <button className="btn btn-success" onClick={() => setModal('issue-components')}><FiCheckCircle /> Issue Components</button>
          )}
          {role === 'ACCOUNTS' && status === 'PENDING_ACCOUNTS_REVIEW' && (
            <button className="btn btn-success" onClick={openAccountsReviewModal}><FiCheckCircle /> Verify & Submit to SM</button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="detail-grid">
          <div className="card">
            <div className="card-title">Report Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(report.inspectionType === 'REWORK' ? [
                ['Description', report.defectDescription, 'defectDescription'],
                ['Component', report.componentName || '—', 'componentName'],
                ['Error Type', report.errorTypeName || report.inspectionDetail?.errorType || '—', 'errorTypeName'],
                ['SC Number', report.scNo || '—', 'scNo'],
                ['PO Number', report.poNo || '—', 'poNo'],
                ['Stage of Failure', report.stageOfFailure || '—', 'stageOfFailure'],
                ['Quantity Affected', report.quantity || '—', 'quantity'],
                ['Responsible Party', report.inspectionDetail?.responsibleParty || '—', 'responsibleParty'],
                ['Operator / Vendor Name', report.inspectionDetail?.responsibleId ? (
                  report.inspectionDetail.responsibleParty === 'OPERATOR' 
                    ? (operators.find(o => o.id === report.inspectionDetail.responsibleId)?.name || report.inspectionDetail.responsibleId)
                    : (vendors.find(v => v.id === report.inspectionDetail.responsibleId)?.name || report.inspectionDetail.responsibleId)
                ) : '—', 'responsibleId'],
                ['Rework Description', report.inspectionDetail?.reworkDescription || report.reworkDescription || '—', 'reworkDescription'],
                ['Cost Estimation', report.inspectionDetail?.costEstimate !== undefined ? `$${report.inspectionDetail.costEstimate}` : '—', 'costEstimate'],
                ['Material Cost', report.inspectionDetail?.materialCost !== undefined ? `$${report.inspectionDetail.materialCost}` : '—', 'materialCost'],
                ['Labour Cost', report.inspectionDetail?.labourCost !== undefined ? `$${report.inspectionDetail.labourCost}` : '—', 'labourCost'],
                ['Other Cost', report.inspectionDetail?.otherCost !== undefined ? `$${report.inspectionDetail.otherCost}` : '—', 'otherCost'],
                ['Details Description', report.inspectionDetail?.costRemarks || '—', 'costRemarks'],
                ['Loss Estimation', report.inspectionDetail?.lossAmount !== null && report.inspectionDetail?.lossAmount !== undefined ? `$${report.inspectionDetail.lossAmount}` : '—', 'lossAmount'],
                ['Alternative Notes', report.inspectionDetail?.alternativeNote || '—', 'alternativeNote'],
                ['Raised By', report.raisedBy?.name || '—', undefined],
                ['Date Raised', new Date(report.createdAt).toLocaleString('en-IN'), undefined],
              ] : [
                ['Description', report.defectDescription, 'defectDescription'],
                ['Component', report.componentName || '—', 'componentName'],
                ['Error Type', report.errorTypeName || report.inspectionDetail?.errorType || '—', 'errorTypeName'],
                ['SC Number', report.scNo || '—', 'scNo'],
                ['PO Number', report.poNo || '—', 'poNo'],
                ['Stage of Failure', (
                  <div key="stage-failure">
                    <strong>{report.rejectionFailedStage || report.inspectionDetail?.rejectionFailedStage || report.stageOfFailure || '—'}</strong> 
                    {(report.rejectionProcessTemplate || report.inspectionDetail?.rejectionProcessTemplate) && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>({report.rejectionProcessTemplate || report.inspectionDetail?.rejectionProcessTemplate})</span>}
                    {(report.rejectionStageCosts || report.inspectionDetail?.rejectionStageCosts) && Object.keys(report.rejectionStageCosts || report.inspectionDetail?.rejectionStageCosts).length > 0 && (
                      <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)', maxWidth: 300 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>Stage-wise Cost Breakdown</div>
                        {Object.entries(report.rejectionStageCosts || report.inspectionDetail?.rejectionStageCosts).map(([stage, cost]) => (
                          <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '2px 0' }}>
                            <span>{stage}:</span>
                            <strong>${cost}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ), 'rejectionStageCosts'],
                ['Quantity Affected', report.quantity || '—', 'quantity'],
                ['Responsible Party', report.inspectionDetail?.responsibleParty || '—', 'responsibleParty'],
                ['Operator / Vendor Name', report.inspectionDetail?.responsibleId ? (
                  report.inspectionDetail.responsibleParty === 'OPERATOR' 
                    ? (operators.find(o => o.id === report.inspectionDetail.responsibleId)?.name || report.inspectionDetail.responsibleId)
                    : (vendors.find(v => v.id === report.inspectionDetail.responsibleId)?.name || report.inspectionDetail.responsibleId)
                ) : '—', 'responsibleId'],
                ['Rejection Description', report.inspectionDetail?.rejectionDescription || report.rejectionDescription || '—', 'rejectionDescription'],
                ['Cost Estimation', report.inspectionDetail?.costEstimate !== undefined ? `$${report.inspectionDetail.costEstimate}` : '—', 'costEstimate'],
                ['Material Cost', report.inspectionDetail?.materialCost !== undefined ? `$${report.inspectionDetail.materialCost}` : '—', 'materialCost'],
                ['Labour Cost', report.inspectionDetail?.labourCost !== undefined ? `$${report.inspectionDetail.labourCost}` : '—', 'labourCost'],
                ['Other Cost', report.inspectionDetail?.otherCost !== undefined ? `$${report.inspectionDetail.otherCost}` : '—', 'otherCost'],
                ['Details Description', report.inspectionDetail?.costRemarks || '—', 'costRemarks'],
                ['Loss Estimation', report.inspectionDetail?.lossAmount !== null && report.inspectionDetail?.lossAmount !== undefined ? `$${report.inspectionDetail.lossAmount}` : '—', 'lossAmount'],
                ['Alternative Notes', report.inspectionDetail?.alternativeNote || '—', 'alternativeNote'],
                ['Raised By', report.raisedBy?.name || '—', undefined],
                ['Date Raised', new Date(report.createdAt).toLocaleString('en-IN'), undefined],
              ]).concat(report.componentsIssued ? [
                ['Components Issued On', new Date(report.componentsIssuedAt).toLocaleString('en-IN'), undefined],
                ['Issue Remarks', report.issueRemarks || '—', undefined]
              ] : []).concat(status === 'APPROVED' || report.accountsDescription ? [
                ['Accounts Description', report.accountsDescription || '—', 'accountsDescription']
              ] : []).concat(report.smReview?.biasedFlag ? [
                ['Biased / Conflict of Interest', <span key="biased-yes" style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ Yes (Flagged)</span>, undefined]
              ] : []).concat(report.gmApproval ? [
                ['GM Remarks', report.gmApproval.remarks || '—', undefined]
              ] : []).map(([label, value, fieldKey]) => (
                <div key={label} className="detail-field-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="detail-label">{label}</div>
                    {editingField === fieldKey ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, width: '100%' }}>
                        {fieldKey === 'rejectionStageCosts' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Edit Stage Costs</div>
                            {(() => {
                              const template = report.rejectionProcessTemplate || report.inspectionDetail?.rejectionProcessTemplate;
                              const failedStage = report.rejectionFailedStage || report.inspectionDetail?.rejectionFailedStage || report.stageOfFailure;
                              const stages = PROCESS_TEMPLATES[template] || [];
                              const idx = stages.indexOf(failedStage);
                              const activeStages = idx !== -1 ? stages.slice(0, idx + 1) : [];
                              let currentCosts = {};
                              try {
                                currentCosts = JSON.parse(editValue || '{}');
                              } catch (e) {
                                console.warn('Failed to parse editValue:', e);
                              }
                              
                              return (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {activeStages.map(st => (
                                      <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st}:</span>
                                        <input 
                                          type="number" 
                                          min="0" 
                                          step="1" 
                                          className="form-control"
                                          style={{ height: 32, padding: '4px 8px', fontSize: 12 }}
                                          value={currentCosts[st] ?? ''} 
                                          onChange={e => {
                                            const val = e.target.value;
                                            const numericVal = val === '' ? '' : Math.round(Number(val));
                                            const updatedCosts = { ...currentCosts, [st]: numericVal };
                                            setEditValue(JSON.stringify(updatedCosts));
                                          }}
                                          placeholder="Cost ($)"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                    <span>Calculated Total Cost:</span>
                                    <span>${activeStages.reduce((sum, st) => sum + (Number(currentCosts[st]) || 0), 0).toFixed(2)}</span>
                                  </div>
                                </>
                              );
                            })()}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                              <button type="button" className="btn btn-success btn-sm" onClick={() => handleEditRejectionStageCostsSave()}><FiSave /> Save</button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}><FiX /> Cancel</button>
                            </div>
                          </div>
                        ) : fieldKey === 'accountsDescription' ? (
                          <textarea className="form-control" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, minHeight: 60 }} rows={3} />
                        ) : fieldKey === 'componentName' ? (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input 
                              list="edit-component-list" 
                              className="form-control" 
                              autoFocus 
                              value={editValue} 
                              onChange={e => setEditValue(e.target.value)} 
                              style={{ width: '100%' }} 
                            />
                            <datalist id="edit-component-list">
                              {components.map(c => <option key={c.id} value={c.name} />)}
                            </datalist>
                          </div>
                        ) : fieldKey === 'errorTypeName' ? (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input 
                              list="edit-errortype-list" 
                              className="form-control" 
                              autoFocus 
                              value={editValue} 
                              onChange={e => setEditValue(e.target.value)} 
                              style={{ width: '100%' }} 
                            />
                            <datalist id="edit-errortype-list">
                              {errorTypes.map(et => <option key={et.id} value={et.name} />)}
                            </datalist>
                          </div>
                        ) : (
                          <input className="form-control" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1 }} />
                        )}
                        {fieldKey !== 'rejectionStageCosts' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleEditSave(fieldKey)}><FiSave /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}><FiX /></button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="detail-value">{value}</div>
                    )}
                  </div>
                  {canEdit(fieldKey) && editingField !== fieldKey && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { 
                      setEditingField(fieldKey); 
                      const rawValue = fieldKey === 'costEstimate' 
                        ? report.inspectionDetail?.costEstimate 
                        : fieldKey === 'lossAmount' 
                        ? report.inspectionDetail?.lossAmount 
                        : fieldKey === 'materialCost'
                        ? report.inspectionDetail?.materialCost
                        : fieldKey === 'labourCost'
                        ? report.inspectionDetail?.labourCost
                        : fieldKey === 'otherCost'
                        ? report.inspectionDetail?.otherCost
                        : fieldKey === 'costRemarks'
                        ? report.inspectionDetail?.costRemarks
                        : fieldKey === 'rejectionStageCosts'
                        ? JSON.stringify(report.rejectionStageCosts || report.inspectionDetail?.rejectionStageCosts || {})
                        : value === '—' ? '' : value;
                      setEditValue(rawValue !== undefined && rawValue !== null ? String(rawValue) : ''); 
                    }}>
                      <FiEdit2 />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sequential Workflow Notes Card */}
          {(() => {
            const commentsTimeline = [];

            // 1. Inspector comments
            const inspectorDesc = report.inspectionDetail?.reworkDescription || report.inspectionDetail?.rejectionDescription || report.reworkDescription || report.rejectionDescription;
            if (inspectorDesc && inspectorDesc !== '—') {
              commentsTimeline.push({
                role: 'Inspector',
                title: '1. Inspector Review Remarks',
                content: inspectorDesc,
                date: report.inspectionDetail?.reviewedAt || report.createdAt,
              });
            }

            // 2. Accounts verification remarks
            const accountsDesc = report.accountsDescription || report.inspectionDetail?.costRemarks;
            const hasAccountsDesc = accountsDesc && accountsDesc !== '—' && accountsDesc !== 'Verified';
            if (hasAccountsDesc) {
              commentsTimeline.push({
                role: 'Accounts',
                title: '2. Accounts Details Description',
                content: accountsDesc,
                date: report.inspectionDetail?.reviewedAt || report.updatedAt,
              });
            }

            // 3. Senior Manager decision note
            if (report.smReview) {
              const loophole = report.smReview.loopholeNote ? `\nLoophole Identified: ${report.smReview.loopholeNote}` : '';
              commentsTimeline.push({
                role: 'Senior Manager',
                title: '3. Senior Manager Decision Remarks',
                content: `${report.smReview.decisionNote || (report.smReview.forwardedToGm ? 'Forwarded to GM' : 'Rejected')}${loophole}`,
                date: report.smReview.reviewedAt,
              });
            }

            // 4. General Manager approval remarks
            if (report.gmApproval) {
              commentsTimeline.push({
                role: 'General Manager',
                title: '4. General Manager Decision Remarks',
                content: report.gmApproval.remarks || (report.gmApproval.approved ? 'Approved' : 'Rejected'),
                date: report.gmApproval.approvedAt,
              });
            }

            if (commentsTimeline.length === 0) return null;

            return (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-title">Approval & Verification Comments (Sequential)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {commentsTimeline.map((c, i) => (
                    <div key={i} style={{ borderBottom: i < commentsTimeline.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < commentsTimeline.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{c.title}</strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {c.date ? new Date(c.date).toLocaleString('en-IN') : ''}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

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

          <div className="card no-print" style={{ marginTop: 20 }}>
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
                      <div className="timeline-event">{log.actionType}</div>
                      <div className="timeline-time">{new Date(log.timestamp).toLocaleString('en-IN')} · {log.actor?.name || log.actorRole}</div>
                      {log.notes && <div className="timeline-note">{log.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div className="icon">📝</div><p>No audit trail yet.</p></div>
            )}
          </div>

          <div className="card no-print" style={{ marginTop: 20 }}>
            <div className="card-title">Notification Timeline</div>
            {notifications.length > 0 ? (
              <div className="timeline">
                {notifications.map((notif, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-line">
                      <div className="timeline-dot" style={{ background: notif.status === 'DELIVERED' ? '#4ade80' : notif.status === 'FAILED' ? '#f87171' : 'var(--primary)' }} />
                      <div className="timeline-line-bar" />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-event" style={{ fontSize: '13px' }}>
                        {notif.type} 
                        <span style={{ marginLeft: 8, fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                          Status: {notif.status} | Read: {notif.read ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="timeline-time">{new Date(notif.createdAt).toLocaleString('en-IN')}</div>
                      <div className="timeline-note" style={{ fontSize: '12px' }}>{notif.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div className="icon">📭</div><p>No notifications recorded.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Inspector Decision Screen */}
      {modal === 'inspect-decision' && (
        <Dialog open={true} onClose={() => setModal(null)} title="Inspection Decision">
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>Choose how this report should be processed.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 420 }}>
            <button
              type="button"
              onClick={() => { setInspectionMode('REWORK'); setModal('inspect'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '24px 20px',
                background: 'rgba(34,197,94,0.06)', border: '2px solid #22c55e33', borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.background = 'rgba(34,197,94,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#22c55e33'; e.currentTarget.style.background = 'rgba(34,197,94,0.06)'; }}
            >
              <span style={{ fontSize: 32 }}>🔧</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>REWORK</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Repair / Correct and Continue Production</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setInspectionMode('REJECTION'); setModal('inspect'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '24px 20px',
                background: 'rgba(239,68,68,0.06)', border: '2px solid #ef444433', borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#ef444433'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            >
              <span style={{ fontSize: 32 }}>❌</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>REJECTION</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Reject Component / Material Entirely</div>
              </div>
            </button>
          </div>
        </Dialog>
      )}
      {/* Inspect Modal */}
      {modal === 'inspect' && (
        <ActionModal title={`Inspector Review — ${inspectionMode || 'Review'}`} onClose={() => { setModal(null); setInspectionMode(null); }} actionLabel="Submit Review" loading={actionMutation.isPending} onConfirm={handleInspectSubmit}>
          {inspectionMode === 'REWORK' ? (
            <div className="form-grid">
              <div className="form-group">
                <label>Responsible Party *</label>
                <select value={inspectData.responsibleParty} onChange={e => setInspectData({...inspectData, responsibleParty: e.target.value, responsibleId: '', responsibleName: ''})} required>
                  <option value="">Select Party</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </div>
              {inspectData.responsibleParty === 'OPERATOR' && (
                <div className="form-group">
                  <label>Operator Name *</label>
                  <input 
                    list="inspect-operator-names" 
                    value={inspectData.responsibleName || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = operators.find(o => o.name === val);
                      setInspectData({
                        ...inspectData,
                        responsibleName: val,
                        responsibleId: match ? match.id : ''
                      });
                    }}
                    placeholder="Type or select operator..."
                    required
                  />
                  <datalist id="inspect-operator-names">
                    {operators.map(o => <option key={o.id} value={o.name} />)}
                  </datalist>
                </div>
              )}
              {inspectData.responsibleParty === 'VENDOR' && (
                <div className="form-group">
                  <label>Vendor Name *</label>
                  <input 
                    list="inspect-vendor-names" 
                    value={inspectData.responsibleName || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = vendors.find(v => v.name === val);
                      setInspectData({
                        ...inspectData,
                        responsibleName: val,
                        responsibleId: match ? match.id : ''
                      });
                    }}
                    placeholder="Type or select vendor..."
                    required
                  />
                  <datalist id="inspect-vendor-names">
                    {vendors.map(v => <option key={v.id} value={v.name} />)}
                  </datalist>
                </div>
              )}
              <div className="form-group full">
                <label>Rework Description *</label>
                <textarea value={inspectData.reworkDescription} onChange={e => setInspectData({...inspectData, reworkDescription: e.target.value})} placeholder="Describe the rework in detail…" required rows={4} />
              </div>
              <div className="form-group">
                <label>Error Type (Optional)</label>
                <input 
                  list="inspect-errortype-list" 
                  value={inspectData.errorType || ''} 
                  onChange={e => setInspectData({...inspectData, errorType: e.target.value})} 
                  placeholder="Select or type error type..." 
                />
                <datalist id="inspect-errortype-list">
                  {errorTypes.map(et => <option key={et.id} value={et.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Cost Estimation ($) *</label>
                <input type="number" min="0" step="1" value={inspectData.costEstimate} onChange={e => setInspectData({...inspectData, costEstimate: e.target.value ? Math.round(Number(e.target.value)) : ''})} required />
              </div>
              <div className="form-group">
                <label>Loss Estimation ($) (Optional)</label>
                <input type="number" min="0" step="1" value={inspectData.lossAmount} onChange={e => setInspectData({...inspectData, lossAmount: e.target.value ? Math.round(Number(e.target.value)) : ''})} />
              </div>
              <div className="form-group full">
                <label>Alternative Notes (Optional)</label>
                <textarea value={inspectData.alternativeNote} onChange={e => setInspectData({...inspectData, alternativeNote: e.target.value})} placeholder="Alternative notes or remarks..." rows={2} />
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-group">
                <label>Responsible Party *</label>
                <select value={inspectData.responsibleParty} onChange={e => setInspectData({...inspectData, responsibleParty: e.target.value, responsibleId: '', responsibleName: ''})} required>
                  <option value="">Select Party</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </div>
              {inspectData.responsibleParty === 'OPERATOR' && (
                <div className="form-group">
                  <label>Operator Name *</label>
                  <input 
                    list="inspect-operator-names" 
                    value={inspectData.responsibleName || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = operators.find(o => o.name === val);
                      setInspectData({
                        ...inspectData,
                        responsibleName: val,
                        responsibleId: match ? match.id : ''
                      });
                    }}
                    placeholder="Type or select operator..."
                    required
                  />
                  <datalist id="inspect-operator-names">
                    {operators.map(o => <option key={o.id} value={o.name} />)}
                  </datalist>
                </div>
              )}
              {inspectData.responsibleParty === 'VENDOR' && (
                <div className="form-group">
                  <label>Vendor Name *</label>
                  <input 
                    list="inspect-vendor-names" 
                    value={inspectData.responsibleName || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = vendors.find(v => v.name === val);
                      setInspectData({
                        ...inspectData,
                        responsibleName: val,
                        responsibleId: match ? match.id : ''
                      });
                    }}
                    placeholder="Type or select vendor..."
                    required
                  />
                  <datalist id="inspect-vendor-names">
                    {vendors.map(v => <option key={v.id} value={v.name} />)}
                  </datalist>
                </div>
              )}
              <div className="form-group">
                <label>Process Template *</label>
                <select value={inspectData.rejectionProcessTemplate} onChange={e => handleInspectTemplateChange(e.target.value)} required>
                  <option value="">Select Template...</option>
                  {Object.keys(PROCESS_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Failed Stage *</label>
                <select value={inspectData.rejectionFailedStage} onChange={e => handleInspectFailedStageChange(e.target.value)} required disabled={!inspectData.rejectionProcessTemplate}>
                  <option value="">Select Stage...</option>
                  {inspectSelectedTemplateStages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label>Rejection Description *</label>
                <textarea value={inspectData.rejectionDescription} onChange={e => setInspectData({...inspectData, rejectionDescription: e.target.value})} placeholder="Describe the rejection reasons/details…" required rows={4} />
              </div>
              <div className="form-group">
                <label>Error Type (Optional)</label>
                <input 
                  list="inspect-errortype-list" 
                  value={inspectData.errorType || ''} 
                  onChange={e => setInspectData({...inspectData, errorType: e.target.value})} 
                  placeholder="Select or type error type..." 
                />
                <datalist id="inspect-errortype-list">
                  {errorTypes.map(et => <option key={et.id} value={et.name} />)}
                </datalist>
              </div>

              {/* Stage Costs Entry list */}
              {inspectStagesUpToFailure.length > 0 && (
                <div className="form-group full" style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Process Flow Costs up to Failed Stage</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {inspectStagesUpToFailure.map(st => (
                      <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st}:</span>
                        <input 
                          type="number" 
                          min="0" 
                          step="1" 
                          style={{ height: 32, padding: '4px 8px', fontSize: 13, border: '1px solid var(--border-color)', borderRadius: 4, width: '100%', background: 'var(--bg-card)', color: 'var(--text)' }}
                          value={inspectData.rejectionStageCosts[st] ?? ''} 
                          onChange={e => handleInspectStageCostChange(st, e.target.value)} 
                          required
                          placeholder="Enter cost ($)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Cost Estimation ($) *</label>
                <input type="number" min="0" step="1" value={inspectData.costEstimate} onChange={e => setInspectData({...inspectData, costEstimate: e.target.value ? Math.round(Number(e.target.value)) : ''})} required />
              </div>
              <div className="form-group">
                <label>Loss Estimation ($) (Optional)</label>
                <input type="number" min="0" step="1" value={inspectData.lossAmount} onChange={e => setInspectData({...inspectData, lossAmount: e.target.value ? Math.round(Number(e.target.value)) : ''})} />
              </div>
              <div className="form-group full">
                <label>Alternative Notes (Optional)</label>
                <textarea value={inspectData.alternativeNote} onChange={e => setInspectData({...inspectData, alternativeNote: e.target.value})} placeholder="Alternative notes or remarks..." rows={2} />
              </div>
            </div>
          )}
        </ActionModal>
      )}
      {modal === 'sm-review' && (
        <ActionModal title="Senior Manager Review" onClose={() => setModal(null)} actionLabel="Submit Review" loading={actionMutation.isPending} onConfirm={() => {
          const body = { 
            ...smData, 
            costEstimate: Number(smData.costEstimate), 
            timeEstimateHours: Number(smData.timeEstimateHours),
            lossAmount: smData.lossAmount ? Number(smData.lossAmount) : undefined,
            forwardToGm: smData.forwardToGm === 'true'
          };
          if (            body.rejectionStageCosts && Object.keys(body.rejectionStageCosts).length === 0) {
            delete body.rejectionStageCosts;
          }
          if (!body.timeEstimateHours) delete body.timeEstimateHours;
          doAction('sm-review', body);
        }}>
          <div className="form-grid">
            <div className="form-group full">
              <label>Loophole Note *</label>
              <textarea value={smData.loopholeNote} onChange={e => setSmData({...smData, loopholeNote: e.target.value})} placeholder="Describe systemic loopholes..." required rows={2} />
            </div>

             <div className="form-group">
              <label>Cost Estimate ($) *</label>
              <input type="number" min="0" step="1" value={smData.costEstimate} onChange={e => setSmData({...smData, costEstimate: e.target.value ? Math.round(Number(e.target.value)) : ''})} required />
            </div>

            <div className="form-group">
              <label>Time Estimate (Hours) (Optional)</label>
              <input type="number" min="0" step="1" value={smData.timeEstimateHours} onChange={e => setSmData({...smData, timeEstimateHours: e.target.value ? Math.round(Number(e.target.value)) : ''})} />
            </div>
            <div className="form-group">
              <label>Loss Amount (Optional)</label>
              <input type="number" min="0" step="1" value={smData.lossAmount} onChange={e => setSmData({...smData, lossAmount: e.target.value ? Math.round(Number(e.target.value)) : ''})} />
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
      {modal === 'issue-components' && (
        <ActionModal title="Issue Components" onClose={() => setModal(null)} actionLabel="Confirm Issuance" loading={actionMutation.isPending} onConfirm={() => doAction('issue-components', { remarks: notes })}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Confirm that you have issued the required components for this defect report.</p>
          <div className="form-group"><label>Issue Remarks (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any remarks regarding the issued components…" /></div>
        </ActionModal>
      )}
      {modal === 'accounts-review' && (
        <ActionModal 
          title="Accounts Cost Verification" 
          onClose={() => setModal(null)} 
          actionLabel="Verify & Submit" 
          loading={actionMutation.isPending} 
          onConfirm={handleAccountsSave}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Material Cost ($)</label>
              <input 
                type="number" 
                min="0" 
                step="1" 
                value={accountsData.materialCost} 
                onChange={e => handleAccountsFieldChange('materialCost', e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label>Labour Cost ($)</label>
              <input 
                type="number" 
                min="0" 
                step="1" 
                value={accountsData.labourCost} 
                onChange={e => handleAccountsFieldChange('labourCost', e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Other Cost ($)</label>
              <input 
                type="number" 
                min="0" 
                step="1" 
                value={accountsData.otherCost} 
                onChange={e => handleAccountsFieldChange('otherCost', e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Total Cost ($)</label>
              <input 
                type="number" 
                min="0"
                step="1"
                value={accountsData.costEstimate} 
                onChange={e => setAccountsData({...accountsData, costEstimate: e.target.value})} 
                placeholder="Calculated or manual total cost"
              />
            </div>

            <div className="form-group">
              <label>Loss Amount ($) (Optional)</label>
              <input 
                type="number" 
                min="0" 
                step="1" 
                value={accountsData.lossAmount} 
                onChange={e => setAccountsData({...accountsData, lossAmount: e.target.value})} 
              />
            </div>

            <div className="form-group full">
              <label>Details Description *</label>
              <textarea 
                value={accountsData.costRemarks} 
                onChange={e => setAccountsData({...accountsData, costRemarks: e.target.value})} 
                placeholder="Enter detailed description/remarks..." 
                rows={3} 
                required
              />
            </div>
          </div>
        </ActionModal>
      )}
    </>
  );
}
