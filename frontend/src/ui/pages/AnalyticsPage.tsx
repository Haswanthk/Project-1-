import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  DollarSign, Users, TrendingDown, ShoppingCart,
  TrendingUp, Globe, Filter, RefreshCw, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { apiClient } from '../lib/api';

type Period = 7 | 30 | 90 | 365;

interface KPIMetric {
  value: number;
  prev: number;
  change_pct: number;
  trend: 'up' | 'down';
}

interface KPIs {
  revenue: KPIMetric;
  customers: KPIMetric;
  churn_rate: KPIMetric;
  avg_order_value: KPIMetric;
  conversion_rate: KPIMetric;
  nps: KPIMetric;
}

interface Product {
  rank: number;
  product: string;
  revenue: number;
  units: number;
  margin_pct: number;
  growth_pct: number;
}

interface Segment {
  segment: string;
  customers: number;
  revenue_share: number;
  avg_ltv: number;
  growth_pct: number;
}

interface Region {
  region: string;
  revenue: number;
  customers: number;
  growth_pct: number;
}

interface TimeseriesData {
  timestamps: string[];
  values: number[];
  metric: string;
  label: string;
  unit: string;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '1Y', value: 365 },
];

function fmt(n: number, prefix = '', suffix = '') {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function KPICard({
  title, value, change_pct, trend, icon, color,
}: {
  title: string; value: string; change_pct: number; trend: 'up' | 'down'; icon: React.ReactNode; color: string;
}) {
  const isPositive = trend === 'up' ? change_pct >= 0 : change_pct <= 0;
  const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';
  const Arrow = change_pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="stat-card p-5 animate-fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
        <span className={`flex items-center gap-0.5 text-xs font-bold ${changeColor}`}>
          <Arrow className="w-3.5 h-3.5" />
          {Math.abs(change_pct).toFixed(1)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{title}</p>
    </div>
  );
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(30);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [revenueTs, setRevenueTs] = useState<TimeseriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, productsRes, segmentsRes, regionsRes, tsRes] = await Promise.all([
        apiClient.get(`/analytics/kpis?period=${period}`),
        apiClient.get('/analytics/top-products'),
        apiClient.get('/analytics/segments'),
        apiClient.get('/analytics/regions'),
        apiClient.get(`/analytics/timeseries?metric=revenue&period=${period}`),
      ]);
      setKpis(kpisRes.data);
      setProducts(productsRes.data);
      setSegments(segmentsRes.data);
      setRegions(regionsRes.data);
      setRevenueTs(tsRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [period]);

  const revenueTrendOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>$${(params[0].value / 1000).toFixed(0)}K` },
    grid: { left: '3%', right: '3%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: revenueTs?.timestamps ?? [],
      axisLabel: { color: '#64748b', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: number) => `$${(v / 1000).toFixed(0)}K` },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      data: revenueTs?.values ?? [],
      type: 'line',
      smooth: true,
      symbol: 'none',
      itemStyle: { color: '#6366f1' },
      lineStyle: { width: 2.5, color: '#6366f1' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99,102,241,0.35)' },
            { offset: 1, color: 'rgba(99,102,241,0.02)' },
          ],
        },
      },
    }],
  };

  const segmentOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { bottom: '0%', textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      name: 'Revenue Share',
      type: 'pie',
      radius: ['45%', '72%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#f1f5f9' } },
      data: segments.map((s, i) => ({
        value: s.revenue_share,
        name: s.segment,
        itemStyle: { color: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'][i % 4] },
      })),
    }],
  };

  const regionBarOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>$${(p[0].value / 1_000_000).toFixed(1)}M` },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: number) => `$${(v / 1_000_000).toFixed(0)}M` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    yAxis: { type: 'category', data: regions.map(r => r.region), axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      data: regions.map(r => r.revenue),
      type: 'bar',
      barMaxWidth: 24,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }] },
      },
    }],
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="glass-card p-6 border-l-4 border-red-500 text-red-400 flex items-center gap-3">
          <TrendingDown className="w-5 h-5 shrink-0" />
          <span>Error loading analytics: {error}</span>
          <button onClick={fetchAll} className="btn btn-sm btn-secondary ml-auto"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  const kpiCards = kpis ? [
    { title: 'Total Revenue',        value: fmt(kpis.revenue.value, '$'),       change_pct: kpis.revenue.change_pct,       trend: kpis.revenue.trend,       icon: <DollarSign className="w-5 h-5 text-indigo-400" />,  color: 'bg-indigo-500/15' },
    { title: 'New Customers',         value: fmt(kpis.customers.value),          change_pct: kpis.customers.change_pct,     trend: kpis.customers.trend,     icon: <Users className="w-5 h-5 text-violet-400" />,       color: 'bg-violet-500/15' },
    { title: 'Churn Rate',            value: `${kpis.churn_rate.value}%`,        change_pct: kpis.churn_rate.change_pct,    trend: kpis.churn_rate.trend,    icon: <TrendingDown className="w-5 h-5 text-emerald-400" />,color: 'bg-emerald-500/15' },
    { title: 'Avg. Order Value',      value: fmt(kpis.avg_order_value.value, '$'),change_pct: kpis.avg_order_value.change_pct,trend: kpis.avg_order_value.trend,icon: <ShoppingCart className="w-5 h-5 text-cyan-400" />,  color: 'bg-cyan-500/15' },
    { title: 'Conversion Rate',       value: `${kpis.conversion_rate.value}%`,   change_pct: kpis.conversion_rate.change_pct, trend: kpis.conversion_rate.trend, icon: <TrendingUp className="w-5 h-5 text-amber-400" />, color: 'bg-amber-500/15' },
    { title: 'Net Promoter Score',    value: String(kpis.nps.value),             change_pct: kpis.nps.change_pct,           trend: kpis.nps.trend,           icon: <Globe className="w-5 h-5 text-pink-400" />,         color: 'bg-pink-500/15' },
  ] : [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Business Analytics</h1>
          <p className="section-subtitle">KPIs, revenue trends, and customer intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  period === p.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchAll} className="btn btn-ghost p-1.5" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(card => (
          <KPICard key={card.title} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="section-header mb-4">Revenue Trend</h3>
          {revenueTs ? (
            <ReactECharts option={revenueTrendOption} style={{ height: '260px' }} />
          ) : (
            <div className="skeleton h-64 rounded-xl" />
          )}
        </div>

        {/* Segment Donut */}
        <div className="glass-card p-6">
          <h3 className="section-header mb-1">Revenue by Segment</h3>
          <p className="text-xs text-slate-500 mb-4">% of total revenue</p>
          {segments.length > 0 ? (
            <ReactECharts option={segmentOption} style={{ height: '240px' }} />
          ) : (
            <div className="skeleton h-56 rounded-xl" />
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <h3 className="section-header">Top 10 Products by Revenue</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Margin</th>
                  <th className="text-right">Growth</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.rank}>
                    <td className="text-slate-500 text-xs font-mono w-8">{p.rank}</td>
                    <td className="font-medium text-sm max-w-[180px] truncate" title={p.product}>{p.product}</td>
                    <td className="text-right text-sm font-semibold">{fmt(p.revenue, '$')}</td>
                    <td className="text-right">
                      <span className="badge badge-accent">{p.margin_pct}%</span>
                    </td>
                    <td className="text-right">
                      <span className={`flex items-center justify-end gap-0.5 text-xs font-bold ${p.growth_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.growth_pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {p.growth_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regional Revenue */}
        <div className="glass-card p-6">
          <h3 className="section-header mb-4">Revenue by Region</h3>
          {regions.length > 0 ? (
            <ReactECharts option={regionBarOption} style={{ height: '280px' }} />
          ) : (
            <div className="skeleton h-64 rounded-xl" />
          )}
          {/* Growth badges */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {regions.map(r => (
              <div key={r.region} className="flex items-center justify-between text-xs bg-white/3 rounded-lg px-3 py-2">
                <span className="text-slate-400">{r.region}</span>
                <span className="text-emerald-400 font-bold">+{r.growth_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
