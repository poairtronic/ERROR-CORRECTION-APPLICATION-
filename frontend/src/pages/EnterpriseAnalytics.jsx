import { useQuery } from '@tanstack/react-query';
import api from '../services/apiClient';
import { FiActivity, FiDollarSign, FiClock, FiAlertTriangle } from 'react-icons/fi';
import KpiCard from '../components/analytics/KpiCard';
import TrendChartWidget from '../components/analytics/TrendChartWidget';
import InsightsListWidget from '../components/analytics/InsightsListWidget';
import ExportDataWidget from '../components/analytics/ExportDataWidget';
import HealthScoreWidget from '../components/analytics/HealthScoreWidget';
import SlaMonitorWidget from '../components/analytics/SlaMonitorWidget';
import { useState } from 'react';

export default function EnterpriseAnalytics() {
  const [activeTab, setActiveTab] = useState('executive');
  // Load preferences from localStorage or default to true
  const [showWidgets, setShowWidgets] = useState(() => {
    const saved = localStorage.getItem('ecr_analytics_prefs');
    return saved ? JSON.parse(saved) : { health: true, sla: true, insights: true };
  });

  const toggleWidget = (key) => {
    const next = { ...showWidgets, [key]: !showWidgets[key] };
    setShowWidgets(next);
    localStorage.setItem('ecr_analytics_prefs', JSON.stringify(next));
  };

  const handlePdfExport = () => {
    const element = document.getElementById('analytics-dashboard-content');
    if (!element) return;
    import('html2pdf.js').then((html2pdf) => {
      const opt = {
        margin: 0.5,
        filename: 'Enterprise-Analytics-Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      };
      html2pdf.default().set(opt).from(element).save();
    });
  };

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis'],
    queryFn: async () => (await api.get('/analytics/kpis')).data
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-trends'],
    queryFn: async () => (await api.get('/analytics/trends')).data
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['analytics-insights'],
    queryFn: async () => (await api.get('/analytics/insights')).data
  });

  const { data: slaData } = useQuery({
    queryKey: ['analytics-sla'],
    queryFn: async () => (await api.get('/analytics/sla')).data
  });

  const { data: healthData } = useQuery({
    queryKey: ['analytics-health'],
    queryFn: async () => (await api.get('/analytics/health-score')).data
  });

  const { data: vendorData } = useQuery({
    queryKey: ['analytics-vendor'],
    queryFn: async () => (await api.get('/analytics/vendor-intelligence')).data,
    enabled: activeTab === 'vendor'
  });

  const { data: operatorData } = useQuery({
    queryKey: ['analytics-operator'],
    queryFn: async () => (await api.get('/analytics/operator-intelligence')).data,
    enabled: activeTab === 'operator'
  });

  const { data: machineData } = useQuery({
    queryKey: ['analytics-machine'],
    queryFn: async () => (await api.get('/analytics/machine-intelligence')).data,
    enabled: activeTab === 'machine'
  });

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Enterprise Analytics</h1>
          <p>Executive Dashboard & Intelligence Platform</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={handlePdfExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Export PDF
          </button>
          <ExportDataWidget data={trends} filename="defect-trends.csv" />
        </div>
      </div>

      <div className="page-content" id="analytics-dashboard-content">
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button className={`tab-btn ${activeTab === 'executive' ? 'active' : ''}`} onClick={() => setActiveTab('executive')}>Executive Overview</button>
          <button className={`tab-btn ${activeTab === 'vendor' ? 'active' : ''}`} onClick={() => setActiveTab('vendor')}>Vendor Intelligence</button>
          <button className={`tab-btn ${activeTab === 'operator' ? 'active' : ''}`} onClick={() => setActiveTab('operator')}>Operator Intelligence</button>
          <button className={`tab-btn ${activeTab === 'machine' ? 'active' : ''}`} onClick={() => setActiveTab('machine')}>Machine Intelligence</button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Customize Layout:</span>
          <button className={`btn btn-sm ${showWidgets.health ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleWidget('health')}>Health Score</button>
          <button className={`btn btn-sm ${showWidgets.sla ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleWidget('sla')}>SLA Monitor</button>
          <button className={`btn btn-sm ${showWidgets.insights ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleWidget('insights')}>Insights</button>
        </div>

        {(kpisLoading || trendsLoading) ? <div className="spinner" /> : (
          <>
            {activeTab === 'executive' && (
              <>
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <KpiCard title="Total Defects" value={kpis?.totalReports} desc={`${kpis?.openReports} Open / ${kpis?.closedReports} Closed`} icon={FiActivity} color="#3b82f6" />
                  <KpiCard title="Financial Impact" value={formatCurrency(kpis?.totalCost)} desc={`Loss: ${formatCurrency(kpis?.totalLoss)}`} icon={FiDollarSign} color="#f43f5e" />
                  <KpiCard title="Pending Workflow" value={kpis?.openReports} desc={`Insp: ${kpis?.pendingInspect} | SM: ${kpis?.pendingSm} | GM: ${kpis?.pendingGm}`} icon={FiClock} color="#f59e0b" />
                  <KpiCard title="Vendor Cases" value={kpis?.vendorCases} desc="Attributed to external vendors" icon={FiAlertTriangle} color="#8b5cf6" />
                </div>

                <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 24 }}>
                  {showWidgets.health && <HealthScoreWidget scoreData={healthData} />}
                  {showWidgets.sla && <SlaMonitorWidget slaData={slaData} />}
                  {showWidgets.insights && <InsightsListWidget insights={insights || []} />}
                </div>

                <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
                  <TrendChartWidget title="Monthly Defect Trend" data={trends} dataKey="count" nameKey="month" color="#3b82f6" />
                </div>
              </>
            )}

            {activeTab === 'vendor' && (
              <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
                <TrendChartWidget title="Vendor Defect Volume" data={vendorData} dataKey="defects" nameKey="vendor" color="#8b5cf6" />
              </div>
            )}

            {activeTab === 'operator' && (
              <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
                <TrendChartWidget title="Operator Defect Reports Raised" data={operatorData} dataKey="reportsRaised" nameKey="operator" color="#10b981" />
              </div>
            )}

            {activeTab === 'machine' && (
              <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
                <TrendChartWidget title="Machine Failure Frequency" data={machineData} dataKey="failures" nameKey="machine" color="#f59e0b" />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
