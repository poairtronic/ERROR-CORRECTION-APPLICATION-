import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

const PDF_WIDTH = 1056;
const PDF_HEIGHT = 746;
const PAGE_PADDING = 48;
const CONTENT_WIDTH = PDF_WIDTH - PAGE_PADDING * 2;
const CHART_COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4'];
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_400 = '#9ca3af';
const GRAY_500 = '#6b7280';
const GRAY_600 = '#4b5563';
const GRAY_900 = '#111827';
const BRAND = '#1e3a5f';
const BRAND_LIGHT = '#3b82f6';
const COVER_BG = '#0a1628';

function formatCurrency(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function PdfHeader({ section }) {
  return (
    <div style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={logoMark}>{'VM'}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, letterSpacing: 1 }}>VELAN METROLOGY</div>
          <div style={{ fontSize: 8, color: GRAY_400, letterSpacing: 0.5 }}>QUALITY CONTROL DIVISION</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: GRAY_500 }}>
        {section}
      </div>
    </div>
  );
}

function PdfFooter({ page, total }) {
  return (
    <div style={footerStyle}>
      <span style={{ color: GRAY_400, fontSize: 8 }}>CONFIDENTIAL</span>
      <span style={{ color: GRAY_400, fontSize: 8 }}>
        Velan Metrology — Enterprise Error Correction Report
      </span>
      <span style={{ color: GRAY_400, fontSize: 8 }}>
        Generated: {new Date().toLocaleString('en-IN')} | Page {page} of {total}
      </span>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '20px 16px',
      border: `1px solid ${GRAY_200}`, display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: GRAY_500, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, color: GRAY_900, lineHeight: 1.1 }}>{value ?? '-'}</span>
      {sub && <span style={{ fontSize: 9, color: GRAY_400, marginTop: 6 }}>{sub}</span>}
      <div style={{ height: 3, width: '40%', background: color, borderRadius: 2, marginTop: 12 }} />
    </div>
  );
}

