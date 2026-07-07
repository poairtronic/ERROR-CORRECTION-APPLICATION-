import { useQuery } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiActivity, FiDollarSign, FiClock, FiAlertTriangle, FiDownloadCloud, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import EnterpriseKpiCard from '../components/analytics/EnterpriseKpiCard';
import TrendChartWidget from '../components/analytics/TrendChartWidget';
import HealthScoreWidget from '../components/analytics/HealthScoreWidget';
import WorkflowAnalyticsWidget from '../components/analytics/WorkflowAnalyticsWidget';
import IntelligenceGridWidget from '../components/analytics/IntelligenceGridWidget';
import IntegratedAuditLog from '../components/analytics/IntegratedAuditLog';
import InsightsListWidget from '../components/analytics/InsightsListWidget';
import { useNavigate } from 'react-router-dom';

export default function EnterpriseAnalytics() {
  const navigate = useNavigate();

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
  const { data: healthData, refetch: refetchHealth } = useQuery({ queryKey: ['analytics-health'], queryFn: async () => (await api.get('/analytics/health-score')).data, staleTime: 30000 });
  const { data: vendorData, refetch: refetchVendor } = useQuery({ queryKey: ['analytics-vendor'], queryFn: async () => (await api.get('/analytics/vendor-intelligence')).data, staleTime: 30000 });
  const { data: operatorData, refetch: refetchOperator } = useQuery({ queryKey: ['analytics-operator'], queryFn: async () => (await api.get('/analytics/operator-intelligence')).data, staleTime: 30000 });
  const { data: machineData, refetch: refetchMachine } = useQuery({ queryKey: ['analytics-machine'], queryFn: async () => (await api.get('/analytics/machine-intelligence')).data, staleTime: 30000 });

  const handleRefresh = () => { refetchKpis(); refetchTrends(); refetchInsights(); refetchSla(); refetchHealth(); refetchVendor(); refetchOperator(); refetchMachine(); };

  const isLoading = kpisLoading || trendsLoading;
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

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
              <TrendChartWidget title="Monthly Defect Volume Trend" data={trends} dataKey="count" nameKey="month" color="#3b82f6" delay={400} height={300} />
            </div>

            <div className="col-span-4" style={{ height: '360px' }}>
              <HealthScoreWidget scoreData={healthData} kpis={kpis} sla={slaData} />
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

          </div>
        )}
      </div>
    </>
  );
}
