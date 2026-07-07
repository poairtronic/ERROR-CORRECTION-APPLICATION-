import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FiActivity, FiInfo } from 'react-icons/fi';

const HealthScoreWidget = memo(({ scoreData, kpis, sla }) => {
  const score = scoreData?.score || 100;
  
  // Calculate dynamic penalties to show in the custom tooltip
  const getPenalties = () => {
    const items = [];
    
    // Reverse engineer backend calculations:
    // Open penalty = -2 per open report
    if (kpis?.openReports > 0) {
      const openPenalty = kpis.openReports * 2;
      items.push({ name: 'Open Defect Load', val: `-${openPenalty}`, color: '#ef4444' });
    }
    
    // Cost penalty = -1 for every $100 in loss
    if (kpis?.totalLoss > 0) {
      const costPenalty = Math.floor(kpis.totalLoss / 100);
      if (costPenalty > 0) {
        items.push({ name: 'Financial Loss', val: `-${costPenalty}`, color: '#f59e0b' });
      }
    }
    
    // SLA penalty = -5 for average resolution > 5 days
    if (sla?.averageResolutionDays > 5) {
      items.push({ name: 'SLA Breach (>5 days)', val: '-5', color: '#8b5cf6' });
    }

    if (items.length === 0) {
       items.push({ name: 'Optimal Performance', val: 'No deductions', color: '#10b981' });
    }

    return items;
  };

  const getHealthColor = (val) => {
    if (val >= 90) return '#10b981';
    if (val >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const color = getHealthColor(score);
  
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score }
  ];

  const CustomTooltip = ({ active }) => {
    if (active) {
      const penalties = getPenalties();
      return (
        <div style={{ backgroundColor: 'rgba(21, 24, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
          <p style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Score Deductions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {penalties.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color }} />
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>{p.name}</span>
                </div>
                <span style={{ color: p.color, fontWeight: 'bold', fontSize: '12px' }}>{p.val}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', animationDelay: '400ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <FiActivity style={{ color: color }} /> Enterprise Health Index
        </h3>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={90}
              startAngle={225}
              endAngle={-45}
              dataKey="value"
              stroke="none"
              cornerRadius={8}
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.05)" />
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', paddingTop: '10px' }}>
          <span style={{ fontSize: '48px', fontWeight: 800, color: 'white', lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '12px', color: color, fontWeight: 500, letterSpacing: '1px', marginTop: '4px' }}>
            {score >= 90 ? 'HEALTHY' : score >= 70 ? 'AT RISK' : 'CRITICAL'}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', color: '#6b7280', fontSize: '11px' }}>
        <FiInfo size={12} /> Hover chart to view penalty breakdown
      </div>
    </div>
  );
});

HealthScoreWidget.displayName = 'HealthScoreWidget';
export default HealthScoreWidget;
