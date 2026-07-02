import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiUsers, FiDatabase, FiSettings } from 'react-icons/fi';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: users = [] } = useQuery({ queryKey: ['users-count'], queryFn: async () => (await api.get('/admin/users')).data });
  const { data: roles = [] } = useQuery({ queryKey: ['roles-count'], queryFn: async () => (await api.get('/admin/roles')).data });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {user?.username} · System Overview</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Users</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{users.length || 0}</div>
            <div className="stat-desc">Active accounts</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">System Roles</div>
            <div className="stat-value" style={{ color: '#c084fc' }}>{roles.length || 6}</div>
            <div className="stat-desc">Configured profiles</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Audit Logs</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>12K+</div>
            <div className="stat-desc">System events</div>
          </div>
        </div>

        <div className="form-grid" style={{ gap: 24 }}>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
            <div className="card-title"><FiUsers /> User Management</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create, update, and deactivate user accounts and assign roles.</p>
          </div>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/master-data')}>
            <div className="card-title"><FiDatabase /> Master Data</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage Error Types, Components, Vendors, and Cost Rates.</p>
          </div>
          <div className="card" style={{ cursor: 'pointer' }}>
            <div className="card-title"><FiSettings /> System Settings</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Configure application settings and email notifications.</p>
          </div>
        </div>
      </div>
    </>
  );
}
