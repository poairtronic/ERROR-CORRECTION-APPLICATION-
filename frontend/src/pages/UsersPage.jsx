import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import Dialog from '../components/ui/Dialog';

import { ROLES } from '../utils/constants';

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'OPERATOR', department: user?.department || '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const body = { ...form, tempPassword: form.password };
      delete body.password;
      if (user && !body.tempPassword) delete body.tempPassword;
      if (user) await api.patch(`/admin/users/${user.id}`, body);
      else await api.post('/admin/users', body);
      toast.success(user ? 'User updated!' : 'User created!');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={true} onClose={onClose} title={user ? 'Edit User' : 'Create User'}>
      <form onSubmit={handleSubmit} style={{ minWidth: 400 }}>
          <div className="form-grid">
            <div className="form-group"><label>Full Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label>Email / Username *</label><input value={form.email} onChange={e => set('email', e.target.value)} required /></div>
            <div className="form-group"><label>Role *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Department</label><input value={form.department} onChange={e => set('department', e.target.value)} /></div>
            <div className="form-group full"><label>{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required={!user} />
            </div>
          </div>
          <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
      </form>
    </Dialog>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | {user} | 'new'

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/admin/users')).data
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted permanently');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const deactivate = useCallback((id) => {
    if (confirm('Are you sure you want to delete this user? The user account, notifications, and login history will be permanently deleted, but all defect reports and logs created by them will be preserved.')) {
      deactivateMutation.mutate(id);
    }
  }, [deactivateMutation]);

  const columns = useMemo(() => [
    { header: 'Name', render: (row) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
    { header: 'Email', render: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.email}</span> },
    { header: 'Role', render: (row) => <span className={`badge badge-${row.role?.toLowerCase()}`}>{row.role}</span> },
    { header: 'Department', render: (row) => row.department || '—' },
    { header: 'Status', render: (row) => row.isActive ? <span className="badge badge-approved">Active</span> : <span className="badge badge-rejected">Inactive</span> },
    { 
      header: 'Actions', 
      render: (row) => (
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={() => setModal(row)}><FiEdit2 /></button>
          {row.isActive && <button className="btn btn-danger btn-sm" onClick={() => deactivate(row.id)}><FiTrash2 /></button>}
        </div>
      )
    }
  ], [deactivate]);

  return (
    <>
      <div className="topbar">
        <div><h1>Users</h1><p>{users.length} accounts</p></div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><FiPlus /> Create User</button>
      </div>
      <div className="page-content">
        <div className="card">
          <Table columns={columns} data={users} loading={isLoading} emptyMessage="No users found." />
        </div>
      </div>
      {modal && <UserModal user={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={() => { setModal(null); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); }} />}
    </>
  );
}
