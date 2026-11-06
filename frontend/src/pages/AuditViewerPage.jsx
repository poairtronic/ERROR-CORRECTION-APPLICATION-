import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { FiSearch, FiFilter, FiExternalLink } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import { useDebounce } from '../hooks/useDebounce';

const ACTION_TYPES = [
  'ALL',
  'STATUS_CHANGE',
  'FIELD_EDIT',
  'INVENTORY_UPDATED',
  'COMPONENT_ISSUED',
  'SALARY_DEDUCTION_CREATED',
  'VENDOR_FAULT_CREATED',
  'IMAGE_UPLOADED',
];

export default function AuditViewerPage() {
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const navigate = useNavigate();

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['global-audits'],
    queryFn: async () => {
      const res = await api.get('/audit-logs');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  const debouncedSearch = useDebounce(search, 300);

  const filtered = audits.filter((a) => {
    const actionMatchesFilter =
      selectedAction === 'ALL' || a.actionType === selectedAction || a.action === selectedAction;

    if (!actionMatchesFilter) return false;

    if (!debouncedSearch) return true;

    const term = debouncedSearch.toLowerCase();
    const actionMatch = (a.actionType || a.action || '').toLowerCase().includes(term);
    const actorMatch = (a.actor?.name || a.actorRole || a.userEmail || '').toLowerCase().includes(term);
    const reportMatch = (a.reportNumber || a.report?.reportNumber || a.reportId || '').toLowerCase().includes(term);
    const noteMatch = (a.note || a.notes || '').toLowerCase().includes(term);

    return actionMatch || actorMatch || reportMatch || noteMatch;
  });

  const columns = [
    {
      header: 'Date & Time',
      render: (row) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {new Date(row.timestamp || row.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (row) => {
        const type = row.actionType || row.action || 'UNKNOWN';
        let badgeStyle = {
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          display: 'inline-block',
          letterSpacing: '0.03em',
        };

        if (type === 'STATUS_CHANGE') {
          badgeStyle = { ...badgeStyle, backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
        } else if (type === 'COMPONENT_ISSUED' || type === 'INVENTORY_UPDATED') {
          badgeStyle = { ...badgeStyle, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' };
        } else if (type.includes('FAULT') || type.includes('DEDUCTION')) {
          badgeStyle = { ...badgeStyle, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
        } else {
          badgeStyle = { ...badgeStyle, backgroundColor: 'rgba(156, 163, 175, 0.15)', color: '#d1d5db' };
        }

        return <span style={badgeStyle}>{type.replace(/_/g, ' ')}</span>;
      },
    },
    {
      header: 'User',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {row.actor?.name || row.actorRole || row.userEmail || 'System'}
          </div>
          {row.actor?.email && (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {row.actor.email}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Entity / Report ID',
      render: (row) => {
        const reportNum = row.reportNumber || row.report?.reportNumber;
        const reportId = row.reportId || row.report?.id;

        if (reportId && reportNum && reportNum !== 'N/A') {
          return (
            <button
              onClick={() => navigate(`/reports/${reportId}`)}
              style={{
                fontFamily: 'monospace',
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
                fontSize: '13px',
                fontWeight: 600,
              }}
              title="View Report Details"
            >
              {reportNum} <FiExternalLink size={12} />
            </button>
          );
        }

        return (
          <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: '13px' }}>
            {reportNum || '—'}
          </span>
        );
      },
    },
    {
      header: 'Transition / Details',
      render: (row) => {
        if (row.fromStatus && row.toStatus) {
          return (
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{row.fromStatus}</span>
              <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
              <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{row.toStatus}</span>
            </div>
          );
        }
        if (row.fieldName) {
          return (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Field modified: <span style={{ fontWeight: 500 }}>{row.fieldName}</span>
            </div>
          );
        }
        return <span style={{ color: 'var(--text-dim)' }}>—</span>;
      },
    },
    {
      header: 'Notes',
      render: (row) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {row.note || row.notes || '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Global Audit Viewer</h1>
          <p>System-wide activity log & tamper-evident audit trail</p>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="flex gap-12 mb-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 360 }}>
              <FiSearch
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
              <input
                placeholder="Search audits by user, action, ID or notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiFilter style={{ color: 'var(--text-dim)' }} />
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'ALL' ? 'All Actions' : type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-dim)' }}>
              Total Records: <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong>
            </div>
          </div>

          <Table
            columns={columns}
            data={filtered}
            loading={isLoading}
            emptyMessage={
              search || selectedAction !== 'ALL'
                ? 'No audit logs match your filter criteria.'
                : 'No audit logs found.'
            }
          />
        </div>
      </div>
    </>
  );
}
