import { FiClock } from 'react-icons/fi';

export default function SlaMonitorWidget({ slaData }) {
  const avgDays = slaData?.averageResolutionDays || 0;
  
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-title" style={{ marginBottom: 16 }}>SLA & Workflow Bottlenecks</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock style={{ color: 'var(--primary-light)' }} />
            <span>Avg Resolution Time</span>
          </div>
          <strong style={{ fontSize: 18, color: avgDays > 5 ? '#ef4444' : '#22c55e' }}>{avgDays} Days</strong>
        </div>
        
        <div style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Pending Queue</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Inspection Queue</span>
              <strong>{slaData?.inspectionQueue || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SM Review Queue</span>
              <strong>{slaData?.smQueue || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GM Approval Queue</span>
              <strong>{slaData?.gmQueue || 0}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
