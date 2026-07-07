import { memo, useState } from 'react';
import { FiUsers, FiBox, FiCpu } from 'react-icons/fi';

const IntelligenceGridWidget = memo(({ vendorData, operatorData, machineData, delay = 0 }) => {
  const [activeTab, setActiveTab] = useState('vendor');

  const tabs = [
    { id: 'vendor', label: 'Vendors', icon: FiBox, data: vendorData || [], key: 'vendor', valKey: 'defects' },
    { id: 'operator', label: 'Operators', icon: FiUsers, data: operatorData || [], key: 'operator', valKey: 'reportsRaised' },
    { id: 'machine', label: 'Machines', icon: FiCpu, data: machineData || [], key: 'machine', valKey: 'failures' },
  ];

  const currentTab = tabs.find(t => t.id === activeTab);
  const currentData = currentTab.data.slice(0, 5); // Show top 5
  const maxVal = Math.max(...currentData.map(d => parseInt(d[currentTab.valKey]) || 0), 1); // Avoid division by zero

  return (
    <div className="glass-card animate-slide-up" style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', letterSpacing: '0.05em', margin: 0 }}>Entity Intelligence</h3>
        <div className="enterprise-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`enterprise-tab ${activeTab === tab.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon size={14} /> <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {currentData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {currentData.map((item, index) => {
              const name = item[currentTab.key] || 'Unknown';
              const val = parseInt(item[currentTab.valKey]) || 0;
              const percentage = (val / maxVal) * 100;
              
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '16px' }}>{name}</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{val}</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '99px', overflow: 'hidden' }}>
                    <div 
                      style={{ height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, var(--primary), var(--primary-light))', width: `${percentage}%`, transition: 'width 1s ease-out' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center', fontSize: '14px', color: '#6b7280' }}>
            No data available for {currentTab.label.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
});

IntelligenceGridWidget.displayName = 'IntelligenceGridWidget';
export default IntelligenceGridWidget;