export default function AnalyticsReportPDF({ data }) {
  if (!data) {
    return (
      <div style={{ width: PDF_WIDTH, height: PDF_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center', color: GRAY_400, fontSize: 14 }}>Loading report data...</div>
      </div>
    );
  }

  const {
    kpis, trends, slaData, vendorData, operatorData, machineData, insights,
  } = data;

  const resolutionRate = useMemo(() => {
    if (!kpis?.totalReports) return 0;
    return Math.round((kpis.closedReports / kpis.totalReports) * 100);
  }, [kpis]);

  const slaPercent = useMemo(() => {
    if (!slaData?.total || !slaData?.withinSla) return 0;
    return Math.round((slaData.withinSla / slaData.total) * 100);
  }, [slaData]);

  const statusSummary = useMemo(() => {
    if (!kpis) return [];
    const statuses = ['PENDING_INSPECTION', 'PENDING_ACCOUNTS_REVIEW', 'PENDING_SM_REVIEW',
      'PENDING_GM_APPROVAL', 'APPROVED', 'REWORK_IN_PROGRESS', 'NEW_PRODUCTION', 'CLOSED', 'REJECTED'];
    return statuses.map(s => ({
      name: STATUS_LABELS[s] || s,
      value: kpis[`${s.charAt(0).toLowerCase()}${s.slice(1).toLowerCase()}`] ||
             kpis[s.toLowerCase()] || 0,
      color: STATUS_COLORS[s] || GRAY_400,
    }));
  }, [kpis]);

  return (
    <div style={pdfContainerStyle}>
      {/* ===== PAGE 1: COVER ===== */}
      <div style={coverPageStyle}>
        <div style={coverOverlayStyle} />
        <div style={coverContentStyle}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(255,255,255,0.12)', marginBottom: 20,
              fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: 2,
            }}>VM</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
              Velan Metrology
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Quality Control Division
            </div>
          </div>

          <div style={{ width: 80, height: 3, background: BRAND_LIGHT, borderRadius: 2, marginBottom: 32 }} />

          <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -1, marginBottom: 12 }}>
            Enterprise Error Correction<br />Manufacturing Intelligence Report
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 400, marginBottom: 48, maxWidth: '70%' }}>
            Comprehensive analysis of defect detection, resolution workflows, and manufacturing quality metrics.
          </div>

          <div style={coverMetaStyle}>
            <MetaRow label="Report Period" value={`${formatDate(new Date())} — ${formatDate(new Date())}`} />
            <MetaRow label="Generated" value={`${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`} />
            <MetaRow label="Generated By" value="Enterprise Analytics Engine — v2.0" />
            <MetaRow label="Classification" value="Confidential — Management Only" />
            <MetaRow label="Report ID" value={`ECR-RPT-${Date.now().toString(36).toUpperCase()}`} />
          </div>

          <div style={{
            position: 'absolute', bottom: 48, left: PAGE_PADDING, right: PAGE_PADDING,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>
              CONFIDENTIAL — This report contains proprietary manufacturing quality data
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
              Page 1 of 5
            </div>
          </div>

          <div style={watermarkStyle}>CONFIDENTIAL</div>
        </div>
      </div>

      {/* ===== PAGE 2: EXECUTIVE SUMMARY ===== */}
      <div style={pageStyle}>
        <PdfHeader section="Executive Summary" />
        <div style={pageContentStyle}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: GRAY_900, marginBottom: 4 }}>Executive Summary</div>
            <div style={{ fontSize: 10, color: GRAY_400 }}>Key performance indicators as of {formatDate(new Date())}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Total Reports" value={kpis?.totalReports ?? '-'} sub="All time defect reports" color={BRAND_LIGHT} icon="📊" />
            <KpiCard label="Open Reports" value={kpis?.openReports ?? '-'} sub="Currently active cases" color="#f59e0b" icon="🔄" />
            <KpiCard label="Closed Reports" value={kpis?.closedReports ?? '-'} sub="Successfully resolved" color="#10b981" icon="✅" />
            <KpiCard label="Resolution Rate" value={`${resolutionRate}%`} sub="Closed / Total ratio" color="#8b5cf6" icon="🎯" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Financial Impact" value={formatCurrency(kpis?.totalCost)} sub={`Rework loss: ${formatCurrency(kpis?.totalLoss)}`} color="#f43f5e" icon="💰" />
            <KpiCard label="Vendor Attributed" value={kpis?.vendorCases ?? '-'} sub="External vendor defects" color="#f43f5e" icon="🏭" />
            <KpiCard label="Avg Resolution" value={slaData?.averageResolutionDays ?? '-'} sub="Days to close" color="#06b6d4" icon="⏱" />
            <KpiCard label="SLA Compliance" value={`${slaPercent}%`} sub="Within target timeframe" color="#10b981" icon="✓" />
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 8, padding: 20, border: `1px solid ${GRAY_200}`, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: GRAY_600, marginBottom: 12 }}>Analytics Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <OverviewItem label="Pipeline Health" value={kpis?.openReports > 5 ? 'Elevated — review required' : 'Stable'} color={kpis?.openReports > 5 ? '#f59e0b' : '#10b981'} />
              <OverviewItem label="Top Defect Source" value={kpis?.topDefectSource || 'N/A'} color={BRAND_LIGHT} />
              <OverviewItem label="Resolution Target" value={slaPercent >= 90 ? 'On Track' : 'Needs Attention'} color={slaPercent >= 90 ? '#10b981' : '#f43f5e'} />
              <OverviewItem label="Data Currency" value="Real-time integrated" color="#10b981" />
            </div>
          </div>
        </div>
        <PdfFooter page={2} total={5} />
      </div>

      {/* ===== PAGE 3: DEFECT TREND & STATUS ===== */}
      <div style={pageStyle}>
        <PdfHeader section="Defect Analytics — Trend & Status" />
        <div style={pageContentStyle}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: GRAY_900, marginBottom: 4 }}>Defect Volume Trend</div>
            <div style={{ fontSize: 9, color: GRAY_400 }}>Monthly defect report volume over time</div>
          </div>
          <div style={{ height: 220, marginBottom: 28 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends || []} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRAY_200} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: GRAY_500 }} axisLine={{ stroke: GRAY_200 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: GRAY_500 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: `1px solid ${GRAY_200}` }} />
                <Area type="monotone" dataKey="count" stroke={BRAND_LIGHT} strokeWidth={2} fill="url(#trendFill)" dot={{ r: 3, fill: BRAND_LIGHT }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: GRAY_600, marginBottom: 12 }}>Status Distribution</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusSummary.filter(s => s.value > 0)} margin={{ top: 4, right: 8, left: -16, bottom: 4 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={GRAY_200} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: GRAY_500 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: GRAY_500 }} width={120} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                      {statusSummary.filter(s => s.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: GRAY_600, marginBottom: 12 }}>Workflow Pipeline</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'In Inspection', value: kpis?.pendingInspection || 0, color: STATUS_COLORS.PENDING_INSPECTION || GRAY_400 },
                      { name: 'Accounts Review', value: kpis?.pendingAccountsReview || 0, color: STATUS_COLORS.PENDING_ACCOUNTS_REVIEW || GRAY_400 },
                      { name: 'SM Review', value: kpis?.pendingSmReview || 0, color: STATUS_COLORS.PENDING_SM_REVIEW || GRAY_400 },
                      { name: 'GM Approval', value: kpis?.pendingGmApproval || 0, color: STATUS_COLORS.PENDING_GM_APPROVAL || GRAY_400 },
                    ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {[0, 1, 2, 3].slice(0, 4).map((_, i) => (
                        <Cell key={i} fill={[STATUS_COLORS.PENDING_INSPECTION, STATUS_COLORS.PENDING_ACCOUNTS_REVIEW, STATUS_COLORS.PENDING_SM_REVIEW, STATUS_COLORS.PENDING_GM_APPROVAL][i] || GRAY_400} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 8 }} verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        <PdfFooter page={3} total={5} />
      </div>

      {/* ===== PAGE 4: INTELLIGENCE ===== */}
      <div style={pageStyle}>
        <PdfHeader section="Manufacturing Intelligence" />
        <div style={pageContentStyle}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: GRAY_900, marginBottom: 4 }}>Manufacturing Intelligence</div>
            <div style={{ fontSize: 9, color: GRAY_400 }}>Vendor, operator, and machine performance analysis</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
            <IntelligenceCard title="Top Vendors" data={vendorData} dataKey="count" labelKey="name" color="#8b5cf6" />
            <IntelligenceCard title="Top Operators" data={operatorData} dataKey="count" labelKey="name" color="#3b82f6" />
            <IntelligenceCard title="Top Machines" data={machineData} dataKey="count" labelKey="name" color="#06b6d4" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: `1px solid ${GRAY_200}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: GRAY_600, marginBottom: 8 }}>Decision Engine Insights</div>
              {Array.isArray(insights) && insights.length > 0 ? (
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 9, color: GRAY_500, lineHeight: 1.8 }}>
                  {insights.slice(0, 6).map((insight, i) => (
                    <li key={i}>{typeof insight === 'string' ? insight : insight.message || insight.text || ''}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: 9, color: GRAY_400 }}>No insights generated for this period.</div>
              )}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: `1px solid ${GRAY_200}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: GRAY_600, marginBottom: 8 }}>Cost Impact Analysis</div>
              <div style={{ fontSize: 9, color: GRAY_500, lineHeight: 1.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>Total Estimated Cost</span>
                  <span style={{ fontWeight: 600, color: GRAY_900 }}>{formatCurrency(kpis?.totalCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>Rework Loss Amount</span>
                  <span style={{ fontWeight: 600, color: '#f43f5e' }}>{formatCurrency(kpis?.totalLoss)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${GRAY_200}` }}>
                  <span>Average Cost per Report</span>
                  <span style={{ fontWeight: 600, color: GRAY_900 }}>{kpis?.totalReports ? formatCurrency(kpis.totalCost / kpis.totalReports) : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Vendor Cost Contribution</span>
                  <span style={{ fontWeight: 600, color: GRAY_900 }}>{formatCurrency(kpis?.vendorCost || kpis?.vendorTotal || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <PdfFooter page={4} total={5} />
      </div>

      {/* ===== PAGE 5: DETAILED TABLE ===== */}
      <div style={pageStyle}>
        <PdfHeader section="Detailed Defect History" />
        <div style={pageContentStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: GRAY_900, marginBottom: 4 }}>Detailed Defect History</div>
            <div style={{ fontSize: 9, color: GRAY_400 }}>Complete list of all defect reports in the review period</div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Report No</th>
                <th style={thStyle}>Component</th>
                <th style={thStyle}>Error Type</th>
                <th style={thStyle}>Responsible</th>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {(data.reports || []).slice(0, 20).map((r, i) => (
                <tr key={r.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={tdStyle}>{r.reportNumber || '-'}</td>
                  <td style={tdStyle}>{r.componentName || '-'}</td>
                  <td style={tdStyle}>{r.errorTypeName || r.inspectionDetail?.errorType || '-'}</td>
                  <td style={tdStyle}>{r.inspectionDetail?.responsibleParty || '-'}</td>
                  <td style={tdStyle}>{r.stageOfFailure || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: `${STATUS_COLORS[r.status] || GRAY_400}18`,
                      color: STATUS_COLORS[r.status] || GRAY_600,
                      padding: '2px 8px', borderRadius: 4, fontSize: 8, fontWeight: 600,
                    }}>
                      {STATUS_LABELS[r.status] || r.status || '-'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.inspectionDetail?.costEstimate ? formatCurrency(r.inspectionDetail.costEstimate) : '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(data.reports || []).length > 20 && (
            <div style={{ fontSize: 9, color: GRAY_400, textAlign: 'center', marginTop: 12 }}>
              Showing 20 of {(data.reports || []).length} reports. Full data available in system.
            </div>
          )}
        </div>
        <PdfFooter page={5} total={5} />
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function OverviewItem({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 9, color: GRAY_400 }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: GRAY_600 }}>{value}</div>
      </div>
    </div>
  );
}

function IntelligenceCard({ title, data, dataKey, labelKey, color }) {
  const items = Array.isArray(data) ? data.slice(0, 5) : [];
  const maxVal = items.length > 0 ? Math.max(...items.map(d => Number(d[dataKey]) || 0)) : 1;
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: `1px solid ${GRAY_200}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: GRAY_600, marginBottom: 12 }}>{title}</div>
      {items.length > 0 ? items.map((item, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: GRAY_500, marginBottom: 3 }}>
            <span>{item[labelKey] || item.name || '-'}</span>
            <span style={{ fontWeight: 600, color: GRAY_900 }}>{item[dataKey] || 0}</span>
          </div>
          <div style={{ height: 5, background: GRAY_200, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((Number(item[dataKey]) || 0) / maxVal) * 100}%`, background: color, borderRadius: 3 }} />
          </div>
        </div>
      )) : (
        <div style={{ fontSize: 9, color: GRAY_400 }}>No data available</div>
      )}
    </div>
  );
}

const pdfContainerStyle = {
  width: PDF_WIDTH,
  background: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  lineHeight: 1.5,
};

const pageStyle = {
  width: PDF_WIDTH,
  height: PDF_HEIGHT,
  background: '#fff',
  position: 'relative',
  overflow: 'hidden',
  pageBreakAfter: 'always',
  display: 'flex',
  flexDirection: 'column',
};

const pageContentStyle = {
  flex: 1,
  padding: `0 ${PAGE_PADDING}px`,
  paddingTop: 64,
  overflow: 'hidden',
};

const coverPageStyle = {
  width: PDF_WIDTH,
  height: PDF_HEIGHT,
  position: 'relative',
  background: COVER_BG,
  overflow: 'hidden',
  pageBreakAfter: 'always',
};

const coverOverlayStyle = {
  position: 'absolute',
  top: 0, right: 0, bottom: 0, left: 0,
  background: 'radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)',
};

const coverContentStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  padding: PAGE_PADDING,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
};

const coverMetaStyle = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: '20px 24px',
  border: '1px solid rgba(255,255,255,0.06)',
  maxWidth: '60%',
};

const watermarkStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%) rotate(-30deg)',
  fontSize: 80,
  fontWeight: 900,
  color: 'rgba(255,255,255,0.03)',
  letterSpacing: 16,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
};

const headerStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 48,
  padding: `0 ${PAGE_PADDING}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${GRAY_200}`,
  background: '#fff',
  zIndex: 1,
};

const logoMark = {
  width: 28, height: 28, borderRadius: 8,
  background: BRAND, color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 800, letterSpacing: 1,
};

const footerStyle = {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  height: 32,
  padding: `0 ${PAGE_PADDING}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: `1px solid ${GRAY_200}`,
  background: '#fff',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 9,
};

const thStyle = {
  padding: '8px 6px',
  borderBottom: `2px solid ${GRAY_200}`,
  color: GRAY_500,
  fontWeight: 600,
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  textAlign: 'left',
};

const tdStyle = {
  padding: '6px',
  borderBottom: `1px solid ${GRAY_200}`,
  color: GRAY_600,
  fontSize: 9,
  maxWidth: 120,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
