import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import Dialog from '../components/ui/Dialog';

function SimpleModal({ title, fields, values, onChange, onClose, onSave, loading }) {
  return (
    <Dialog open={true} onClose={onClose} title={title}>
      <div className="modal-form-responsive">
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
    </Dialog>
  );
}

function Section({ title, endpoint, fields }) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-data', endpoint],
    queryFn: async () => (await api.get(`/master-data/${endpoint}`)).data
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (modal === 'edit') return api.patch(`/master-data/${endpoint}/${payload.id}`, payload);
      return api.post(`/master-data/${endpoint}`, payload);
    },
    onSuccess: () => {
      toast.success('Saved successfully!');
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['master-data', endpoint] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/master-data/${endpoint}/${id}`),
    onSuccess: () => {
      toast.success('Deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['master-data', endpoint] });
    }
  });

  const openNew = useCallback(() => { setForm({}); setModal('new'); }, []);
  const openEdit = useCallback((item) => { setForm(item); setModal('edit'); }, []);

  const del = useCallback((id) => {
    if (confirm('Delete this item?')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const columns = useMemo(() => [
    ...fields.map(f => ({ header: f.label, accessor: f.key })),
    { 
      header: 'Actions', 
      render: (row) => (
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}><FiEdit2 /></button>
          <button className="btn btn-danger btn-sm" onClick={() => del(row.id)}><FiTrash2 /></button>
        </div>
      )
    }
  ], [fields, openEdit, del]);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>{title}</span>
        <button className="btn btn-ghost btn-sm" onClick={openNew}><FiPlus /> Add</button>
      </div>
      <Table columns={columns} data={items} loading={isLoading} emptyMessage="No items found. Click Add to create one." />
      
      {modal && (
        <SimpleModal 
          title={modal === 'edit' ? `Edit ${title.slice(0,-1)}` : `New ${title.slice(0,-1)}`} 
          fields={fields} 
          values={form} 
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))} 
          onClose={() => setModal(null)} 
          onSave={() => saveMutation.mutate(form)} 
          loading={saveMutation.isPending} 
        />
      )}
    </div>
  );
}

export default function MasterDataPage() {
  return (
    <>
      <div className="topbar"><div><h1>Master Data</h1><p>Manage reference data</p></div></div>
      <div className="page-content">
        <Section title="Error Types" endpoint="error-types" fields={[{ key: 'name', label: 'Name', placeholder: 'e.g. Dimensional' }, { key: 'description', label: 'Description', placeholder: 'Optional' }]} />
        <Section title="Components" endpoint="components" fields={[{ key: 'name', label: 'Name', placeholder: 'e.g. Shaft' }, { key: 'code', label: 'Code', placeholder: 'e.g. VM-001' }]} />
        <Section title="Vendors" endpoint="vendors" fields={[{ key: 'name', label: 'Name', placeholder: 'Vendor name' }, { key: 'contactEmail', label: 'Contact Email', placeholder: 'vendor@example.com' }]} />
        <Section title="Operators" endpoint="operators" fields={[{ key: 'name', label: 'Name', placeholder: 'Operator name' }, { key: 'operatorCode', label: 'Operator Code', placeholder: 'Optional' }]} />
        <Section title="Cost Rates" endpoint="cost-rates" fields={[{ key: 'stageName', label: 'Stage Name/Category', placeholder: 'e.g. OP10_TURNING' }, { key: 'ratePerHour', label: 'Rate Per Hour (₹)', placeholder: '0.00' }]} />
      </div>
    </>
  );
}
