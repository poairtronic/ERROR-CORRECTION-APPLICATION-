import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiPlus, FiSearch } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';

import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (searchParams.get('search')) {
      setSearch(searchParams.get('search'));
    }
  }, [searchParams]);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['defect-reports'],
    queryFn: async () => (await api.get('/defect-reports')).data
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = reports.filter(r => {
    const matchSearch = !debouncedSearch || (
      (r.reportNumber || '') +
      (r.id || '') +
      (r.componentName || '') +
      (r.errorTypeName || '') +
      (r.defectDescription || '') +
      (r.raisedBy?.name || '') +
      (r.raisedBy?.username || '')
    ).toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = !filterStatus || r.status === filterStatus;
    
    let matchDate = true;
    if (startDate || endDate) {
      const createdDate = new Date(r.createdAt);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (createdDate < start) matchDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (createdDate > end) matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const columns = [
    { header: 'Report ID', render: (row) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.reportNumber}</span> },
    { header: 'Description', render: (row) => <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.defectDescription}</div> },
    { header: 'Component', accessor: 'componentName' },
    { header: 'Error Type', accessor: 'errorTypeName' },
    { header: 'Status', render: (row) => <span className={`badge badge-${STATUS_COLORS[row.status] || 'draft'}`}>{STATUS_LABELS[row.status] || row.status}</span> },
    { header: 'Raised By', render: (row) => row.raisedBy?.name || '—' },
    { header: 'Date', render: (row) => <span style={{ color: 'var(--text-muted)' }}>{new Date(row.createdAt).toLocaleDateString('en-IN')}</span> },
    { header: 'Action', render: (row) => <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/reports/${row.id}`)}>View</button> }
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Defect Reports</h1>
          <p>{filtered.length} reports</p>
        </div>
        {['OPERATOR', 'INSPECTOR', 'SENIOR_MANAGER'].includes(user?.role?.toUpperCase()) && (
          <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
            <FiPlus /> New Report
          </button>
        )}
      </div>

      <div className="page-content">
        <div className="card">
          <div className="flex gap-12 mb-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 13 }}>From:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                style={{ width: 140, height: 38, padding: '8px 10px' }} 
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 13 }}>To:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                style={{ width: 140, height: 38, padding: '8px 10px' }} 
              />
            </div>
            
            {(startDate || endDate) && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{ height: 38 }}
              >
                Clear
              </button>
            )}

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="No reports found." />
        </div>
      </div>
    </>
  );
}
