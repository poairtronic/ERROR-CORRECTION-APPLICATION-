import { memo } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const HealthScoreWidget = memo(({ scoreData }) => {
  const score = scoreData?.score || 0;
  const trend = scoreData?.trend || 'N/A';
  
  let color = '#ef4444'; // Red
  if (score >= 60) color = '#eab308'; // Yellow
  if (score >= 80) color = '#22c55e'; // Green

  const data = [{ name: 'Score', value: score, fill: color }];

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card-title" style={{ width: '100%', marginBottom: -20, textAlign: 'center' }}>Quality Health Score</div>
      <div style={{ width: 200, height: 200, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={5} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 42, fontWeight: 'bold', color: 'var(--text-primary)' }}>{score}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{trend}</span>
        </div>
      </div>
    </div>
  );
});

export default HealthScoreWidget;
