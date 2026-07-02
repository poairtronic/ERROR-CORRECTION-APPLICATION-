import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { SIMPLIFIED_WORKFLOW } from '../utils/constants';

export default function NewReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSimplifiedInspector = SIMPLIFIED_WORKFLOW && user?.role === 'INSPECTOR';

  const [components, setComponents] = useState([]);
  const [errorTypes, setErrorTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    defectDescription: '', quantity: 1, componentId: '', errorTypeId: '', vendorId: '', batchNumber: '', partNumber: '', scOrPoNo: '', stageOfFailure: '',
    rootCause: '', responsibleParty: '', responsibleId: '', decision: '', alternativeNote: '', costEstimate: '', timeEstimateHours: '', lossAmount: ''
  });

  useEffect(() => {
    Promise.all([
      api.get('/master-data/components').catch(() => ({ data: [] })),
      api.get('/master-data/error-types').catch(() => ({ data: [] })),
      api.get('/master-data/vendors').catch(() => ({ data: [] })),
      isSimplifiedInspector ? api.get('/admin/users?role=OPERATOR').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
    ]).then(([c, e, v, o]) => { 
      setComponents(c.data || []); 
      setErrorTypes(e.data || []); 
      setVendors(v.data || []); 
      setOperators(o.data || []);
    });
  }, [isSimplifiedInspector]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { ...form, quantity: Number(form.quantity) };
      if (!body.vendorId) delete body.vendorId;
      
      if (isSimplifiedInspector) {
        body.inlineInspection = {
          errorType: body.errorTypeId,
          rootCause: body.rootCause,
          responsibleParty: body.responsibleParty,
          responsibleId: body.responsibleId,
          decision: body.decision,
          alternativeNote: body.alternativeNote,
          costEstimate: Number(body.costEstimate) || 0,
          timeEstimateHours: Number(body.timeEstimateHours) || 0,
          lossAmount: body.lossAmount ? Number(body.lossAmount) : undefined
        };
      }

      const { data } = await api.post('/defect-reports', body);
      toast.success('Report raised successfully!');
      navigate(`/reports/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 4 }}>
            <FiArrowLeft /> Back
          </button>
          <h1>New Defect Report</h1>
          <p>Raise a new error correction report</p>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
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
                <label>Error Type *</label>
                <input 
                  list="error-type-list" 
                  value={form.errorTypeId} 
                  onChange={e => set('errorTypeId', e.target.value)} 
                  placeholder="Select or type error type..." 
                  required 
                />
                <datalist id="error-type-list">
                  {errorTypes.map(e => <option key={e.id} value={e.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>SC / PO Number *</label>
                <input value={form.scOrPoNo} onChange={e => set('scOrPoNo', e.target.value)} placeholder="e.g. PO-10294" required />
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
                <label>Vendor (if vendor fault)</label>
                <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
                  <option value="">Not a vendor fault</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity Affected *</label>
                <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Part Number</label>
                <input value={form.partNumber} onChange={e => set('partNumber', e.target.value)} placeholder="e.g. VM-2024-001" />
              </div>
              <div className="form-group">
                <label>Batch Number</label>
                <input value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} placeholder="e.g. B20240102" />
              </div>
              <div className="form-group full">
                <label>Defect Description *</label>
                <textarea value={form.defectDescription} onChange={e => set('defectDescription', e.target.value)} placeholder="Describe the defect in detail…" required rows={4} />
              </div>
            </div>

            {isSimplifiedInspector && (
              <div style={{ marginTop: 24, padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: 16 }}>Inspection Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Root Cause *</label>
                    <input value={form.rootCause} onChange={e => set('rootCause', e.target.value)} required={isSimplifiedInspector} />
                  </div>
                  <div className="form-group">
                    <label>Responsible Party *</label>
                    <select value={form.responsibleParty} onChange={e => set('responsibleParty', e.target.value)} required={isSimplifiedInspector}>
                      <option value="">Select...</option>
                      <option value="OPERATOR">Operator</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="MACHINE">Machine</option>
                      <option value="PROCESS">Process</option>
                    </select>
                  </div>
                  {['OPERATOR', 'VENDOR', 'MACHINE'].includes(form.responsibleParty) && (
                    <div className="form-group">
                      <label>
                        {form.responsibleParty === 'OPERATOR' ? 'Operator ID / Name' : 
                         form.responsibleParty === 'VENDOR' ? 'Vendor ID / Name' : 'Machine ID / Name'} *
                      </label>
                      <input 
                        list={`${form.responsibleParty.toLowerCase()}-list`}
                        value={form.responsibleId} 
                        onChange={e => set('responsibleId', e.target.value)} 
                        placeholder={`Select or type ${form.responsibleParty.toLowerCase()}...`}
                        required 
                      />
                      <datalist id="operator-list">
                        {operators.map(o => <option key={o.id} value={`${o.id} - ${o.name}`} />)}
                      </datalist>
                      <datalist id="vendor-list">
                        {vendors.map(v => <option key={v.id} value={`${v.id} - ${v.name}`} />)}
                      </datalist>
                      <datalist id="machine-list">
                        {components.map(c => <option key={c.id} value={`${c.id} - ${c.name}`} />)}
                      </datalist>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Decision *</label>
                    <select value={form.decision} onChange={e => set('decision', e.target.value)} required={isSimplifiedInspector}>
                      <option value="">Select...</option>
                      <option value="REWORK">Rework</option>
                      <option value="SCRAP">Scrap</option>
                      <option value="ALTERNATIVE">Alternative Use</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cost Estimate ($) *</label>
                    <input type="number" min="0" step="0.01" value={form.costEstimate} onChange={e => set('costEstimate', e.target.value)} required={isSimplifiedInspector} />
                  </div>
                  <div className="form-group">
                    <label>Estimated Time (Hours) *</label>
                    <input type="number" min="0" step="0.5" value={form.timeEstimateHours} onChange={e => set('timeEstimateHours', e.target.value)} required={isSimplifiedInspector} />
                  </div>
                  <div className="form-group">
                    <label>Loss Amount ($) (Optional)</label>
                    <input type="number" min="0" step="0.01" value={form.lossAmount} onChange={e => set('lossAmount', e.target.value)} />
                  </div>
                  <div className="form-group full">
                    <label>Alternative Note / Remarks</label>
                    <textarea value={form.alternativeNote} onChange={e => set('alternativeNote', e.target.value)} rows={2} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-8" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
