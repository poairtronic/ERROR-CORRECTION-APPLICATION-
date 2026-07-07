import { memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiTrendingUp } from 'react-icons/fi';

const CustomTooltip = ({ active, payload, label, color }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: 'rgba(21, 24, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{payload[0].value} <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 'normal' }}>Volume</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const TrendChartWidget = memo(({ title, data, dataKey, nameKey, color = '#3b82f6', delay = 0 }) => {
  return (
    <div className={`glass-card animate-slide-up`} style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <FiTrendingUp style={{ color: color }} /> {title}
        </h3>
      </div>
      
      <div style={{ flex: 1, width: '100%', minHeight: '220px' }}>
        {(!data || data.length === 0) ? (
          <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>No trend data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey={nameKey} 
                stroke="#6b7280" 
                tick={{fill: '#6b7280', fontSize: 12}} 
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="#6b7280" 
                tick={{fill: '#6b7280', fontSize: 12}} 
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip color={color} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                strokeWidth={3}
                fillOpacity={1} 
                fill={`url(#color-${dataKey})`} 
                activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2, style: { filter: `drop-shadow(0px 0px 8px ${color})` } }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

TrendChartWidget.displayName = 'TrendChartWidget';
export default TrendChartWidget;
