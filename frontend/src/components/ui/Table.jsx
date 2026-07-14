import { memo } from 'react';

export const Table = memo(function Table({ columns, data = [], emptyMessage = 'No data available', loading = false }) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col, i) => <th key={i}>{col.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(row => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i}><div className="skeleton-line" /></td>
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
              <th key={i}>
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
            data.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col, j) => (
                  <td key={j}>
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
