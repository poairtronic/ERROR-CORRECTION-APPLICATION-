
import { FiDownload } from 'react-icons/fi';

export default function ExportDataWidget({ data, filename = 'export.csv' }) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    // Extract headers
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = headers.map(header => {
        const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <button className="btn btn-outline" onClick={handleExport} disabled={!data || data.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <FiDownload /> Export CSV
    </button>
  );
}
