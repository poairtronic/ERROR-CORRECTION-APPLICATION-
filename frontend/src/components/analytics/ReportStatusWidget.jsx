import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FiActivity } from 'react-icons/fi';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div style={{ backgroundColor: 'rgba(21, 24, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <p style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.payload.color }} />
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{item.value} <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 'normal' }}>Reports</span></span>
        </div>
      </div>
    );
  }
  return null;
};

const ReportStatusWidget = memo(({ kpis, delay = 0 }) => {
  const openCount = kpis?.openReports || 0;
  const closedCount = kpis?.closedReports || 0;
  const total = openCount + closedCount;
  const resolutionRate = total > 0 ? Math.round((closedCount / total) * 100) : 0;

  const data = [
    { name: 'Open', value: openCount, color: '#3b82f6' },
    { name: 'Closed', value: closedCount, color: '#10b981' }
  ];

  return (
    <div className="glass-card animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
            <FiActivity style={{ color: '#3b82f6' }} /> Report Volume by Status
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Resolution Rate: <span style={{ color: '#10b981', fontWeight: 600 }}>{resolutionRate}%</span>
          </p>
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', minHeight: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#6b7280" 
                tick={{ fill: '#9ca3af', fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="#6b7280" 
                tick={{ fill: '#9ca3af', fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]} 
                barSize={40}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#6b7280', fontSize: '14px' }}>No report status data available</div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Reports</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{openCount}</span>
        </div>
        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closed Reports</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{closedCount}</span>
        </div>
      </div>
    </div>
  );
});

ReportStatusWidget.displayName = 'ReportStatusWidget';
export default ReportStatusWidget;
