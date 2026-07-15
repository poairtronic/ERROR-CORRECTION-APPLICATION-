import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FiClock } from 'react-icons/fi';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: 'rgba(21, 24, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: payload[0].payload.fill }} />
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{payload[0].value} Reports</p>
        </div>
      </div>
    );
  }
  return null;
};

const WorkflowAnalyticsWidget = memo(({ kpis, delay = 0 }) => {
  const data = [
    { name: 'Inspection', value: kpis?.pendingInspect || 0, fill: '#3b82f6' },
    { name: 'Accounts Verification', value: kpis?.pendingAccounts || 0, fill: '#ec4899' },
    { name: 'SM Review', value: kpis?.pendingSm || 0, fill: '#8b5cf6' },
    { name: 'GM Approval', value: kpis?.pendingGm || 0, fill: '#f59e0b' },
  ];

  const totalPending = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="glass-card animate-slide-up" style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
            <FiClock style={{ color: '#a78bfa' }} /> Pending Workflow Distribution
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Total pending actions: <strong style={{ color: '#d1d5db' }}>{totalPending}</strong></p>
        </div>
      </div>
      
      <div style={{ flex: 1, width: '100%', minHeight: '220px' }}>
        {totalPending > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9ca3af', fontSize: 11 }} 
                width={130}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]} 
                barSize={24}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
            <span style={{ color: '#34d399', fontSize: '14px' }}>No workflow bottlenecks detected</span>
          </div>
        )}
      </div>
    </div>
  );
});

WorkflowAnalyticsWidget.displayName = 'WorkflowAnalyticsWidget';
export default WorkflowAnalyticsWidget;
