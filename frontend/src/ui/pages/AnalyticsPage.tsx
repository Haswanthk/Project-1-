import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { TrendingUp, BarChart3, Globe, ShoppingBag, Filter } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function AnalyticsPage() {
  const [kpis, setKpis] = useState<any>(null)
  const [ts, setTs] = useState<any>(null)
  const [regions, setRegions] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const [k, t, r, p, s] = await Promise.allSettled([
        apiClient.get('/analytics/kpis'), apiClient.get('/analytics/timeseries'),
        apiClient.get('/analytics/regions'), apiClient.get('/analytics/top-products'),
        apiClient.get('/analytics/segments'),
      ])
      if (k.status === 'fulfilled') setKpis(k.value.data)
      if (t.status === 'fulfilled') setTs(t.value.data)
      if (r.status === 'fulfilled') setRegions(r.value.data)
      if (p.status === 'fulfilled') setProducts(p.value.data)
      if (s.status === 'fulfilled') setSegments(s.value.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const kpiCards = kpis ? [
    { label: 'Total Revenue', value: `$${(kpis.total_revenue / 1e6).toFixed(1)}M`, delta: kpis.revenue_growth, icon: <TrendingUp className="size-5 text-emerald-400" />, gradient: 'from-emerald-500/15 to-emerald-600/5' },
    { label: 'Conversion Rate', value: `${kpis.conversion_rate}%`, delta: '+2.1%', icon: <BarChart3 className="size-5 text-blue-400" />, gradient: 'from-blue-500/15 to-blue-600/5' },
    { label: 'Active Users', value: kpis.active_users?.toLocaleString(), delta: '+12%', icon: <Globe className="size-5 text-violet-400" />, gradient: 'from-violet-500/15 to-violet-600/5' },
    { label: 'Avg Order Value', value: `$${kpis.avg_order_value}`, delta: '+5.3%', icon: <ShoppingBag className="size-5 text-amber-400" />, gradient: 'from-amber-500/15 to-amber-600/5' },
  ] : []

  const revenueChart = ts ? {
    backgroundColor: 'transparent', tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category' as const, data: ts.dates, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Revenue', data: ts.revenue, type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#6366f1', width: 2.5 }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.25)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } } },
      { name: 'Costs', data: ts.costs, type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#f43f5e', width: 2 }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(244,63,94,0.1)' }, { offset: 1, color: 'rgba(244,63,94,0)' }] } } },
    ],
  } : null

  const segmentChart = segments.length ? {
    backgroundColor: 'transparent', tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [{ type: 'pie' as const, radius: ['42%', '70%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#f1f5f9' } },
      data: segments.map((s: any, i: number) => ({ value: s.value ?? s.revenue, name: s.name ?? s.segment, itemStyle: { color: ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'][i % 5] } })),
    }],
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Business Analytics" subtitle="Revenue, conversion, and customer segment insights" icon={<TrendingUp className="size-6" />}
        actions={<button className="btn btn-secondary btn-sm"><Filter className="size-3.5" /> Filters</button>}
      />
      {loading ? <CardSkeleton /> : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(c => (
            <motion.div key={c.label} variants={fadeUp} className="stat-card p-5">
              <div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>{c.icon}</div><span className="text-xs font-medium text-[var(--c-text-secondary)]">{c.label}</span></div>
              <p className="text-2xl font-bold tracking-tight">{c.value}</p>
              <p className="text-xs text-emerald-400 mt-1">{c.delta}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold mb-4">Revenue vs Costs</h3>
          {loading || !revenueChart ? <ChartSkeleton /> : <ReactECharts option={revenueChart} style={{ height: 320 }} />}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Customer Segments</h3>
          {loading || !segmentChart ? <ChartSkeleton /> : <ReactECharts option={segmentChart} style={{ height: 320 }} />}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Top Products</h3>
          <div className="space-y-3">
            {products.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--c-border)] last:border-0">
                <div className="flex items-center gap-3"><span className="text-xs font-bold text-[var(--c-text-muted)] w-5">{i + 1}</span><span className="text-sm font-medium">{p.name ?? p.product}</span></div>
                <span className="text-sm font-semibold text-indigo-400">${(p.revenue ?? p.sales)?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Regional Performance</h3>
          <div className="space-y-3">
            {regions.map((r: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{r.name ?? r.region}</span><span className="font-semibold">{r.percentage ?? r.share}%</span></div>
                <div className="h-2 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 progress-bar-fill" style={{ width: `${r.percentage ?? r.share}%` }} /></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
