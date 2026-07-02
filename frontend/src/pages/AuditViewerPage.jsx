import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiSearch, FiFilter } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import { useDebounce } from '../hooks/useDebounce';

export default function AuditViewerPage() {
  const [search, setSearch] = useState('');
  
  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['global-audits'],
    queryFn: async () => {
      // In a real app, you'd fetch from an /admin/audits endpoint
      // Mocking fetch by getting all defect reports and extracting their audits for demo purposes
      const { data } = await api.get('/defect-reports');
      const allLogs = data.flatMap(r => 
        (r.auditLogs || []).map(log => ({ ...log, reportId: r.id }))
      );
      return allLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = audits.filter(a => 
    !debouncedSearch || 
    a.action.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
    (a.user?.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    a.reportId.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const columns = [
    { header: 'Date', render: (row) => new Date(row.createdAt).toLocaleString('en-IN') },
    { header: 'Action', accessor: 'action' },
    { header: 'User', render: (row) => row.user?.name || 'System' },
    { header: 'Entity / Report ID', render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.reportId.slice(0,8).toUpperCase()}</span> },
    { header: 'Notes', accessor: 'notes' }
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Global Audit Viewer</h1>
          <p>System-wide activity log</p>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="flex gap-12 mb-16">
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input placeholder="Search audits…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>
            <button className="btn btn-ghost"><FiFilter /> Filter</button>
          </div>
          <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="No audit logs found." />
        </div>
      </div>
    </>
  );
}
