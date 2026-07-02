import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { toast } from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';

export default function NewReportPage() {
  const navigate = useNavigate();
  const [components, setComponents] = useState([]);
  const [errorTypes, setErrorTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    defectDescription: '', quantity: 1, componentId: '', errorTypeId: '', vendorId: '', batchNumber: '', partNumber: ''
  });

  useEffect(() => {
    Promise.all([
      api.get('/master-data/components').catch(() => ({ data: [] })),
      api.get('/master-data/error-types').catch(() => ({ data: [] })),
      api.get('/master-data/vendors').catch(() => ({ data: [] })),
    ]).then(([c, e, v]) => { setComponents(c.data || []); setErrorTypes(e.data || []); setVendors(v.data || []); });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { ...form, quantity: Number(form.quantity) };
      if (!body.vendorId) delete body.vendorId;
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
