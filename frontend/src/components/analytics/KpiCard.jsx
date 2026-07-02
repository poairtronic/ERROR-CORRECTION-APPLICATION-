import { memo } from 'react';

const KpiCard = memo(({ title, value, desc, icon: Icon, color = 'var(--primary-light)' }) => {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </div>
      <div className="stat-value" style={{ color, marginTop: 4 }}>
        {value}
      </div>
      {desc && <div className="stat-desc" style={{ marginTop: 8 }}>{desc}</div>}
      
      {Icon && (
        <div style={{ position: 'absolute', top: 16, right: 16, color: 'var(--text-muted)', opacity: 0.5, fontSize: 24 }}>
          <Icon />
        </div>
      )}
    </div>
  );
});

export default KpiCard;
