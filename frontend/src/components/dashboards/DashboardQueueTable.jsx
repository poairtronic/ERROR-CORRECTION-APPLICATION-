import { useNavigate } from 'react-router-dom';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

export default function DashboardQueueTable({ 
  data, 
  columns, 
  emptyMessage = "No pending items.", 
  actionLabel = "Review", 
  onActionClick 
}) {
  const navigate = useNavigate();

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{col.label}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1}>
                <div className="empty-state">
                  <p>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map(item => (
              <tr key={item.id}>
                {columns.map((col, idx) => {
                  let content;
                  if (col.key === 'id') {
                    content = <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.id.slice(0,8).toUpperCase()}</span>;
                  } else if (col.key === 'status') {
                    content = <span className={`badge badge-${STATUS_COLORS[item.status] || 'draft'}`}>{STATUS_LABELS[item.status] || item.status}</span>;
                  } else if (col.render) {
                    content = col.render(item);
                  } else {
                    content = item[col.key] || '—';
                  }

                  return (
                    <td key={idx} style={col.style}>
                      {content}
                    </td>
                  );
                })}
                <td>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => {
                      if (onActionClick) onActionClick(item);
                      else navigate(`/reports/${item.id}`);
                    }}
                  >
                    {actionLabel}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
