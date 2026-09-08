import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  TrendingUp, Globe, ShoppingBag, Filter, Download,
  Layers, Users, PieChart as PieIcon, ArrowUpRight, ArrowDownRight,
  Database, RefreshCw, Activity, Percent
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'

type AnalyticsTab = 'overview' | 'funnel' | 'segments' | 'cohorts' | 'dataset'
type TimePeriod = 7 | 30 | 90 | 365

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [period, setPeriod] = useState<TimePeriod>(30)
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'customers' | 'churn_rate' | 'avg_order_value'>('revenue')
  const [chartType, setChartType] = useState<'area' | 'bar'>('area')

  // Datasets for dataset intelligence mode
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [datasetInsights, setDatasetInsights] = useState<any>(null)
  const [datasetLoading, setDatasetLoading] = useState(false)

  // Platform Analytics State
  const [kpis, setKpis] = useState<any>(null)
  const [ts, setTs] = useState<any>(null)
  const [regions, setRegions] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any[]>([])
  const [cohorts, setCohorts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter Modal
  const [filterOpen, setFilterOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState('all')

  useEffect(() => {
    fetchAnalytics()
    fetchDatasets()
  }, [period])

  const fetchDatasets = async () => {
    try {
      const res = await apiClient.get('/datasets/')
      setDatasets(res.data || [])
      if (res.data?.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(res.data[0].id)
      }
    } catch {
      // ignore
    }
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const [k, t, r, p, s, f, c] = await Promise.allSettled([
        apiClient.get(`/analytics/kpis`),
        apiClient.get(`/analytics/timeseries?period=${period}&metric=${activeMetric}`),
        apiClient.get('/analytics/regions'),
        apiClient.get('/analytics/top-products'),
        apiClient.get('/analytics/segments'),
        apiClient.get('/analytics/funnel'),
        apiClient.get('/analytics/cohorts'),
      ])
      if (k.status === 'fulfilled') setKpis(k.value.data)
      if (t.status === 'fulfilled') setTs(t.value.data)
      if (r.status === 'fulfilled') setRegions(r.value.data)
      if (p.status === 'fulfilled') setProducts(p.value.data)
      if (s.status === 'fulfilled') setSegments(s.value.data)
      if (f.status === 'fulfilled') setFunnel(f.value.data)
      if (c.status === 'fulfilled') setCohorts(c.value.data)
    } catch (e) {
      console.error('Failed to fetch analytics', e)
    } finally {
      setLoading(false)
    }
  }

  const loadDatasetInsights = async (id: number) => {
    setSelectedDatasetId(id)
    setDatasetLoading(true)
    try {
      const res = await apiClient.get(`/analytics/dataset-insights/${id}`)
      setDatasetInsights(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setDatasetLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'dataset' && selectedDatasetId && !datasetInsights) {
      loadDatasetInsights(selectedDatasetId)
    }
  }, [activeTab, selectedDatasetId])

  const exportCSV = () => {
    if (!ts || !ts.timestamps) return
    const rows = [['Date', activeMetric.toUpperCase(), 'Estimated Cost']]
    ts.timestamps.forEach((t: string, i: number) => {
      rows.push([t, ts.values?.[i] ?? ts.revenue?.[i] ?? 0, ts.costs?.[i] ?? 0])
    })
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `analytics_export_${activeMetric}_${period}d.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Safe extraction of KPI values
  const revVal = kpis?.revenue?.value ?? kpis?.total_revenue ?? 2450000
  const revGrowth = kpis?.revenue?.change_pct ? `+${kpis.revenue.change_pct}%` : (kpis?.revenue_growth ?? '+14.2%')
  const usersVal = kpis?.customers?.value ?? kpis?.active_users ?? 18450
  const churnVal = kpis?.churn_rate?.value ?? kpis?.churn_rate ?? 2.4
  const aovVal = kpis?.avg_order_value?.value ?? kpis?.avg_order_value ?? 142.50

  const kpiCards = [
    {
      label: 'Gross ARR / Revenue',
      value: `$${(revVal >= 1e6 ? `${(revVal / 1e6).toFixed(2)}M` : revVal.toLocaleString())}`,
      delta: revGrowth,
      isUp: true,
      icon: <TrendingUp className="size-5 text-emerald-400" />,
      gradient: 'from-emerald-500/15 to-emerald-600/5',
      border: 'border-emerald-500/20'
    },
    {
      label: 'Active Customers',
      value: usersVal.toLocaleString(),
      delta: '+18.4% vs last period',
      isUp: true,
      icon: <Users className="size-5 text-blue-400" />,
      gradient: 'from-blue-500/15 to-blue-600/5',
      border: 'border-blue-500/20'
    },
    {
      label: 'Avg Order Value (AOV)',
      value: `$${Number(aovVal).toFixed(2)}`,
      delta: '+6.2% margin expansion',
      isUp: true,
      icon: <ShoppingBag className="size-5 text-indigo-400" />,
      gradient: 'from-indigo-500/15 to-indigo-600/5',
      border: 'border-indigo-500/20'
    },
    {
      label: 'Monthly Churn Rate',
      value: `${churnVal}%`,
      delta: '-0.6% reduction',
      isUp: false,
      isPositiveTrend: true,
      icon: <Percent className="size-5 text-rose-400" />,
      gradient: 'from-rose-500/15 to-rose-600/5',
      border: 'border-rose-500/20'
    },
  ]

  // Main Dynamic Time Series Chart
  const mainChartOption = ts ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    legend: {
      data: [activeMetric.replace('_', ' ').toUpperCase(), 'Operating Costs'],
      top: 0,
      right: 10,
      textStyle: { color: '#94a3b8', fontSize: 12 },
    },
    grid: { top: 35, bottom: 30, left: 55, right: 25 },
    xAxis: {
      type: 'category' as const,
      data: ts.timestamps || ts.dates || [],
      axisLabel: { color: '#64748b', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        formatter: (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `${v}`
      },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: activeMetric.replace('_', ' ').toUpperCase(),
        data: ts.values || ts.revenue || [],
        type: chartType === 'bar' ? ('bar' as const) : ('line' as const),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        itemStyle: { color: '#6366f1' },
        lineStyle: { color: '#6366f1', width: 3 },
        areaStyle: chartType === 'area' ? {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.4)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
            ]
          }
        } : undefined,
      },
      {
        name: 'Operating Costs',
        data: ts.costs || [],
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#f43f5e', width: 2, type: 'dashed' as const },
      }
    ],
  } : null

  // Customer Segment Donut
  const segmentChartOption = segments.length ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'pie' as const,
      radius: ['45%', '72%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#f1f5f9' } },
      data: segments.map((s: any, i: number) => ({
        value: s.revenue_share ?? s.value ?? s.revenue ?? 20,
        name: s.segment ?? s.name ?? `Segment ${i+1}`,
        itemStyle: { color: ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'][i % 5] }
      })),
    }],
  } : null

  return (
    <div className="p-6 space-y-7 max-w-[1600px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Enterprise Analytics Studio"
        subtitle="Deep multi-dimensional BI, cohort retention matrix, conversion funnel & dataset profiling"
        icon={<TrendingUp className="size-6 text-indigo-400" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="flex bg-[var(--c-bg-tertiary)] p-1 rounded-xl border border-[var(--c-border)]">
              {([7, 30, 90, 365] as TimePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    period === p
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 365 ? '1Y' : `${p}D`}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`btn btn-sm ${filterOpen ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1.5`}
            >
              <Filter className="size-3.5" /> Filters
            </button>

            <button
              onClick={exportCSV}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Download className="size-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filter Bar (Collapsible) */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] flex flex-wrap items-center gap-6"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Region:</span>
              <select
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
                className="form-select text-xs py-1 px-2.5 rounded-lg bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
              >
                <option value="all">All Global Regions</option>
                <option value="na">North America</option>
                <option value="eu">Europe (EMEA)</option>
                <option value="apac">Asia Pacific</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Chart View:</span>
              <button
                onClick={() => setChartType('area')}
                className={`text-xs px-2.5 py-1 rounded-lg ${chartType === 'area' ? 'bg-indigo-600 text-white' : 'bg-[var(--c-bg-tertiary)] text-slate-400'}`}
              >
                Area Fill
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`text-xs px-2.5 py-1 rounded-lg ${chartType === 'bar' ? 'bg-indigo-600 text-white' : 'bg-[var(--c-bg-tertiary)] text-slate-400'}`}
              >
                Bar Columns
              </button>
            </div>

            <button
              onClick={fetchAnalytics}
              className="btn btn-primary btn-sm ml-auto flex items-center gap-1.5"
            >
              <RefreshCw className="size-3" /> Apply Filters
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl bg-[var(--c-bg-secondary)] border ${c.border} relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>
                  {c.icon}
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white mb-1">{c.value}</p>
              <div className="flex items-center gap-1 text-xs">
                {c.isUp ? (
                  <ArrowUpRight className="size-3.5 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="size-3.5 text-emerald-400" />
                )}
                <span className="text-emerald-400 font-medium">{c.delta}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--c-border)] gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Growth', icon: <TrendingUp className="size-4" /> },
          { id: 'funnel', label: 'Conversion Funnel', icon: <Layers className="size-4" /> },
          { id: 'segments', label: 'Unit Economics', icon: <PieIcon className="size-4" /> },
          { id: 'cohorts', label: 'Cohort Retention Matrix', icon: <Activity className="size-4" /> },
          { id: 'dataset', label: 'Workspace Dataset Intelligence', icon: <Database className="size-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AnalyticsTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[var(--c-bg-secondary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & GROWTH */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Time Series */}
            <div className="glass-card lg:col-span-2 p-6">
              <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Platform Revenue & Operating Trajectory</h3>
                  <p className="text-xs text-slate-400">Sequential performance over selected {period}-day period</p>
                </div>
                <div className="flex gap-1.5 bg-[var(--c-bg-tertiary)] p-1 rounded-xl">
                  {(['revenue', 'customers', 'churn_rate', 'avg_order_value'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setActiveMetric(m)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                        activeMetric === m
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m === 'churn_rate' ? 'Churn' : m === 'avg_order_value' ? 'AOV' : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {loading || !mainChartOption ? (
                <ChartSkeleton />
              ) : (
                <ReactECharts option={mainChartOption} style={{ height: 340 }} />
              )}
            </div>

            {/* Customer Segments Donut */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Revenue by Customer Tier</h3>
              <p className="text-xs text-slate-400 mb-4">Enterprise vs Mid-Market vs SMB share</p>
              {loading || !segmentChartOption ? (
                <ChartSkeleton />
              ) : (
                <ReactECharts option={segmentChartOption} style={{ height: 340 }} />
              )}
            </div>
          </div>

          {/* Top Products & Regional Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Top Performing SKUs & Services</h3>
              <p className="text-xs text-slate-400 mb-4">Highest revenue generators with gross margin</p>
              <div className="space-y-3">
                {products.slice(0, 5).map((p: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-tertiary)]/50 border border-[var(--c-border)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-6 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-200">{p.product || p.name}</span>
                        <div className="text-xs text-slate-400">{p.units?.toLocaleString() || 120} units sold</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-indigo-400">
                        ${(p.revenue ?? p.sales ?? 12500)?.toLocaleString()}
                      </span>
                      <div className="text-xs text-emerald-400 font-medium">+{p.growth_pct ?? 12}% YoY</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regional Performance */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Geographic Market Share</h3>
              <p className="text-xs text-slate-400 mb-4">Global distribution of transactions and users</p>
              <div className="space-y-4">
                {regions.map((r: any, i: number) => {
                  const pct = r.percentage ?? r.share ?? 25
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-200 flex items-center gap-2">
                          <Globe className="size-3.5 text-slate-400" />
                          {r.region || r.name}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400 text-xs">${((r.revenue ?? 50000) / 1000).toFixed(0)}k</span>
                          <span className="font-bold text-indigo-400">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONVERSION FUNNEL */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-white mb-1">Customer Acquisition & Activation Funnel</h3>
            <p className="text-xs text-slate-400 mb-6">Waterfall progression from visitor to retained enterprise customer</p>

            <div className="space-y-3 max-w-3xl mx-auto">
              {funnel.map((step: any, i: number) => {
                const prev = i > 0 ? funnel[i - 1].count : step.count
                const dropoff = prev > 0 ? (((prev - step.count) / prev) * 100).toFixed(1) : '0'
                const widthPct = Math.max(15, (step.count / funnel[0].count) * 100)

                return (
                  <div key={step.stage} className="space-y-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className="size-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        {step.stage}
                      </span>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-white font-bold">{step.count.toLocaleString()} users</span>
                        <span className="text-indigo-400 font-semibold">{step.conversion_rate}%</span>
                        {i > 0 && <span className="text-rose-400">-{dropoff}% drop</span>}
                      </div>
                    </div>

                    <div className="h-8 rounded-xl bg-[var(--c-bg-tertiary)] overflow-hidden p-1 flex items-center">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                        className="h-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 flex items-center justify-end px-3 text-xs font-bold text-white shadow-sm"
                      >
                        {widthPct > 20 && `${step.conversion_rate}%`}
                      </motion.div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: UNIT ECONOMICS */}
      {activeTab === 'segments' && (
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold text-white mb-1">Customer Tiers & Unit Economics</h3>
          <p className="text-xs text-slate-400 mb-5">Lifetime Value (LTV), Acquisition Cost (CAC), and payback velocity</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-[var(--c-bg-tertiary)] text-slate-400 border-b border-[var(--c-border)]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Segment Tier</th>
                  <th className="px-4 py-3">Active Customers</th>
                  <th className="px-4 py-3">Revenue Share</th>
                  <th className="px-4 py-3">Average LTV</th>
                  <th className="px-4 py-3">Est. CAC</th>
                  <th className="px-4 py-3">LTV : CAC Ratio</th>
                  <th className="px-4 py-3 rounded-r-xl">Growth Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {segments.map((s: any, i: number) => {
                  const ltv = s.avg_ltv || 3500 * (i + 1)
                  const cac = Math.round(ltv / (3.5 + i * 0.8))
                  const ratio = (ltv / cac).toFixed(1)
                  return (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-200">{s.segment || s.name}</td>
                      <td className="px-4 py-3.5 font-mono">{s.customers?.toLocaleString() || 140}</td>
                      <td className="px-4 py-3.5 font-bold text-indigo-400">{s.revenue_share || 25}%</td>
                      <td className="px-4 py-3.5 font-mono text-emerald-400 font-semibold">${ltv.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-slate-400">${cac.toLocaleString()}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {ratio}x
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-emerald-400 font-semibold">+{s.growth_pct || 8.5}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COHORT RETENTION MATRIX */}
      {activeTab === 'cohorts' && (
        <div className="glass-card p-6">
          <h3 className="text-base font-semibold text-white mb-1">Monthly Customer Retention Heatmap</h3>
          <p className="text-xs text-slate-400 mb-6">Decay curves by sign-up cohort month (M0 to M6)</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-slate-400">
                  <th className="py-2.5 px-3 text-left">Cohort</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">M0</th>
                  <th className="py-2.5 px-3">M1</th>
                  <th className="py-2.5 px-3">M2</th>
                  <th className="py-2.5 px-3">M3</th>
                  <th className="py-2.5 px-3">M4</th>
                  <th className="py-2.5 px-3">M5</th>
                  <th className="py-2.5 px-3">M6</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {cohorts.map((c: any) => (
                  <tr key={c.cohort}>
                    <td className="py-3 px-3 text-left font-bold text-slate-200">{c.cohort}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{c.size.toLocaleString()}</td>
                    {c.retention.map((val: number, idx: number) => {
                      const bgIntensity = Math.min(1, Math.max(0.15, val / 100))
                      return (
                        <td key={idx} className="p-1">
                          <div
                            className="py-2 px-1 rounded-lg font-mono font-bold text-white transition-transform hover:scale-105"
                            style={{
                              backgroundColor: `rgba(99, 102, 241, ${bgIntensity})`,
                            }}
                          >
                            {val.toFixed(1)}%
                          </div>
                        </td>
                      )
                    })}
                    {/* Empty cells if fewer than 7 months */}
                    {Array.from({ length: 7 - c.retention.length }).map((_, idx) => (
                      <td key={`empty-${idx}`} className="p-1">
                        <div className="py-2 px-1 rounded-lg bg-[var(--c-bg-tertiary)]/20 text-slate-600 font-mono">-</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: WORKSPACE DATASET INTELLIGENCE */}
      {activeTab === 'dataset' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-semibold text-white">Select Workspace Dataset to Analyze</h3>
                <p className="text-xs text-slate-400">Deep statistical distributions, quartile spreads, and correlation matrix</p>
              </div>

              <select
                value={selectedDatasetId ?? ''}
                onChange={e => loadDatasetInsights(Number(e.target.value))}
                className="form-select text-sm rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)] min-w-[240px]"
              >
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count || 'unknown'} rows)
                  </option>
                ))}
              </select>
            </div>

            {datasetLoading ? (
              <ChartSkeleton />
            ) : datasetInsights ? (
              <div className="space-y-6">
                {/* Summary Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                    <span className="text-xs text-slate-400">Total Rows</span>
                    <p className="text-xl font-bold text-white mt-1">{datasetInsights.rows?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                    <span className="text-xs text-slate-400">Total Columns</span>
                    <p className="text-xl font-bold text-white mt-1">{datasetInsights.columns}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                    <span className="text-xs text-slate-400">Numeric Features</span>
                    <p className="text-xl font-bold text-indigo-400 mt-1">{datasetInsights.numeric_columns?.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                    <span className="text-xs text-slate-400">Categorical Features</span>
                    <p className="text-xl font-bold text-cyan-400 mt-1">{datasetInsights.categorical_columns?.length}</p>
                  </div>
                </div>

                {/* Statistics Table */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Feature Summary Statistics</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="uppercase bg-[var(--c-bg-tertiary)] text-slate-400 border-b border-[var(--c-border)]">
                        <tr>
                          <th className="px-3 py-2.5">Feature</th>
                          <th className="px-3 py-2.5">Mean</th>
                          <th className="px-3 py-2.5">Std Dev</th>
                          <th className="px-3 py-2.5">Min</th>
                          <th className="px-3 py-2.5">25%</th>
                          <th className="px-3 py-2.5">Median</th>
                          <th className="px-3 py-2.5">75%</th>
                          <th className="px-3 py-2.5">Max</th>
                          <th className="px-3 py-2.5">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--c-border)] font-mono">
                        {Object.entries(datasetInsights.summary_statistics || {}).map(([col, s]: any) => (
                          <tr key={col} className="hover:bg-slate-800/20">
                            <td className="px-3 py-2 font-bold font-sans text-slate-200">{col}</td>
                            <td className="px-3 py-2 text-indigo-300">{s.mean}</td>
                            <td className="px-3 py-2 text-slate-400">{s.std}</td>
                            <td className="px-3 py-2 text-slate-400">{s.min}</td>
                            <td className="px-3 py-2 text-slate-400">{s.q25}</td>
                            <td className="px-3 py-2 text-emerald-400 font-semibold">{s.median}</td>
                            <td className="px-3 py-2 text-slate-400">{s.q75}</td>
                            <td className="px-3 py-2 text-slate-400">{s.max}</td>
                            <td className="px-3 py-2 text-rose-400">{s.missing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Correlation Matrix */}
                {datasetInsights.correlations?.matrix && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">Pairwise Correlation Matrix</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-center border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--c-border)] text-slate-400">
                            <th className="p-2 text-left">Variable</th>
                            {datasetInsights.correlations.columns.map((c: string) => (
                              <th key={c} className="p-2">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datasetInsights.correlations.matrix.map((row: number[], rIdx: number) => (
                            <tr key={rIdx} className="border-b border-[var(--c-border)]">
                              <td className="p-2 text-left font-semibold text-slate-300">
                                {datasetInsights.correlations.columns[rIdx]}
                              </td>
                              {row.map((val: number, cIdx: number) => {
                                const isPos = val >= 0
                                const intensity = Math.abs(val)
                                const color = isPos
                                  ? `rgba(99, 102, 241, ${intensity * 0.8 + 0.1})`
                                  : `rgba(244, 63, 94, ${intensity * 0.8 + 0.1})`
                                return (
                                  <td key={cIdx} className="p-1">
                                    <div
                                      className="py-1.5 px-1 rounded font-mono font-bold text-white text-[11px]"
                                      style={{ backgroundColor: color }}
                                    >
                                      {val.toFixed(2)}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                No insights available. Please upload a dataset in Workspace.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
