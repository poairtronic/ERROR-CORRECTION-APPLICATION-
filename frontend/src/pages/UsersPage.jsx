import React, { useEffect, useState } from 'react';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiCheck } from 'react-icons/fi';

const ROLES = ['OPERATOR','INSPECTOR','SM','GM','STORE','ADMIN'];

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{user ? 'Edit User' : 'Create User'}</div>
        <form onSubmit={handleSubmit}>
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
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {user} | 'new'

  const fetchUsers = () => { api.get('/admin/users').then(r => setUsers(r.data || [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { fetchUsers(); }, []);

  const deactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    await api.delete(`/admin/users/${id}`).catch(() => {});
    toast.success('User deactivated'); fetchUsers();
  };

  return (
    <>
      <div className="topbar">
        <div><h1>Users</h1><p>{users.length} accounts</p></div>
        <button className="btn btn-primary" onClick={() => setModal('new')}><FiPlus /> Create User</button>
      </div>
      <div className="page-content">
        <div className="card">
          {loading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td><span className={`badge badge-${u.role?.toLowerCase()}`}>{u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td>{u.isActive ? <span className="badge badge-approved">Active</span> : <span className="badge badge-rejected">Inactive</span>}</td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)}><FiEdit2 /></button>
                          {u.isActive && <button className="btn btn-danger btn-sm" onClick={() => deactivate(u.id)}><FiTrash2 /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {modal && <UserModal user={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={() => { setModal(null); fetchUsers(); }} />}
    </>
  );
}
