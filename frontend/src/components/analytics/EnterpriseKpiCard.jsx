import { memo } from 'react';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

const EnterpriseKpiCard = memo(({ title, value, prefix = '', suffix = '', desc, icon: Icon, color, trend = null, trendValue = null, onClick = null, delay = 0 }) => {
  return (
    <div 
      className={`glass-card animate-slide-up ${onClick ? 'tr-link' : ''}`}
      style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {prefix && <span style={{ fontSize: '20px', fontWeight: 500, color: '#9ca3af' }}>{prefix}</span>}
            <span className="kpi-value-lg">{value !== undefined ? value : '-'}</span>
            {suffix && <span style={{ fontSize: '20px', fontWeight: 500, color: '#9ca3af', marginLeft: '4px' }}>{suffix}</span>}
          </div>
        </div>
        {Icon && (
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: `${color}15`, color: color }}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{desc}</span>
        
        {trend && (
          <div className={trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-neutral'}>
            {trend === 'up' ? <FiTrendingUp /> : trend === 'down' ? <FiTrendingDown /> : <FiMinus />}
            <span>{trendValue}%</span>
          </div>
        )}
      </div>
    </div>
  );
});

EnterpriseKpiCard.displayName = 'EnterpriseKpiCard';
export default EnterpriseKpiCard;

