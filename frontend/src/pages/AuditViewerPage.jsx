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
        (r.auditLogs || []).map(log => ({ ...log, reportId: r.id, reportNumber: r.reportNumber }))
      );
      return allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = audits.filter(a => {
    const actionMatch = (a.actionType || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const actorMatch = (a.actor?.name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const reportMatch = (a.reportNumber || a.reportId || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    return !debouncedSearch || actionMatch || actorMatch || reportMatch;
  });

  const columns = [
    { header: 'Date', render: (row) => new Date(row.timestamp).toLocaleString('en-IN') },
    { header: 'Action', accessor: 'actionType' },
    { header: 'User', render: (row) => row.actor?.name || row.actorRole || 'System' },
    { header: 'Entity / Report ID', render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.reportNumber}</span> },
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
            <button className="btn btn-ghost" onClick={() => {}}><FiFilter /> Filter</button>
          </div>
          <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="No audit logs found." />
        </div>
      </div>
    </>
  );
}
