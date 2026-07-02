import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCheckCircle } from 'react-icons/fi';

export default function GeneralManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['gm-reports'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      return data || [];
    }
  });

  const pendingApprovals = reports.filter(r => r.status === 'PENDING_GM_APPROVAL');
  
  // Dummy data for budget metrics
  const budgetSummary = '$24,500';
  const vendorCases = reports.filter(r => r.responsibleParty === 'VENDOR').length;
  const salaryDeductions = 5;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>General Manager Dashboard</h1>
          <p>Welcome back, {user?.username}</p>
        </div>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{pendingApprovals.length}</div>
            <div className="stat-desc">Requires attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cost Impact (MTD)</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{budgetSummary}</div>
            <div className="stat-desc">Estimated loss</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vendor Cases</div>
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>{vendorCases}</div>
            <div className="stat-desc">Active issues</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Salary Deductions</div>
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{salaryDeductions}</div>
            <div className="stat-desc">Processed this month</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><FiCheckCircle /> Approval Queue</div>
          {isLoading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Component</th>
                    <th>Error Type</th>
                    <th>Cost Estimate</th>
                    <th>Date Raised</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><p>No pending approvals.</p></div></td></tr>
                  ) : pendingApprovals.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id.slice(0,8).toUpperCase()}</td>
                      <td>{r.componentName || '—'}</td>
                      <td>{r.errorTypeName || '—'}</td>
                      <td>$1,200</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reports/${r.id}`)}>Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
