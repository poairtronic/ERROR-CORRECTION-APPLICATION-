import { useState, useMemo } from 'react';
import { FiFileText, FiDownload, FiX, FiCheck, FiFile } from 'react-icons/fi';

const FORMATS = [
  { id: 'excel', label: 'Excel (.xlsx)', icon: FiFile, desc: 'Formatted spreadsheet with filters and summaries' },
  { id: 'pdf', label: 'PDF (Landscape A4)', icon: FiFileText, desc: 'Professional report with branding and page numbers' },
];

export default function ExportCenterModal({ open, onClose, onExport, reportCount }) {
  const [format, setFormat] = useState('excel');
  const [includeFilters, setIncludeFilters] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeGeneratedBy, setIncludeGeneratedBy] = useState(true);
  const [includeDateTime, setIncludeDateTime] = useState(true);

  const now = useMemo(() => new Date(), [open]);

  const fileName = useMemo(() => {
    const ts = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}`;
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return `Defect_History_Report_${ts}.${ext}`;
  }, [format, now]);

  if (!open) return null;

  const handleExport = () => {
    const options = {
      includeFilters,
      includeSummary,
      includeHeader,
      includeGeneratedBy,
      includeDateTime,
    };
    onExport({
      format,
      options,
      fileName,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto',
        backgroundColor: '#1a1d23', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>Export Report</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {reportCount} record{reportCount !== 1 ? 's' : ''} ready for export
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            padding: 4, display: 'flex', borderRadius: 6,
          }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
             onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <FiX size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {FORMATS.map(f => {
              const Icon = f.icon;
              const selected = format === f.id;
              return (
                <button key={f.id} onClick={() => setFormat(f.id)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: selected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: selected ? 'rgba(94,106,210,0.1)' : 'rgba(255,255,255,0.02)',
                  color: selected ? 'var(--primary-light)' : '#9ca3af',
                  textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: selected ? '#fff' : '#6b7280',
                  }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>{f.desc}</div>
                  </div>
                  {selected && <FiCheck size={16} style={{ marginLeft: 'auto', color: 'var(--primary)' }} />}
                </button>
              );
            })}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
            Include
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {[
              { key: 'includeFilters', label: 'Current Filters', checked: includeFilters, set: setIncludeFilters },
              { key: 'includeSummary', label: 'Summary Statistics', checked: includeSummary, set: setIncludeSummary },
              { key: 'includeHeader', label: 'Company Header', checked: includeHeader, set: setIncludeHeader },
              { key: 'includeGeneratedBy', label: 'Generated By', checked: includeGeneratedBy, set: setIncludeGeneratedBy },
              { key: 'includeDateTime', label: 'Generated Date & Time', checked: includeDateTime, set: setIncludeDateTime },
            ].map(item => (
              <label key={item.key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                backgroundColor: item.checked ? 'rgba(94,106,210,0.06)' : 'transparent',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = item.checked ? 'rgba(94,106,210,0.1)' : 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = item.checked ? 'rgba(94,106,210,0.06)' : 'transparent'}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: item.checked ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                  border: item.checked ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  transition: 'all 0.15s',
                }}>
                  {item.checked && <FiCheck size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: '#d1d5db' }}>{item.label}</span>
                <input type="checkbox" checked={item.checked}
                  onChange={e => item.set(e.target.checked)}
                  style={{ display: 'none' }} />
              </label>
            ))}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            File Name
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 13, color: '#9ca3af', fontFamily: 'monospace',
          }}>
            <FiFile size={14} style={{ flexShrink: 0, color: '#6b7280' }} />
            <span style={{ color: '#d1d5db' }}>{fileName}</span>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '16px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ height: 38, padding: '0 18px', fontSize: 13 }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleExport} style={{
            height: 38, padding: '0 20px', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FiDownload size={14} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
