import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { FiList, FiClock, FiUser, FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const IntegratedAuditLog = memo(({ delay = 0 }) => {
  const navigate = useNavigate();

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['global-audits-recent'],
    queryFn: async () => {
      const { data } = await api.get('/defect-reports');
      const allLogs = data.flatMap(r => 
        (r.auditLogs || []).map(log => ({ ...log, reportId: r.id, reportNumber: r.reportNumber }))
      );
      return allLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    },
    staleTime: 60000
  });

  return (
    <div className="glass-card animate-slide-up" style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <FiList style={{ color: '#60a5fa' }} /> Recent System Audits
        </h3>
        <button 
          onClick={() => navigate('/audits')}
          style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          View Full Log &rarr;
        </button>
      </div>

      <div className="custom-scrollbar" style={{ flex: 1, width: '100%', overflowY: 'auto', paddingRight: '8px', minHeight: '300px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', margin: 0, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)' }} />
          </div>
        ) : audits.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {audits.map((audit, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                
                {/* Icon Marker */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#15181e', color: '#9ca3af', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  {audit.action.toLowerCase().includes('created') ? <FiActivity size={14} /> : 
                   audit.action.toLowerCase().includes('inspection') ? <FiList size={14} /> : 
                   <FiClock size={14} />}
                </div>
                
                {/* Content */}
                <div style={{ flex: 1, padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>{audit.action}</span>
                    <time style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500 }}>
                      {new Date(audit.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </time>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{audit.notes || 'No additional notes'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#6b7280' }}>
                      <FiUser size={10} /> {audit.user?.name || 'System'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                      ID: {audit.reportNumber}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center', fontSize: '14px', color: '#6b7280' }}>
            No recent audit events
          </div>
        )}
      </div>
    </div>
  );
});

IntegratedAuditLog.displayName = 'IntegratedAuditLog';
export default IntegratedAuditLog;
