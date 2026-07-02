import { useQuery } from '@tanstack/react-query';
import api from '../../services/apiClient';
import { FiActivity, FiDollarSign, FiClock, FiAlertTriangle } from 'react-icons/fi';
import KpiCard from '../../components/analytics/KpiCard';
import TrendChartWidget from '../../components/analytics/TrendChartWidget';
import InsightsListWidget from '../../components/analytics/InsightsListWidget';
import ExportDataWidget from '../../components/analytics/ExportDataWidget';

export default function EnterpriseAnalytics() {

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

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Enterprise Analytics</h1>
          <p>Executive Dashboard & Intelligence Platform</p>
        </div>
        <div>
          <ExportDataWidget data={trends} filename="defect-trends.csv" />
        </div>
      </div>

      <div className="page-content">
        {(kpisLoading || trendsLoading || insightsLoading) ? <div className="spinner" /> : (
          <>
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <KpiCard title="Total Defects" value={kpis?.totalReports} desc={`${kpis?.openReports} Open / ${kpis?.closedReports} Closed`} icon={FiActivity} color="#3b82f6" />
              <KpiCard title="Financial Impact" value={formatCurrency(kpis?.totalCost)} desc={`Loss: ${formatCurrency(kpis?.totalLoss)}`} icon={FiDollarSign} color="#f43f5e" />
              <KpiCard title="Pending Workflow" value={kpis?.openReports} desc={`Insp: ${kpis?.pendingInspect} | SM: ${kpis?.pendingSm} | GM: ${kpis?.pendingGm}`} icon={FiClock} color="#f59e0b" />
              <KpiCard title="Vendor Cases" value={kpis?.vendorCases} desc="Attributed to external vendors" icon={FiAlertTriangle} color="#8b5cf6" />
            </div>

            <div className="form-grid" style={{ gap: 24, gridTemplateColumns: '2fr 1fr' }}>
              <TrendChartWidget title="Monthly Defect Trend" data={trends} dataKey="count" nameKey="month" color="#3b82f6" />
              <InsightsListWidget insights={insights || []} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
