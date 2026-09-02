import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  Activity, AlertTriangle, Server, Database, Cpu, Clock, Zap, Box,
  TrendingUp, TrendingDown, CheckCircle, XCircle, Info,
  Upload, Play, FileText, ArrowRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'

type StatTrend = 'up' | 'down' | 'neutral'
interface MetricValue { value: string | number; delta: string; trend: StatTrend }
interface Alert { id: string; severity: 'critical' | 'high' | 'warning' | 'info'; message: string; timestamp: string; resolved: boolean }
interface Model { id: string; name: string; status: 'active' | 'drifting' | 'retired' }
interface TimeSeries { timestamp: string; events: number; requests: number }

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function DashboardPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Record<string, MetricValue> | null>(null)
  const [timeseries, setTimeseries] = useState<TimeSeries[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [datasetsCount, setDatasetsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [summaryRes, tsRes, datasetsRes, modelsRes, alertsRes] = await Promise.allSettled([
        apiClient.get('/monitoring/metrics/summary'),
        apiClient.get('/monitoring/metrics/timeseries'),
        apiClient.get('/datasets/'),
        apiClient.get('/ml/models'),
        apiClient.get('/monitoring/alerts'),
      ])

      const raw = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null
      const toM = (v: string | number, d = 'Current', t: StatTrend = 'neutral'): MetricValue => ({ value: v, delta: d, trend: t })
      if (raw) {
        setSummary({
          pipelines: toM(raw.spark_jobs_active, 'Active'),
          streaming: toM(raw.streaming_events_per_min, '/min'),
          uptime: toM(`${raw.uptime_percent}%`, 'Uptime', 'up'),
          latency: toM(`${raw.api_p99_latency_ms}ms`, 'P99'),
          requests: toM(raw.api_requests_total, 'Total'),
          errorRate: toM(raw.api_requests_total ? `${((raw.api_errors_total / raw.api_requests_total) * 100).toFixed(2)}%` : '0%', 'Errors'),
        })
      }

      const rawTs = tsRes.status === 'fulfilled' ? tsRes.value.data : null
      setTimeseries(rawTs?.timestamps?.map((ts: string, i: number) => ({
        timestamp: ts, events: rawTs.events_per_min?.[i] ?? 0, requests: rawTs.api_requests?.[i] ?? 0,
      })) ?? [])

      setModels(modelsRes.status === 'fulfilled' ? modelsRes.value.data.map((m: any) => ({
        id: String(m.name ?? m.model_name), name: m.name ?? m.model_name,
        status: m.status === 'drifting' || m.status === 'retired' ? m.status : 'active',
      })) : [])

      setAlerts(alertsRes.status === 'fulfilled' ? alertsRes.value.data.map((a: any) => ({
        id: String(a.id), severity: a.severity === 'error' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info',
        message: a.message ?? a.description ?? a.title, timestamp: a.timestamp ?? a.fired_at, resolved: a.resolved,
      })) : [])

      setDatasetsCount(datasetsRes.status === 'fulfilled' ? datasetsRes.value.data.length : 0)
      setError(null)
    } catch { setError('Unable to load dashboard data.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv) }, [])

  const statCards = summary ? [
    { title: 'Active Pipelines', ...summary.pipelines, icon: <Activity className="size-5 text-blue-400" />, gradient: 'from-blue-500/15 to-blue-600/5' },
    { title: 'Streaming Events', ...summary.streaming, icon: <Zap className="size-5 text-amber-400" />, gradient: 'from-amber-500/15 to-amber-600/5' },
    { title: 'ML Models', value: models.length, delta: 'Registered', trend: 'up' as StatTrend, icon: <Cpu className="size-5 text-violet-400" />, gradient: 'from-violet-500/15 to-violet-600/5' },
    { title: 'Platform Uptime', ...summary.uptime, icon: <Server className="size-5 text-emerald-400" />, gradient: 'from-emerald-500/15 to-emerald-600/5' },
    { title: 'Datasets', value: datasetsCount, delta: 'Uploaded', trend: 'up' as StatTrend, icon: <Database className="size-5 text-indigo-400" />, gradient: 'from-indigo-500/15 to-indigo-600/5' },
    { title: 'API Latency', ...summary.latency, icon: <Clock className="size-5 text-orange-400" />, gradient: 'from-orange-500/15 to-orange-600/5' },
    { title: 'Total Requests', ...summary.requests, icon: <Box className="size-5 text-cyan-400" />, gradient: 'from-cyan-500/15 to-cyan-600/5' },
    { title: 'Error Rate', ...summary.errorRate, icon: <AlertTriangle className="size-5 text-rose-400" />, gradient: 'from-rose-500/15 to-rose-600/5' },
  ] : []

  const eventsChart = {
    backgroundColor: 'transparent', tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 40, right: 20 },
    xAxis: { type: 'category' as const, data: timeseries.map(d => d.timestamp), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{ data: timeseries.map(d => d.events), type: 'line' as const, smooth: true, symbol: 'none',
      lineStyle: { color: '#6366f1', width: 2.5 },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } },
    }],
  }

  const requestsChart = {
    backgroundColor: 'transparent', tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 40, right: 20 },
    xAxis: { type: 'category' as const, data: timeseries.map(d => d.timestamp), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{ data: timeseries.map(d => d.requests), type: 'bar' as const,
      itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#4f46e5' }] }, borderRadius: [4, 4, 0, 0] },
    }],
  }

  const modelCounts = models.reduce((a, m) => { a[m.status] = (a[m.status] || 0) + 1; return a }, {} as Record<string, number>)
  const modelChart = {
    backgroundColor: 'transparent', tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [{ type: 'pie' as const, radius: ['45%', '72%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 3 },
      label: { show: false }, emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' as const, color: '#f1f5f9' } },
      data: [
        { value: modelCounts['active'] || 0, name: 'Active', itemStyle: { color: '#10b981' } },
        { value: modelCounts['drifting'] || 0, name: 'Drifting', itemStyle: { color: '#f59e0b' } },
        { value: modelCounts['retired'] || 0, name: 'Retired', itemStyle: { color: '#64748b' } },
      ],
    }],
  }

  const quickActions = [
    { label: 'Upload Dataset', icon: <Upload className="size-4" />, to: '/dataset-upload', color: 'text-blue-400' },
    { label: 'Train Model', icon: <Play className="size-4" />, to: '/training', color: 'text-emerald-400' },
    { label: 'Generate Report', icon: <FileText className="size-4" />, to: '/reports', color: 'text-violet-400' },
  ]

  const getSevIcon = (s: string) => {
    if (s === 'critical') return <XCircle className="size-4 text-rose-400" />
    if (s === 'warning' || s === 'high') return <AlertTriangle className="size-4 text-amber-400" />
    return <Info className="size-4 text-blue-400" />
  }
  const getSevClass = (s: string) => {
    if (s === 'critical') return 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    if (s === 'warning' || s === 'high') return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader
        title="Command Center"
        subtitle="Real-time overview of your ML models, pipelines, and infrastructure"
        icon={<Activity className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            {quickActions.map(a => (
              <motion.button
                key={a.label} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate(a.to)}
                className="btn btn-secondary btn-sm"
              >
                <span className={a.color}>{a.icon}</span>
                <span className="hidden sm:inline">{a.label}</span>
              </motion.button>
            ))}
          </div>
        }
      />

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/8 border border-rose-500/15 text-rose-400 text-sm">
          <AlertTriangle className="size-5" /> {error}
        </motion.div>
      )}

      {/* Stat Cards */}
      {loading ? <CardSkeleton count={8} /> : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(stat => (
            <motion.div key={stat.title} variants={fadeUp} className="stat-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient}`}>{stat.icon}</div>
                <span className="text-xs font-medium text-[var(--c-text-secondary)]">{stat.title}</span>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <div className="flex items-center gap-1 text-xs text-[var(--c-text-muted)]">
                  {stat.trend === 'up' ? <TrendingUp className="size-3.5 text-emerald-400" /> : stat.trend === 'down' ? <TrendingDown className="size-3.5 text-rose-400" /> : <Activity className="size-3.5" />}
                  {stat.delta}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold text-[var(--c-text-primary)] mb-4">Streaming Events (24h)</h3>
          {loading ? <ChartSkeleton /> : <ReactECharts option={eventsChart} style={{ height: 300 }} />}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold text-[var(--c-text-primary)] mb-4">Model Health</h3>
          {loading ? <ChartSkeleton /> : <ReactECharts option={modelChart} style={{ height: 300 }} />}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card lg:col-span-2 p-6">
          <h3 className="text-sm font-semibold text-[var(--c-text-primary)] mb-4">API Requests (Hourly)</h3>
          {loading ? <ChartSkeleton /> : <ReactECharts option={requestsChart} style={{ height: 300 }} />}
        </motion.div>

        {/* Alerts Feed */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold">Active Alerts</h3>
            <span className="badge badge-accent text-[10px]">{alerts.filter(a => !a.resolved).length} New</span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />) :
              alerts.filter(a => !a.resolved).length === 0 ? (
                <div className="text-center py-8 text-[var(--c-text-muted)]">
                  <CheckCircle className="size-8 mx-auto mb-2 opacity-50 text-emerald-500" />
                  <p className="text-sm">No active alerts</p>
                </div>
              ) : alerts.filter(a => !a.resolved).map(alert => (
                <div key={alert.id} className={`flex gap-3 p-3 rounded-xl border ${getSevClass(alert.severity)}`}>
                  <div className="shrink-0 mt-0.5">{getSevIcon(alert.severity)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider">{alert.severity}</span>
                      <span className="text-[10px] text-[var(--c-text-muted)]">{alert.timestamp}</span>
                    </div>
                    <p className="text-xs font-medium text-[var(--c-text-primary)] truncate">{alert.message}</p>
                  </div>
                </div>
              ))
            }
          </div>
          {alerts.length > 0 && (
            <button onClick={() => navigate('/monitoring')} className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition">
              View all alerts <ArrowRight className="size-3" />
            </button>
          )}
        </motion.div>
      </div>
    </div>
  )
}
