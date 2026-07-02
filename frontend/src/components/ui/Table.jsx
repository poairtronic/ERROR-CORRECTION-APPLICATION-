export function Table({ columns, data = [], emptyMessage = 'No data available', loading = false }) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col, i) => <th key={i}>{col.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(row => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i}><div className="skeleton h-6 w-full rounded" /></td>
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
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="p-3 border-b text-sm font-semibold text-slate-600">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i} className="border-b hover:bg-slate-50 transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className="p-3 text-sm">
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
}
