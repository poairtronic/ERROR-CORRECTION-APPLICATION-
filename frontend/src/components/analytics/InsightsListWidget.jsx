import { memo } from 'react';
import { FiInfo } from 'react-icons/fi';

const InsightsListWidget = memo(({ insights = [] }) => {
  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-title" style={{ marginBottom: 16 }}>Rule-Based Insights</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {insights.length === 0 ? (
          <div className="empty-state">No active insights at this time.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {insights.map((insight, i) => (
              <div key={i} style={{ 
                padding: 12, 
                borderRadius: 8, 
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderLeft: '3px solid var(--primary-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <div style={{ color: 'var(--primary-light)', marginTop: 2 }}><FiInfo /></div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {insight}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default InsightsListWidget;
