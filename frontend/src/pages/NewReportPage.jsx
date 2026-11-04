import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { SIMPLIFIED_WORKFLOW, PROCESS_TEMPLATES, getActiveStages, sumStageCosts } from '../utils/constants';

export default function NewReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  useEffect(() => {
    if (user && !['OPERATOR', 'INSPECTOR', 'SENIOR_MANAGER', 'ADMIN'].includes(user.role?.toUpperCase())) {
      toast.error('You do not have permission to raise a defect report.');
      navigate('/reports', { replace: true });
    }
  }, [user, navigate]);

  const isSimplifiedInspector = (SIMPLIFIED_WORKFLOW && user?.role === 'INSPECTOR') || user?.role === 'ADMIN';

  const [components, setComponents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [operators, setOperators] = useState([]);
  const [errorTypes, setErrorTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(null); // 'REWORK' | 'REJECTION'
  const [formStatus, setFormStatus] = useState(null);
  const [form, setForm] = useState({
    defectDescription: '', quantity: 1, componentId: '', errorTypeId: '', vendorId: '', batchNumber: '', partNumber: '', scOrPoNo: '', stageOfFailure: '',
    scNo: '', poNo: '', reworkDescription: '',
    rejectionProcessTemplate: '', rejectionFailedStage: '', rejectionStageCosts: {}, rejectionDescription: '',
    rootCause: '', responsibleParty: '', responsibleId: '', responsibleName: '', decision: '', alternativeNote: '', costEstimate: '', timeEstimateHours: '', lossAmount: '',
    dcNumber: ''
  });
  const [customStages, setCustomStages] = useState([{ name: '', cost: '' }]);
  const selectedTemplateStages = form.rejectionProcessTemplate ? (PROCESS_TEMPLATES[form.rejectionProcessTemplate] || []) : [];
  const failedStageIndex = selectedTemplateStages.indexOf(form.rejectionFailedStage);
  const stagesUpToFailure = failedStageIndex !== -1 ? selectedTemplateStages.slice(0, failedStageIndex + 1) : [];

  const handleSelectType = (selectedType) => {
    setType(selectedType);
    setForm(f => ({
      ...f,
      decision: selectedType === 'REWORK' ? 'REWORK' : 'SCRAP'
    }));
  };

  const handleBack = () => {
    if (type) {
      setType(null);
    } else {
      navigate(-1);
    }
  };

  useEffect(() => {
    if (isEditMode) {
      api.get(`/defect-reports/${id}`)
        .then(({ data }) => {
          if (data.status !== 'DRAFT' && user?.role !== 'ADMIN') {
            toast.error('Only draft reports can be edited.');
            navigate(`/reports/${id}`, { replace: true });
            return;
          }
          setFormStatus(data.status);
          setType(data.inspectionType || 'REWORK');

          const qty = Number(data.quantity) || 1;
          const rawCosts = data.rejectionStageCosts || data.inspectionDetail?.rejectionStageCosts || {};
          const costEst = Number(data.costEstimate || data.inspectionDetail?.costEstimate) || 0;
          const rawSum = Object.values(rawCosts).reduce((s, v) => s + (Number(v) || 0), 0);
          const isAlreadyMultiplied = qty > 1 && rawSum > 0 && costEst > 0 && Math.abs(rawSum - costEst) <= 2 && (rawSum >= qty * 2);

          const unitStageCosts = {};
          for (const [st, val] of Object.entries(rawCosts)) {
            if (val !== '' && val != null) {
              unitStageCosts[st] = isAlreadyMultiplied ? Math.round(Number(val) / qty) : Math.round(Number(val));
            }
          }

          const isOthers = data.rejectionProcessTemplate === 'OTHERS' || data.inspectionDetail?.rejectionProcessTemplate === 'OTHERS';
          if (isOthers) {
            const entries = Object.entries(unitStageCosts);
            if (entries.length > 0) {
              setCustomStages(entries.map(([name, cost]) => ({ name, cost })));
            } else {
              setCustomStages([{ name: data.rejectionFailedStage || data.inspectionDetail?.rejectionFailedStage || '', cost: unitStageCosts['Others'] || '' }]);
            }
          }

          const activeStages = getActiveStages(
            data.rejectionProcessTemplate || data.inspectionDetail?.rejectionProcessTemplate,
            data.rejectionFailedStage || data.inspectionDetail?.rejectionFailedStage
          );
          const unitSum = isOthers 
            ? Object.values(unitStageCosts).reduce((s, c) => s + (Number(c) || 0), 0)
            : sumStageCosts(activeStages, unitStageCosts);
          const computedCostEstimate = unitSum > 0 ? (unitSum * qty) : (costEst || '');

          setForm({
            defectDescription: data.defectDescription || '',
            quantity: data.quantity || 1,
            componentId: data.componentName || '',
            errorTypeId: data.errorTypeName || '',
            vendorId: data.inspectionDetail?.responsibleParty === 'VENDOR' ? data.inspectionDetail.responsibleId : '',
            batchNumber: data.batchNumber || '',
            partNumber: data.partNumber || '',
            scOrPoNo: data.scOrPoNo || '',
            stageOfFailure: data.stageOfFailure || '',
            scNo: data.scNo || '',
            poNo: data.poNo || '',
            reworkDescription: data.reworkDescription || data.inspectionDetail?.reworkDescription || '',
            rejectionProcessTemplate: data.rejectionProcessTemplate || data.inspectionDetail?.rejectionProcessTemplate || '',
            rejectionFailedStage: data.rejectionFailedStage || data.inspectionDetail?.rejectionFailedStage || '',
            rejectionDescription: data.rejectionDescription || data.inspectionDetail?.rejectionDescription || '',
            rootCause: data.inspectionDetail?.rootCause || '',
            responsibleParty: data.inspectionDetail?.responsibleParty || '',
            responsibleId: data.inspectionDetail?.responsibleId || '',
            responsibleName: '',
            decision: data.inspectionDetail?.decision || '',
            alternativeNote: data.inspectionDetail?.alternativeNote || '',
            costEstimate: computedCostEstimate,
            rejectionStageCosts: unitStageCosts,
            timeEstimateHours: data.inspectionDetail?.timeEstimateHours || '',
            lossAmount: data.inspectionDetail?.lossAmount || '',
            dcNumber: data.inspectionDetail?.dcNumber || ''
          });
        })
        .catch(() => {
          toast.error('Failed to load draft report.');
          navigate('/reports');
        });
    }
  }, [id, isEditMode, navigate, user?.role]);

  useEffect(() => {
    Promise.all([
      api.get('/master-data/components').catch(() => ({ data: [] })),
      api.get('/master-data/vendors').catch(() => ({ data: [] })),
      api.get('/master-data/operators').catch(() => ({ data: [] })),
      api.get('/master-data/error-types').catch(() => ({ data: [] }))
    ]).then(([c, v, o, et]) => { 
      setComponents(c.data || []); 
      setVendors(v.data || []); 
      setOperators(o.data || []);
      setErrorTypes(et.data || []);

      if (isEditMode) {
        setForm(f => {
          let name = '';
          if (f.responsibleParty === 'OPERATOR') {
            const match = (o.data || []).find(op => op.id === f.responsibleId);
            name = match ? match.name : f.responsibleId;
          } else if (f.responsibleParty === 'VENDOR') {
            const match = (v.data || []).find(vn => vn.id === f.responsibleId);
            name = match ? match.name : f.responsibleId;
          } else if (['CUSTOMER', 'MATERIAL', 'INLINE_QUALITY', 'VENDOR_QUALITY', 'DESIGN_TEAM'].includes(f.responsibleParty)) {
            name = f.responsibleId;
          }
          return { ...f, responsibleName: name };
        });
      }
    });
  }, [user, isEditMode]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleQuantityChange = (val) => {
    setForm(f => {
      const isOthers = f.rejectionProcessTemplate === 'OTHERS' || f.rejectionProcessTemplate === 'Others';
      let unitSum = 0;
      if (isOthers) {
        unitSum = customStages.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      } else {
        const activeStages = getActiveStages(f.rejectionProcessTemplate, f.rejectionFailedStage);
        unitSum = sumStageCosts(activeStages, f.rejectionStageCosts);
      }
      const qtyNum = Number(val) || 1;
      const newCostEstimate = unitSum > 0 ? unitSum * qtyNum : f.costEstimate;
      return {
        ...f,
        quantity: val,
        costEstimate: newCostEstimate
      };
    });
  };

  const handleTemplateChange = (template) => {
    if (template === 'OTHERS') {
      const initStages = [{ name: '', cost: '' }];
      setCustomStages(initStages);
      setForm(f => ({
        ...f,
        rejectionProcessTemplate: template,
        rejectionFailedStage: '',
        rejectionStageCosts: {},
        costEstimate: 0
      }));
    } else {
      setForm(f => ({
        ...f,
        rejectionProcessTemplate: template,
        rejectionFailedStage: '',
        rejectionStageCosts: {},
        costEstimate: 0
      }));
    }
  };

  const handleCustomStageChange = (index, field, value) => {
    setCustomStages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === 'cost' ? (value === '' ? '' : Math.round(Number(value))) : value };
      
      const costsMap = {};
      next.forEach(s => {
        const stageName = s.name.trim() || 'Others';
        costsMap[stageName] = s.cost !== '' && s.cost != null ? Number(s.cost) : '';
      });
      const unitSum = next.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      const qty = Number(form.quantity) || 1;
      
      setForm(f => ({
        ...f,
        rejectionFailedStage: next[0]?.name.trim() || f.rejectionFailedStage || 'Others',
        rejectionStageCosts: costsMap,
        costEstimate: unitSum * qty
      }));
      return next;
    });
  };

  const addCustomStage = () => {
    setCustomStages(prev => [...prev, { name: '', cost: '' }]);
  };

  const removeCustomStage = (index) => {
    setCustomStages(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      const costsMap = {};
      next.forEach(s => {
        const stageName = s.name.trim() || 'Others';
        costsMap[stageName] = s.cost !== '' && s.cost != null ? Number(s.cost) : '';
      });
      const unitSum = next.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
      const qty = Number(form.quantity) || 1;
      setForm(f => ({
        ...f,
        rejectionFailedStage: next[0]?.name.trim() || 'Others',
        rejectionStageCosts: costsMap,
        costEstimate: unitSum * qty
      }));
      return next;
    });
  };

  const handleFailedStageChange = (stage) => {
    setForm(f => {
      const activeStages = getActiveStages(f.rejectionProcessTemplate, stage);
      const newCosts = {};
      activeStages.forEach(st => { newCosts[st] = f.rejectionStageCosts[st] || ''; });
      const unitSum = sumStageCosts(activeStages, newCosts);
      const qtyNum = Number(f.quantity) || 1;
      return {
        ...f,
        rejectionFailedStage: stage,
        rejectionStageCosts: newCosts,
        costEstimate: activeStages.length > 0 && unitSum > 0 ? unitSum * qtyNum : 0
      };
    });
  };

  const handleStageCostChange = (stage, val) => {
    const numericVal = val === '' ? '' : Math.round(Number(val));
    setForm(f => {
      const newCosts = { ...f.rejectionStageCosts, [stage]: numericVal };
      const activeStages = getActiveStages(f.rejectionProcessTemplate, f.rejectionFailedStage);
      const unitSum = sumStageCosts(activeStages, newCosts);
      const qtyNum = Number(f.quantity) || 1;
      return { 
        ...f, 
        rejectionStageCosts: newCosts, 
        costEstimate: activeStages.length > 0 && unitSum > 0 ? unitSum * qtyNum : 0 
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isDraftMode = e.nativeEvent?.submitter?.name === 'draft';
    setLoading(true);
    try {
      const isRework = type === 'REWORK';
      const qty = Number(form.quantity) || 1;
      const isOthers = !isRework && (form.rejectionProcessTemplate === 'OTHERS' || form.rejectionProcessTemplate === 'Others');
      const multipliedStageCosts = {};
      if (isOthers) {
        for (const s of customStages) {
          const stageName = s.name.trim() || 'Others';
          if (s.cost !== '' && s.cost != null) {
            multipliedStageCosts[stageName] = Math.round(Number(s.cost) * qty);
          }
        }
        if (Object.keys(multipliedStageCosts).length === 0 && Number(form.costEstimate) > 0) {
          multipliedStageCosts['Others'] = Number(form.costEstimate);
        }
      } else if (!isRework && form.rejectionStageCosts) {
        for (const [st, val] of Object.entries(form.rejectionStageCosts)) {
          multipliedStageCosts[st] = (val !== '' && val != null) ? Math.round(Number(val) * qty) : 0;
        }
      }
      const multipliedStageTotal = Object.values(multipliedStageCosts).reduce((s, v) => s + (Number(v) || 0), 0);
      const finalCostEstimate = !isRework && multipliedStageTotal > 0 ? multipliedStageTotal : (Number(form.costEstimate) || 0);

      const resolvedFailedStage = isOthers
        ? (customStages[0]?.name.trim() || form.rejectionFailedStage || 'Others')
        : form.rejectionFailedStage;

      const body = { 
        ...form, 
        quantity: qty, 
        costEstimate: finalCostEstimate,
        inspectionType: type,
        scOrPoNo: `${form.scNo} / ${form.poNo}`,
        scNo: form.scNo,
        poNo: form.poNo,
        reworkDescription: isRework ? form.reworkDescription : undefined,
        rejectionProcessTemplate: !isRework ? form.rejectionProcessTemplate : undefined,
        rejectionFailedStage: !isRework ? resolvedFailedStage : undefined,
        rejectionStageCosts: !isRework ? multipliedStageCosts : undefined,
        rejectionDescription: !isRework ? form.rejectionDescription : undefined,
        stageOfFailure: isRework ? form.stageOfFailure : resolvedFailedStage,
        isDraft: isDraftMode,
      };
      delete body.responsibleName;
      if (!body.vendorId) delete body.vendorId;

      if (isSimplifiedInspector) {
        if (isRework) {
          body.inlineInspection = {
            errorType: 'Rework',
            rootCause: 'Rework',
            responsibleParty: body.responsibleParty,
            responsibleId: body.responsibleId,
            decision: 'REWORK',
            alternativeNote: body.alternativeNote,
            costEstimate: Number(body.costEstimate) || 0,
            timeEstimateHours: body.timeEstimateHours ? Number(body.timeEstimateHours) : undefined,
            lossAmount: body.lossAmount ? Number(body.lossAmount) : undefined,
            reworkDescription: body.reworkDescription,
            dcNumber: body.responsibleParty === 'VENDOR' ? form.dcNumber : undefined
          };
        } else {
          body.inlineInspection = {
            errorType: 'Rejection',
            rootCause: 'Rejection',
            responsibleParty: body.responsibleParty,
            responsibleId: body.responsibleId,
            decision: 'SCRAP',
            alternativeNote: body.alternativeNote,
            costEstimate: finalCostEstimate,
            timeEstimateHours: body.timeEstimateHours ? Number(body.timeEstimateHours) : undefined,
            lossAmount: body.lossAmount ? Number(body.lossAmount) : undefined,
            rejectionProcessTemplate: body.rejectionProcessTemplate,
            rejectionFailedStage: body.rejectionFailedStage,
            rejectionStageCosts: multipliedStageCosts,
            rejectionDescription: body.rejectionDescription,
            dcNumber: body.responsibleParty === 'VENDOR' ? form.dcNumber : undefined
          };
        }
      }

      // Strip fields not in CreateDefectReportDto
      delete body.rootCause;
      delete body.responsibleParty;
      delete body.responsibleId;
      delete body.decision;
      delete body.alternativeNote;
      delete body.costEstimate;
      delete body.timeEstimateHours;
      delete body.lossAmount;
      delete body.dcNumber;

      let res;
      if (isEditMode) {
        res = await api.patch(`/defect-reports/${id}`, body);
      } else {
        res = await api.post('/defect-reports', body);
      }
      toast.success(isDraftMode ? 'Draft saved successfully!' : (isEditMode ? 'Report updated successfully!' : 'Report raised successfully!'));
      navigate(`/reports/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  if (!type) {
    return (
      <>
        <div className="topbar">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={handleBack} style={{ marginBottom: 4 }}>
              <FiArrowLeft /> Back
            </button>
            <h1>New Defect Report</h1>
            <p>Select the type of error correction report to create</p>
          </div>
        </div>

        <div className="page-content">
          <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: 20 }}>Select Report Type</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button
                type="button"
                onClick={() => handleSelectType('REWORK')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '24px 20px',
                  background: 'rgba(34,197,94,0.06)', border: '2px solid #22c55e33', borderRadius: 12,
                  cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.background = 'rgba(34,197,94,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#22c55e33'; e.currentTarget.style.background = 'rgba(34,197,94,0.06)'; }}
              >
                <span style={{ fontSize: 32 }}>🔧</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>REWORK</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Raise report for rework / correction of a component</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectType('REJECTION')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '24px 20px',
                  background: 'rgba(239,68,68,0.06)', border: '2px solid #ef444433', borderRadius: 12,
                  cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#ef444433'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
              >
                <span style={{ fontSize: 32 }}>❌</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>REJECTION</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Raise report to reject a component or material entirely</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={handleBack} style={{ marginBottom: 4 }}>
            <FiArrowLeft /> Back
          </button>
          <h1>{isEditMode ? 'Edit' : 'New'} {type === 'REWORK' ? 'Rework' : 'Rejection'} Report</h1>
          <p>{isEditMode ? 'Update your draft error correction report' : `Raise a new error correction report for component ${type.toLowerCase()}`}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
            {type === 'REWORK' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Component *</label>
                  <input 
                    list="component-list" 
                    value={form.componentId} 
                    onChange={e => set('componentId', e.target.value)} 
                    placeholder="Select or type component..." 
                    required 
                  />
                  <datalist id="component-list">
                    {components.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Error Type (Optional)</label>
                  <input 
                    list="errortype-list" 
                    value={form.errorTypeId} 
                    onChange={e => set('errorTypeId', e.target.value)} 
                    placeholder="Select or type error type..." 
                  />
                  <datalist id="errortype-list">
                    {errorTypes.map(et => <option key={et.id} value={et.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>SC Number *</label>
                  <input value={form.scNo} onChange={e => set('scNo', e.target.value)} placeholder="e.g. SC-10294" required />
                </div>
                <div className="form-group">
                  <label>PO Number *</label>
                  <input value={form.poNo} onChange={e => set('poNo', e.target.value)} placeholder="e.g. PO-10294" required />
                </div>
                <div className="form-group">
                  <label>Stage of Failure *</label>
                  <input 
                    list="stage-list" 
                    value={form.stageOfFailure} 
                    onChange={e => set('stageOfFailure', e.target.value)} 
                    placeholder="Select or type stage..." 
                    required 
                  />
                  <datalist id="stage-list">
                    <option value="Inward Inspection" />
                    <option value="In-Process" />
                    <option value="Final Inspection" />
                    <option value="Customer Return" />
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Quantity Affected *</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => handleQuantityChange(e.target.value)} required />
                </div>
                <div className="form-group full">
                  <label>Defect Description *</label>
                  <textarea value={form.defectDescription} onChange={e => set('defectDescription', e.target.value)} placeholder="Describe the defect in detail…" required rows={4} />
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group">
                  <label>Component *</label>
                  <input 
                    list="component-list" 
                    value={form.componentId} 
                    onChange={e => set('componentId', e.target.value)} 
                    placeholder="Select or type component..." 
                    required 
                  />
                  <datalist id="component-list">
                    {components.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Error Type (Optional)</label>
                  <input 
                    list="errortype-list" 
                    value={form.errorTypeId} 
                    onChange={e => set('errorTypeId', e.target.value)} 
                    placeholder="Select or type error type..." 
                  />
                  <datalist id="errortype-list">
                    {errorTypes.map(et => <option key={et.id} value={et.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>SC Number *</label>
                  <input value={form.scNo} onChange={e => set('scNo', e.target.value)} placeholder="e.g. SC-10294" required />
                </div>
                <div className="form-group">
                  <label>PO Number *</label>
                  <input value={form.poNo} onChange={e => set('poNo', e.target.value)} placeholder="e.g. PO-10294" required />
                </div>
                <div className="form-group">
                  <label>Process Template *</label>
                  <select value={form.rejectionProcessTemplate} onChange={e => handleTemplateChange(e.target.value)} required>
                    <option value="">Select Template...</option>
                    {Object.keys(PROCESS_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="OTHERS">Others</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Failed Stage *</label>
                  {form.rejectionProcessTemplate === 'OTHERS' ? (
                    <input 
                      type="text" 
                      value={form.rejectionFailedStage || customStages[0]?.name || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        handleCustomStageChange(0, 'name', val);
                      }} 
                      placeholder="Enter failed stage / process name..." 
                      required 
                    />
                  ) : (
                    <select value={form.rejectionFailedStage} onChange={e => handleFailedStageChange(e.target.value)} required disabled={!form.rejectionProcessTemplate}>
                      <option value="">Select Stage...</option>
                      {(PROCESS_TEMPLATES[form.rejectionProcessTemplate] || []).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Quantity Affected *</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => handleQuantityChange(e.target.value)} required />
                </div>
                <div className="form-group full">
                  <label>Defect Description *</label>
                  <textarea value={form.defectDescription} onChange={e => set('defectDescription', e.target.value)} placeholder="Describe the defect in detail…" required rows={4} />
                </div>
              </div>
            )}

            {isSimplifiedInspector && (
              <div style={{ marginTop: 24, padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: 16 }}>Inspection Details</h3>
                {type === 'REWORK' ? (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Responsible Party *</label>
                      <select value={form.responsibleParty} onChange={e => { set('responsibleParty', e.target.value); set('responsibleId', ''); set('responsibleName', ''); set('dcNumber', ''); }} required={isSimplifiedInspector}>
                        <option value="">Select...</option>
                        <option value="OPERATOR">Operator</option>
                        <option value="VENDOR">Vendor</option>
                        <option value="CUSTOMER">Customer</option>
                        <option value="MATERIAL">Material</option>
                        <option value="INLINE_QUALITY">Inline Quality</option>
                        <option value="VENDOR_QUALITY">Vendor Quality</option>
                        <option value="DESIGN_TEAM">Design Team</option>
                        <option value="DESIGN_TEAM">Design Team</option>
                      </select>
                    </div>
                    {form.responsibleParty === 'OPERATOR' && (
                      <div className="form-group">
                        <label>Operator Name *</label>
                        <input 
                          list="operator-names" 
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            const match = operators.find(o => o.name === val);
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: match ? match.id : ''
                            }));
                          }}
                          placeholder="Type or select operator..."
                          required={isSimplifiedInspector}
                        />
                        <datalist id="operator-names">
                          {operators.map(o => <option key={o.id} value={o.name} />)}
                        </datalist>
                      </div>
                    )}
                    {form.responsibleParty === 'CUSTOMER' && (
                      <div className="form-group">
                        <label>Customer Name *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter customer name..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'MATERIAL' && (
                      <div className="form-group">
                        <label>Material Name / Code *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter material name or code..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'INLINE_QUALITY' && (
                      <div className="form-group">
                        <label>Inline Quality Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter inline quality details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'VENDOR_QUALITY' && (
                      <div className="form-group">
                        <label>Vendor Quality Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter vendor quality details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'DESIGN_TEAM' && (
                      <div className="form-group">
                        <label>Design Team Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter design team details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'DESIGN_TEAM' && (
                      <div className="form-group">
                        <label>Design Team Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter design team details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'VENDOR' && (
                      <>
                      <div className="form-group">
                        <label>Vendor Name *</label>
                        <input 
                          list="vendor-names" 
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            const match = vendors.find(v => v.name === val);
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: match ? match.id : ''
                            }));
                          }}
                          placeholder="Type or select vendor..."
                          required={isSimplifiedInspector}
                        />
                        <datalist id="vendor-names">
                          {vendors.map(v => <option key={v.id} value={v.name} />)}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label>DC Number *</label>
                        <input 
                          type="text" 
                          value={form.dcNumber || ''} 
                          onChange={e => set('dcNumber', e.target.value)} 
                          placeholder="Enter DC number..." 
                          required={isSimplifiedInspector} 
                        />
                      </div>
                      </>
                    )}
                    <div className="form-group full">
                      <label>Rework Description *</label>
                      <textarea value={form.reworkDescription} onChange={e => set('reworkDescription', e.target.value)} placeholder="Describe the rework in detail…" required={isSimplifiedInspector} rows={4} />
                    </div>
                    <div className="form-group">
                      <label>Cost Estimation (₹) *</label>
                      <input type="number" min="0" step="1" value={form.costEstimate} onChange={e => set('costEstimate', e.target.value ? Math.round(Number(e.target.value)) : '')} required={isSimplifiedInspector} />
                    </div>
                    <div className="form-group">
                      <label>Loss Estimation (₹) (Optional)</label>
                      <input type="number" min="0" step="1" value={form.lossAmount} onChange={e => set('lossAmount', e.target.value ? Math.round(Number(e.target.value)) : '')} />
                    </div>
                    <div className="form-group full">
                      <label>Alternative Notes (Optional)</label>
                      <textarea value={form.alternativeNote} onChange={e => set('alternativeNote', e.target.value)} placeholder="Alternative notes or remarks..." rows={2} />
                    </div>
                  </div>
                ) : (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Responsible Party *</label>
                      <select value={form.responsibleParty} onChange={e => { set('responsibleParty', e.target.value); set('responsibleId', ''); set('responsibleName', ''); set('dcNumber', ''); }} required={isSimplifiedInspector}>
                        <option value="">Select...</option>
                        <option value="OPERATOR">Operator</option>
                        <option value="VENDOR">Vendor</option>
                        <option value="CUSTOMER">Customer</option>
                        <option value="MATERIAL">Material</option>
                        <option value="INLINE_QUALITY">Inline Quality</option>
                        <option value="VENDOR_QUALITY">Vendor Quality</option>
                      </select>
                    </div>
                    {form.responsibleParty === 'OPERATOR' && (
                      <div className="form-group">
                        <label>Operator Name *</label>
                        <input 
                          list="operator-names" 
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            const match = operators.find(o => o.name === val);
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: match ? match.id : ''
                            }));
                          }}
                          placeholder="Type or select operator..."
                          required={isSimplifiedInspector}
                        />
                        <datalist id="operator-names">
                          {operators.map(o => <option key={o.id} value={o.name} />)}
                        </datalist>
                      </div>
                    )}
                    {form.responsibleParty === 'CUSTOMER' && (
                      <div className="form-group">
                        <label>Customer Name *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter customer name..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'MATERIAL' && (
                      <div className="form-group">
                        <label>Material Name / Code *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter material name or code..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'INLINE_QUALITY' && (
                      <div className="form-group">
                        <label>Inline Quality Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter inline quality details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'VENDOR_QUALITY' && (
                      <div className="form-group">
                        <label>Vendor Quality Details *</label>
                        <input 
                          type="text"
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: val
                            }));
                          }}
                          placeholder="Enter vendor quality details..."
                          required={isSimplifiedInspector}
                        />
                      </div>
                    )}
                    {form.responsibleParty === 'VENDOR' && (
                      <>
                      <div className="form-group">
                        <label>Vendor Name *</label>
                        <input 
                          list="vendor-names" 
                          value={form.responsibleName || ''} 
                          onChange={e => {
                            const val = e.target.value;
                            const match = vendors.find(v => v.name === val);
                            setForm(f => ({
                              ...f,
                              responsibleName: val,
                              responsibleId: match ? match.id : ''
                            }));
                          }}
                          placeholder="Type or select vendor..."
                          required={isSimplifiedInspector}
                        />
                        <datalist id="vendor-names">
                          {vendors.map(v => <option key={v.id} value={v.name} />)}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label>DC Number *</label>
                        <input 
                          type="text" 
                          value={form.dcNumber || ''} 
                          onChange={e => set('dcNumber', e.target.value)} 
                          placeholder="Enter DC number..." 
                          required={isSimplifiedInspector} 
                        />
                      </div>
                      </>
                    )}
                    <div className="form-group full">
                      <label>Rejection Description *</label>
                      <textarea value={form.rejectionDescription} onChange={e => set('rejectionDescription', e.target.value)} placeholder="Describe the rejection in detail…" required={isSimplifiedInspector} rows={4} />
                    </div>

                    {/* Custom Process Flow Costs Box for OTHERS */}
                    {form.rejectionProcessTemplate === 'OTHERS' && (
                      <div className="form-group full" style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            Process Flow Details & Cost (Others)
                          </h4>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Total Qty: <strong>{Number(form.quantity) || 1}</strong>
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {customStages.map((stg, index) => {
                            const qty = Number(form.quantity) || 1;
                            const stageTotal = (stg.cost !== '' && stg.cost != null) ? Math.round(Number(stg.cost) * qty) : null;
                            return (
                              <div key={index} style={{ display: 'grid', gridTemplateColumns: customStages.length > 1 ? '1fr 1fr auto' : '1fr 1fr', gap: 12, alignItems: 'flex-start', padding: 12, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Process Details / Stage Name *</label>
                                  <input 
                                    type="text"
                                    value={stg.name}
                                    onChange={e => handleCustomStageChange(index, 'name', e.target.value)}
                                    placeholder="Enter process details (e.g. Turning, Milling, Boring)..."
                                    required={isSimplifiedInspector}
                                    style={{ height: 34, padding: '4px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, width: '100%', background: 'var(--bg-card)', color: 'var(--text)' }}
                                  />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Amount (Rate for 1 Qty) (₹) *</label>
                                    {stageTotal !== null && qty > 1 && (
                                      <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Total: ₹{stageTotal.toLocaleString('en-IN')}</span>
                                    )}
                                  </div>
                                  <input 
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={stg.cost ?? ''}
                                    onChange={e => handleCustomStageChange(index, 'cost', e.target.value)}
                                    placeholder="Rate for 1 Qty (₹)"
                                    required={isSimplifiedInspector}
                                    style={{ height: 34, padding: '4px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, width: '100%', background: 'var(--bg-card)', color: 'var(--text)' }}
                                  />
                                  {stageTotal !== null && qty > 1 && (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      ₹{stg.cost} × {qty} qty
                                    </span>
                                  )}
                                </div>

                                {customStages.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => removeCustomStage(index)} 
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginTop: 22, color: '#ef4444' }}
                                    title="Remove process"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            onClick={addCustomStage} 
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12 }}
                          >
                            + Add Another Process Stage
                          </button>

                          {(() => {
                            const qty = Number(form.quantity) || 1;
                            const unitSum = customStages.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
                            const totalSum = unitSum * qty;
                            return unitSum > 0 ? (
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Total Cost for {qty} Qty ({unitSum} × {qty}): </span>
                                <span style={{ color: '#10b981' }}>₹{totalSum.toLocaleString('en-IN')}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Stage Costs Entry list */}
                    {form.rejectionProcessTemplate !== 'OTHERS' && stagesUpToFailure.length > 0 && (
                      <div className="form-group full" style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Process Flow Costs up to Failed Stage (Rate for 1 Qty)</h4>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Total Qty: <strong>{Number(form.quantity) || 1}</strong>
                          </span>
                        </div>
                        <div className="stage-costs-grid">
                          {stagesUpToFailure.map(st => {
                            const unitCost = form.rejectionStageCosts[st];
                            const qty = Number(form.quantity) || 1;
                            const stageTotal = (unitCost !== '' && unitCost != null) ? Math.round(Number(unitCost) * qty) : null;
                            return (
                              <div key={st} className="stage-cost-item" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span className="stage-cost-label" style={{ fontWeight: 500, fontSize: 12 }}>{st}:</span>
                                  {stageTotal !== null && qty > 1 && (
                                    <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                                      Total: ₹{stageTotal.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                <input 
                                  type="number" 
                                  min="0" 
                                  step="1" 
                                  style={{ height: 34, padding: '4px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, width: '100%', background: 'var(--bg)', color: 'var(--text)' }}
                                  value={form.rejectionStageCosts[st] ?? ''} 
                                  onChange={e => handleStageCostChange(st, e.target.value)} 
                                  required={isSimplifiedInspector}
                                  placeholder="Rate for 1 Qty (₹)"
                                />
                                {stageTotal !== null && qty > 1 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    ₹{unitCost} × {qty} qty
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {(() => {
                          const qty = Number(form.quantity) || 1;
                          const unitSum = sumStageCosts(stagesUpToFailure, form.rejectionStageCosts);
                          const totalSum = unitSum * qty;
                          return unitSum > 0 ? (
                            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Total Stage Cost for {qty} Qty ({unitSum} × {qty}):</span>
                              <span style={{ color: '#10b981' }}>₹{totalSum.toLocaleString('en-IN')}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    <div className="form-group">
                      <label>Cost Estimation (₹) *</label>
                      <input type="number" min="0" step="1" value={form.costEstimate} onChange={e => set('costEstimate', e.target.value ? Math.round(Number(e.target.value)) : '')} required={isSimplifiedInspector} />
                    </div>
                    <div className="form-group">
                      <label>Loss Estimation (₹) (Optional)</label>
                      <input type="number" min="0" step="1" value={form.lossAmount} onChange={e => set('lossAmount', e.target.value ? Math.round(Number(e.target.value)) : '')} />
                    </div>
                    <div className="form-group full">
                      <label>Alternative Notes (Optional)</label>
                      <textarea value={form.alternativeNote} onChange={e => set('alternativeNote', e.target.value)} placeholder="Alternative notes or remarks..." rows={2} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-8" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={handleBack}>Cancel</button>
              {(!isEditMode || formStatus === 'DRAFT') && (
                <button type="submit" name="draft" formNoValidate className="btn btn-secondary" disabled={loading}>
                  Save as Draft
                </button>
              )}
              <button type="submit" name="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : (isEditMode ? 'Update Report' : 'Submit Report')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
