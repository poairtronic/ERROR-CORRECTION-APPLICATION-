import { memo } from 'react';

export const Table = memo(function Table({ columns, data = [], emptyMessage = 'No data available', loading = false, onRowClick }) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} style={col.style} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(row => (
              <tr key={row}>
                {columns.map((col, i) => (
                  <td key={i} style={col.style} className={col.className}>
                    <div className="skeleton-line" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={col.style} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                <div className="empty-state"><p>{emptyMessage}</p></div>
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr 
                key={row.id || index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'tr-link' : undefined}
              >
                {columns.map((col, j) => (
                  <td key={j} style={col.style} className={col.className}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
