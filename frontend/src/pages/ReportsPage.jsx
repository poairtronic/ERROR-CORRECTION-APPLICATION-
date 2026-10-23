import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiPlus, FiSearch, FiDownload, FiTrash2 } from 'react-icons/fi';
import { Table } from '../components/ui/Table';
import Dialog from '../components/ui/Dialog';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import ExportCenterModal from '../components/export/ExportCenterModal';
import { exportToExcel } from '../services/excelExportService';
import { exportToPDF } from '../services/pdfExportService';
import { toast } from 'react-hot-toast';

import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

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

  const filtered = useMemo(() => {
    return reports.filter(r => {
      const searchParts = [
        r.reportNumber,
        r.id,
        r.scNo,
        r.poNo,
        r.componentName,
        r.errorTypeName,
        r.defectDescription,
        r.status,
        STATUS_LABELS[r.status],
        r.raisedBy?.name,
        r.raisedBy?.username,
        r.inspectionDetail?.dcNumber,
        r.inspectionDetail?.responsibleParty,
        r.inspectionDetail?.errorType,
        r.inspectionDetail?.reworkDescription,
        r.inspectionDetail?.rejectionDescription,
        r.inspectionDetail?.rejectionFailedStage,
        r.rejectionFailedStage,
        r.stageOfFailure
      ];
      const searchStr = searchParts.filter(Boolean).join(' ').toLowerCase();
      const matchSearch = !debouncedSearch || searchStr.includes(debouncedSearch.toLowerCase());
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
  }, [reports, debouncedSearch, filterStatus, startDate, endDate]);

  const filters = useMemo(() => ({
    search: debouncedSearch,
    status: filterStatus,
    startDate,
    endDate,
  }), [debouncedSearch, filterStatus, startDate, endDate]);

  // Bulk selection calculations
  const allFilteredSelected = useMemo(() => {
    return filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));
  }, [filtered, selectedIds]);

  const someFilteredSelected = useMemo(() => {
    return filtered.some(r => selectedIds.has(r.id));
  }, [filtered, selectedIds]);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (filtered.length > 0 && filtered.every(r => next.has(r.id))) {
        filtered.forEach(r => next.delete(r.id));
      } else {
        filtered.forEach(r => next.add(r.id));
      }
      return next;
    });
  }, [filtered]);

  const handleToggleRow = useCallback((id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(({ format, options }) => {
    setExportModalOpen(false);
    setTimeout(() => {
      if (format === 'excel') {
        exportToExcel(filtered, filters, user);
      } else if (format === 'pdf') {
        exportToPDF(filtered, filters, user);
      }
    }, 200);
  }, [filtered, filters, user]);

  const handleNavigateReport = useCallback((id) => {
    navigate(`/reports/${id}`);
  }, [navigate]);

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/defect-reports/${reportToDelete.id}`);
      toast.success('Quality Report deleted successfully.');
      setSelectedIds(prev => {
        if (prev.has(reportToDelete.id)) {
          const next = new Set(prev);
          next.delete(reportToDelete.id);
          return next;
        }
        return prev;
      });
      queryClient.invalidateQueries({ queryKey: ['defect-reports'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setReportToDelete(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete Quality Report';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      setIsBulkDeleting(true);
      setDeleteProgress({ current: 0, total: ids.length });

      try {
        await api.post('/defect-reports/bulk-delete', { ids });
      } catch (err) {
        // Fallback: sequential delete if bulk route is not yet active
        let completed = 0;
        for (const id of ids) {
          await api.delete(`/defect-reports/${id}`);
          completed++;
          setDeleteProgress({ current: completed, total: ids.length });
        }
      }

      toast.success(`Successfully deleted ${ids.length} Quality Report${ids.length > 1 ? 's' : ''}.`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['defect-reports'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setBulkDeleteOpen(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete selected Quality Reports';
      toast.error(msg);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [];

    if (isAdmin) {
      cols.push({
        header: (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={el => {
                if (el) {
                  el.indeterminate = someFilteredSelected && !allFilteredSelected;
                }
              }}
              onChange={handleToggleSelectAll}
              aria-label="Select all reports"
              title={allFilteredSelected ? 'Deselect all' : 'Select all'}
              style={{
                width: 16,
                height: 16,
                cursor: 'pointer',
                accentColor: 'var(--primary, #5e6ad2)',
                margin: 0,
                display: 'block'
              }}
            />
          </div>
        ),
        render: (row) => (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selectedIds.has(row.id)}
              onChange={(e) => handleToggleRow(row.id, e)}
              aria-label={`Select report ${row.reportNumber}`}
              style={{
                width: 16,
                height: 16,
                cursor: 'pointer',
                accentColor: 'var(--primary, #5e6ad2)',
                margin: 0,
                display: 'block'
              }}
            />
          </div>
        ),
        style: { width: 44, textAlign: 'center', padding: '10px 8px' }
      });
    }

    cols.push(
      { header: 'Report ID', render: (row) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.reportNumber}</span> },
      { header: 'SC / PO Number', render: (row) => `${row.scNo || '—'} / ${row.poNo || '—'}` },
      { header: 'Description', render: (row) => <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.defectDescription}</div> },
      { header: 'Component', accessor: 'componentName' },
      { header: 'Error Type', accessor: 'errorTypeName' },
      { header: 'Status', render: (row) => <span className={`badge badge-${STATUS_COLORS[row.status] || 'draft'}`}>{STATUS_LABELS[row.status] || row.status}</span> },
      { header: 'Raised By', render: (row) => row.raisedBy?.name || '—' },
      { header: 'Date', render: (row) => <span style={{ color: 'var(--text-muted)' }}>{new Date(row.createdAt).toLocaleDateString('en-IN')}</span> },
      { 
        header: 'Action', 
        render: (row) => (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => handleNavigateReport(row.id)}>View</button>
            {isAdmin && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setReportToDelete(row)}
                title="Delete Quality Report"
                style={{ color: 'var(--danger, #ef4444)', padding: '6px 8px' }}
              >
                <FiTrash2 size={16} />
              </button>
            )}
          </div>
        ) 
      }
    );

    return cols;
  }, [isAdmin, allFilteredSelected, someFilteredSelected, handleToggleSelectAll, selectedIds, handleToggleRow, handleNavigateReport]);

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

            <button className="btn btn-primary" onClick={() => setExportModalOpen(true)} style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', fontSize: 13 }}>
              <FiDownload size={14} /> Export
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '10px 16px',
              marginBottom: '16px',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main, #fff)' }}>
                  {selectedIds.size} of {filtered.length} report{selectedIds.size > 1 ? 's' : ''} selected
                </span>
                <button 
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: 12, padding: '4px 8px', color: 'var(--text-muted)' }}
                >
                  Deselect all
                </button>
                {selectedIds.size < filtered.length && (
                  <button 
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedIds(new Set(filtered.map(r => r.id)))}
                    style={{ fontSize: 12, padding: '4px 8px', color: 'var(--primary-light, #818cf8)' }}
                  >
                    Select all {filtered.length} filtered
                  </button>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: 'var(--danger, #ef4444)',
                    color: '#fff',
                    fontWeight: 600,
                    padding: '6px 14px'
                  }}
                >
                  <FiTrash2 size={15} /> Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="No reports found." />
        </div>
      </div>

      <ExportCenterModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
        reportCount={filtered.length}
      />

      {/* Single Report Delete Dialog */}
      <Dialog
        open={Boolean(reportToDelete)}
        onClose={() => !isDeleting && setReportToDelete(null)}
        title="Delete Quality Report"
        maxWidth="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setReportToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              style={{ backgroundColor: 'var(--danger, #ef4444)', color: '#fff' }}
            >
              {isDeleting ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </div>
        }
      >
        <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: 1.6 }}>
          <p style={{ fontWeight: 600, color: 'var(--danger, #ef4444)', marginBottom: 12 }}>
            You are about to permanently delete this Quality Report ({reportToDelete?.reportNumber}).
          </p>
          <p style={{ marginBottom: 12 }}>
            This action cannot be undone.
          </p>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>
            The following information will also be permanently removed:
          </p>
          <ul style={{ paddingLeft: '20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
            <li>Report Details</li>
            <li>Inspection Details</li>
            <li>Financial Impact</li>
            <li>Workflow History</li>
            <li>Approval Records</li>
            <li>Status History</li>
            <li>Audit Logs</li>
            <li>Email Logs</li>
            <li>Notifications</li>
            <li>Timeline Records</li>
            <li>Component Issues</li>
            <li>Vendor Fault Records</li>
            <li>Dashboard Analytics</li>
            <li>Generated Reports</li>
            <li>Any other data linked to this Report</li>
          </ul>
          <p style={{ fontWeight: 600, marginBottom: 12 }}>
            Deleted records cannot be recovered.
          </p>
          <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            Do you want to permanently delete this report?
          </p>
        </div>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog
        open={bulkDeleteOpen}
        onClose={() => !isBulkDeleting && setBulkDeleteOpen(false)}
        title="Delete Selected Quality Reports"
        maxWidth="540px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setBulkDeleteOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleConfirmBulkDelete}
              disabled={isBulkDeleting}
              style={{ backgroundColor: 'var(--danger, #ef4444)', color: '#fff' }}
            >
              {isBulkDeleting 
                ? `Deleting (${deleteProgress.current}/${deleteProgress.total})…` 
                : `Delete ${selectedIds.size} Report${selectedIds.size > 1 ? 's' : ''} Permanently`
              }
            </button>
          </div>
        }
      >
        <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: 1.6 }}>
          <p style={{ fontWeight: 600, color: 'var(--danger, #ef4444)', marginBottom: 12 }}>
            You are about to permanently delete {selectedIds.size} Quality Report{selectedIds.size > 1 ? 's' : ''}.
          </p>
          <p style={{ marginBottom: 12 }}>
            This action cannot be undone.
          </p>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>
            The following information will also be permanently removed for each selected report:
          </p>
          <ul style={{ paddingLeft: '20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
            <li>Report Details & Inspection Details</li>
            <li>Financial Impact & Cost Breakdown</li>
            <li>Workflow History & Approval Records</li>
            <li>Audit Logs, Notifications & Email Logs</li>
            <li>Component Issues & Vendor Fault Records</li>
            <li>Dashboard Analytics & Generated Reports</li>
          </ul>
          <p style={{ fontWeight: 600, marginBottom: 12 }}>
            Deleted records cannot be recovered.
          </p>
          <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            Are you sure you want to permanently delete these {selectedIds.size} reports?
          </p>
        </div>
      </Dialog>
    </>
  );
}
