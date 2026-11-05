import { memo, useState } from 'react';
import { FiUsers, FiBox, FiLayers } from 'react-icons/fi';

const IntelligenceGridWidget = memo(({ vendorData, operatorData, materialData, delay = 0 }) => {
  const [activeTab, setActiveTab] = useState('vendor');

  const tabs = [
    { id: 'vendor', label: 'Vendors', icon: FiBox, data: vendorData || [], key: 'vendor', valKey: 'defects' },
    { id: 'operator', label: 'Operators', icon: FiUsers, data: operatorData || [], key: 'operator', valKey: 'defects' },
    { id: 'material', label: 'Materials', icon: FiLayers, data: materialData || [], key: 'material', valKey: 'defects' },
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const getItemValue = (item) => {
    return parseInt(item[currentTab.valKey] ?? item.defects ?? item.defectsCaused ?? item.failures ?? item.count ?? item.reportsRaised ?? 0) || 0;
  };
  const currentData = currentTab.data.slice(0, 5); // Show top 5
  const maxVal = Math.max(...currentData.map(d => getItemValue(d)), 1); // Avoid division by zero

  return (
    <div className="glass-card animate-slide-up" style={{ animationDelay: `${delay}ms`, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d1d5db', letterSpacing: '0.05em', margin: 0 }}>Entity Intelligence</h3>
        <div className="enterprise-tabs" style={{ display: 'flex', width: '100%' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`enterprise-tab ${activeTab === tab.id ? 'active' : ''}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Icon size={14} /> <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {currentData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {currentData.map((item, index) => {
              const name = item[currentTab.key] || 'Unknown';
              const val = getItemValue(item);
              const percentage = (val / maxVal) * 100;
              const cost = item.cost ? parseFloat(item.cost) : (item.materialCost ? parseFloat(item.materialCost) : null);
              
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '16px' }}>
                      {name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {cost != null && cost > 0 && (
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                          ₹{Math.round(cost).toLocaleString('en-IN')}
                        </span>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                        {val} {currentTab.id === 'material' ? 'items' : ''}
                      </span>
                    </div>
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
