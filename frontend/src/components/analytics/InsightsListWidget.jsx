import { memo } from 'react';
import { FiInfo, FiZap } from 'react-icons/fi';

const InsightsListWidget = memo(({ insights = [] }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <FiZap style={{ color: '#facc15' }} /> Rule-Based Insights
        </h3>
      </div>
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        {insights.length === 0 ? (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>No active alerts</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.map((insight, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <FiInfo style={{ color: 'var(--primary-light)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#d1d5db', lineHeight: 1.5, fontWeight: 500 }}>
                  {insight}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

InsightsListWidget.displayName = 'InsightsListWidget';
export default InsightsListWidget;
