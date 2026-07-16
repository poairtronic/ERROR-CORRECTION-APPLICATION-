import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiActivity, FiDollarSign, FiClock, FiAlertTriangle, FiDownloadCloud, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import EnterpriseKpiCard from '../components/analytics/EnterpriseKpiCard';
import TrendChartWidget from '../components/analytics/TrendChartWidget';
import ReportStatusWidget from '../components/analytics/ReportStatusWidget';
import WorkflowAnalyticsWidget from '../components/analytics/WorkflowAnalyticsWidget';
import IntelligenceGridWidget from '../components/analytics/IntelligenceGridWidget';
import IntegratedAuditLog from '../components/analytics/IntegratedAuditLog';
import InsightsListWidget from '../components/analytics/InsightsListWidget';
import { useNavigate } from 'react-router-dom';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/constants';

export default function EnterpriseAnalytics() {
  const navigate = useNavigate();

  const [selectedComponent, setSelectedComponent] = useState('');
  const [selectedErrorType, setSelectedErrorType] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handlePdfExport = () => {
    const element = document.getElementById('analytics-dashboard-content');
    if (!element) return;
    import('html2pdf.js').then((html2pdf) => {
      const opt = {
        margin: 0.5,
        filename: 'Enterprise-Intelligence-Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      };
      html2pdf.default().set(opt).from(element).save();
    });
  };

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({ queryKey: ['analytics-kpis'], queryFn: async () => (await api.get('/analytics/kpis')).data, staleTime: 30000 });
  const { data: trends, isLoading: trendsLoading, refetch: refetchTrends } = useQuery({ queryKey: ['analytics-trends'], queryFn: async () => (await api.get('/analytics/trends')).data, staleTime: 30000 });
  const { data: insights, refetch: refetchInsights } = useQuery({ queryKey: ['analytics-insights'], queryFn: async () => (await api.get('/analytics/insights')).data, staleTime: 30000 });
  const { data: slaData, refetch: refetchSla } = useQuery({ queryKey: ['analytics-sla'], queryFn: async () => (await api.get('/analytics/sla')).data, staleTime: 30000 });
  const { data: vendorData, refetch: refetchVendor } = useQuery({ queryKey: ['analytics-vendor'], queryFn: async () => (await api.get('/analytics/vendor-intelligence')).data, staleTime: 30000 });
  const { data: operatorData, refetch: refetchOperator } = useQuery({ queryKey: ['analytics-operator'], queryFn: async () => (await api.get('/analytics/operator-intelligence')).data, staleTime: 30000 });
  const { data: machineData, refetch: refetchMachine } = useQuery({ queryKey: ['analytics-machine'], queryFn: async () => (await api.get('/analytics/machine-intelligence')).data, staleTime: 30000 });

  const { data: reports = [], refetch: refetchReports } = useQuery({ queryKey: ['analytics-reports-list'], queryFn: async () => (await api.get('/defect-reports')).data || [] });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: async () => (await api.get('/master-data/components')).data || [] });
  const { data: errorTypes = [] } = useQuery({ queryKey: ['error-types'], queryFn: async () => (await api.get('/master-data/error-types')).data || [] });
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: async () => (await api.get('/master-data/vendors')).data || [] });
  const { data: operators = [] } = useQuery({ queryKey: ['operators'], queryFn: async () => (await api.get('/master-data/operators')).data || [] });

  const handleRefresh = () => { refetchKpis(); refetchTrends(); refetchInsights(); refetchSla(); refetchVendor(); refetchOperator(); refetchMachine(); refetchReports(); };

  const isLoading = kpisLoading || trendsLoading;
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const uniqueStages = Array.from(new Set(reports.map(r => r.rejectionFailedStage || r.inspectionDetail?.rejectionFailedStage || r.stageOfFailure).filter(Boolean)));

  const filteredReports = reports.filter(report => {
    if (selectedComponent && report.componentName !== selectedComponent) {
      return false;
    }
    if (selectedErrorType) {
      const errType = report.errorTypeName || report.inspectionDetail?.errorType;
      if (errType !== selectedErrorType) return false;
    }
    if (selectedVendor) {
      const isVendor = report.inspectionDetail?.responsibleParty === 'VENDOR';
      if (!isVendor) return false;
      const vendorObj = vendors.find(v => v.id === report.inspectionDetail?.responsibleId);
      const vendorName = vendorObj ? vendorObj.name : report.inspectionDetail?.responsibleId;
      if (vendorName !== selectedVendor && report.inspectionDetail?.responsibleId !== selectedVendor) {
        return false;
      }
    }
    if (selectedOperator) {
      const isOperator = report.inspectionDetail?.responsibleParty === 'OPERATOR';
      if (!isOperator) return false;
      const operatorObj = operators.find(o => o.id === report.inspectionDetail?.responsibleId);
      const operatorName = operatorObj ? operatorObj.name : report.inspectionDetail?.responsibleId;
      if (operatorName !== selectedOperator && report.inspectionDetail?.responsibleId !== selectedOperator) {
        return false;
      }
    }
    if (selectedStage) {
      const stage = report.rejectionFailedStage || report.inspectionDetail?.rejectionFailedStage || report.stageOfFailure;
      if (stage !== selectedStage) return false;
    }
    if (startDate) {
      const repDate = new Date(report.createdAt);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (repDate < start) return false;
    }
    if (endDate) {
      const repDate = new Date(report.createdAt);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (repDate > end) return false;
    }
    return true;
  });

  return (
    <>
      <div className="topbar" style={{ backgroundColor: 'rgba(13, 15, 18, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px', color: 'rgba(255,255,255,0.9)' }}>Enterprise Analytics</h1>
          <p style={{ fontSize: '12px', color: 'var(--primary-light)', fontWeight: 500, letterSpacing: '0.5px', marginTop: '4px', textTransform: 'uppercase' }}>Manufacturing Intelligence Center</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '99px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
            <FiCalendar /> Live Data Feed
          </div>
          <div style={{ height: '24px', width: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={handleRefresh} title="Refresh Data">
            <FiRefreshCw size={16} />
          </button>
          <button className="btn btn-primary" style={{ boxShadow: '0 4px 12px rgba(94, 106, 210, 0.2)' }} onClick={handlePdfExport}>
            <FiDownloadCloud /> Export Report
          </button>
        </div>
      </div>

      <div className="page-content custom-scrollbar" id="analytics-dashboard-content" style={{ backgroundColor: '#0d0f12', paddingBottom: '48px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
            <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', width: '40px', height: '40px' }}></div>
            <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Aggregating Enterprise Data...</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            
            {/* Top KPI Row */}
            <div className="col-span-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '8px' }}>
              <EnterpriseKpiCard 
                title="Total Defects" value={kpis?.totalReports} desc={`${kpis?.openReports} Open / ${kpis?.closedReports} Closed`} 
                icon={FiActivity} color="#3b82f6" delay={0} onClick={() => navigate('/reports')}
              />
              <EnterpriseKpiCard 
                title="Financial Impact" value={formatCurrency(kpis?.totalCost)} desc={`Rework Loss: ${formatCurrency(kpis?.totalLoss)}`} 
                icon={FiDollarSign} color="#f43f5e" delay={100}
              />
              <EnterpriseKpiCard 
                title="SLA Compliance" value={slaData?.averageResolutionDays} suffix="Days" desc="Average Resolution Time" 
                icon={FiClock} color="#10b981" trend={parseFloat(slaData?.averageResolutionDays) > 5 ? 'down' : 'up'} trendValue={parseFloat(slaData?.averageResolutionDays) > 5 ? 'Warning' : 'Good'} delay={200}
              />
              <EnterpriseKpiCard 
                title="Vendor Attributed" value={kpis?.vendorCases} desc="Cases caused by external vendors" 
                icon={FiAlertTriangle} color="#8b5cf6" delay={300}
              />
            </div>

            {/* Main Charts Row */}
            <div className="col-span-8" style={{ height: '360px' }}>
              <TrendChartWidget title="Defect Volume Trend" data={trends} color="#3b82f6" delay={400} />
            </div>

            <div className="col-span-4" style={{ height: '360px' }}>
              <ReportStatusWidget kpis={kpis} delay={400} />
            </div>

            {/* Intelligence Row */}
            <div className="col-span-4" style={{ height: '380px' }}>
              <WorkflowAnalyticsWidget kpis={kpis} delay={500} />
            </div>

            <div className="col-span-4" style={{ height: '380px' }}>
              <IntelligenceGridWidget vendorData={vendorData} operatorData={operatorData} machineData={machineData} delay={600} />
            </div>

            <div className="col-span-4" style={{ height: '380px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card animate-slide-up" style={{ animationDelay: '700ms', padding: 0, flex: 1, overflow: 'hidden' }}>
                 <InsightsListWidget insights={insights || []} />
              </div>
            </div>

            {/* Bottom Row: Audit */}
            <div className="col-span-12">
              <IntegratedAuditLog delay={800} />
            </div>

            {/* Bottom Row: Filtered Reports History Table */}
            <div className="col-span-12 glass-card animate-slide-up" style={{ animationDelay: '900ms', padding: '24px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Defect History & Filters</h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Filter overall history by master data categories</p>
                </div>
                {(selectedComponent || selectedErrorType || selectedVendor || selectedOperator || selectedStage || startDate || endDate) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setSelectedComponent('');
                    setSelectedErrorType('');
                    setSelectedVendor('');
                    setSelectedOperator('');
                    setSelectedStage('');
                    setStartDate('');
                    setEndDate('');
                  }} style={{ fontSize: '12px', color: 'var(--primary-light)' }}>
                    Reset Filters
                  </button>
                )}
              </div>

              {/* 5 Dropdown Filters Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Component</label>
                  <select 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                    value={selectedComponent} 
                    onChange={e => setSelectedComponent(e.target.value)}
                  >
                    <option value="" style={{ background: '#111827' }}>All Components</option>
                    {components.map(c => <option key={c.id} value={c.name} style={{ background: '#111827' }}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error Type</label>
                  <select 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                    value={selectedErrorType} 
                    onChange={e => setSelectedErrorType(e.target.value)}
                  >
                    <option value="" style={{ background: '#111827' }}>All Error Types</option>
                    {errorTypes.map(et => <option key={et.id} value={et.name} style={{ background: '#111827' }}>{et.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vendor</label>
                  <select 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                    value={selectedVendor} 
                    onChange={e => setSelectedVendor(e.target.value)}
                  >
                    <option value="" style={{ background: '#111827' }}>All Vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.name} style={{ background: '#111827' }}>{v.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operator</label>
                  <select 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                    value={selectedOperator} 
                    onChange={e => setSelectedOperator(e.target.value)}
                  >
                    <option value="" style={{ background: '#111827' }}>All Operators</option>
                    {operators.map(o => <option key={o.id} value={o.name} style={{ background: '#111827' }}>{o.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage of Failure</label>
                  <select 
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '13px' }}
                    value={selectedStage} 
                    onChange={e => setSelectedStage(e.target.value)}
                  >
                    <option value="" style={{ background: '#111827' }}>All Stages</option>
                    {uniqueStages.map(st => <option key={st} value={st} style={{ background: '#111827' }}>{st}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</label>
                  <input 
                    type="date"
                    style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      color: 'white', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      outline: 'none', 
                      fontSize: '13px',
                      colorScheme: 'dark'
                    }}
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Date</label>
                  <input 
                    type="date"
                    style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      color: 'white', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      outline: 'none', 
                      fontSize: '13px',
                      colorScheme: 'dark'
                    }}
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#d1d5db' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Report No</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Component</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Error Type</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Responsible Party</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Stage of Failure</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af' }}>Status</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af', textAlign: 'right' }}>Total Cost</th>
                      <th style={{ padding: '12px 8px', fontWeight: 600, color: '#9ca3af', textAlign: 'right' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.length > 0 ? (
                      filteredReports.map(r => {
                        let respName = '—';
                        if (r.inspectionDetail?.responsibleParty) {
                          const id = r.inspectionDetail.responsibleId;
                          if (r.inspectionDetail.responsibleParty === 'OPERATOR') {
                            respName = operators.find(o => o.id === id)?.name || id || 'Operator';
                          } else {
                            respName = vendors.find(v => v.id === id)?.name || id || 'Vendor';
                          }
                        }
                        
                        return (
                          <tr 
                            key={r.id} 
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s' }}
                            onClick={() => navigate(`/reports/${r.id}`)}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 8px', color: 'var(--primary-light)', fontWeight: 600 }}>{r.reportNumber}</td>
                            <td style={{ padding: '12px 8px' }}>{r.componentName || '—'}</td>
                            <td style={{ padding: '12px 8px' }}>{r.errorTypeName || r.inspectionDetail?.errorType || '—'}</td>
                            <td style={{ padding: '12px 8px' }}>{respName}</td>
                            <td style={{ padding: '12px 8px' }}>{r.rejectionFailedStage || r.inspectionDetail?.rejectionFailedStage || r.stageOfFailure || '—'}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span className={`badge badge-${STATUS_COLORS[r.status] || 'draft'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                {STATUS_LABELS[r.status] || r.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                              ${r.inspectionDetail?.costEstimate || 0}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>
                              {new Date(r.createdAt).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                          No reports match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
