import React, { useEffect, useState } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

function SimpleModal({ title, fields, values, onChange, onClose, onSave, loading }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {fields.map(f => (
          <div key={f.key} className="form-group" style={{ marginBottom: 14 }}>
            <label>{f.label}</label>
            <input value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, endpoint, fields }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetch = () => api.get(`/master-data/${endpoint}`).then(r => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { fetch(); }, [endpoint]);

  const openNew = () => { setForm({}); setModal('new'); };
  const openEdit = (item) => { setForm(item); setModal('edit'); };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'edit') await api.patch(`/master-data/${endpoint}/${form.id}`, form);
      else await api.post(`/master-data/${endpoint}`, form);
      toast.success('Saved!'); setModal(null); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this item?')) return;
    await api.delete(`/master-data/${endpoint}/${id}`).catch(() => {});
    toast.success('Deleted'); fetch();
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>{title}</span>
        <button className="btn btn-ghost btn-sm" onClick={openNew}><FiPlus /> Add</button>
      </div>
      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr>{fields.map(f => <th key={f.key}>{f.label}</th>)}<th>Actions</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={fields.length + 1}><div className="empty-state" style={{ padding: 20 }}><p>No items. Click Add to create one.</p></div></td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  {fields.map(f => <td key={f.key}>{item[f.key] || '—'}</td>)}
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}><FiEdit2 /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(item.id)}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <SimpleModal title={modal === 'edit' ? `Edit ${title.slice(0,-1)}` : `New ${title.slice(0,-1)}`} fields={fields} values={form} onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))} onClose={() => setModal(null)} onSave={save} loading={saving} />}
    </div>
  );
}

export default function MasterDataPage() {
  return (
    <>
      <div className="topbar"><div><h1>Master Data</h1><p>Manage reference data</p></div></div>
      <div className="page-content">
        <Section title="Error Types" endpoint="error-types" fields={[{ key: 'name', label: 'Name', placeholder: 'e.g. Dimensional' }, { key: 'description', label: 'Description', placeholder: 'Optional' }]} />
        <Section title="Components" endpoint="components" fields={[{ key: 'name', label: 'Name', placeholder: 'e.g. Shaft' }, { key: 'partCode', label: 'Part Code', placeholder: 'e.g. VM-001' }]} />
        <Section title="Vendors" endpoint="vendors" fields={[{ key: 'name', label: 'Name', placeholder: 'Vendor name' }, { key: 'contactEmail', label: 'Contact Email', placeholder: 'vendor@example.com' }]} />
        <Section title="Cost Rates" endpoint="cost-rates" fields={[{ key: 'category', label: 'Category', placeholder: 'e.g. Rework' }, { key: 'ratePerUnit', label: 'Rate (₹)', placeholder: '0.00' }]} />
      </div>
    </>
  );
}
