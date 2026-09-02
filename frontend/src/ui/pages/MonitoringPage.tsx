import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { Activity, Heart, AlertTriangle, Server, CheckCircle, Clock } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function MonitoringPage() {
  const [health, setHealth] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [nodes, setNodes] = useState<any[]>([])
  const [ts, setTs] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      apiClient.get('/monitoring/health'), apiClient.get('/monitoring/alerts'),
      apiClient.get('/monitoring/nodes'), apiClient.get('/monitoring/metrics/timeseries'),
    ]).then(([h, a, n, t]) => {
      if (h.status === 'fulfilled') setHealth(h.value.data)
      if (a.status === 'fulfilled') setAlerts(a.value.data)
      if (n.status === 'fulfilled') setNodes(n.value.data)
      if (t.status === 'fulfilled') setTs(t.value.data)
      setLoading(false)
    })
  }, [])

  const resolveAlert = async (id: number) => { try { await apiClient.patch(`/monitoring/alerts/${id}`, { resolved: true }); setAlerts(a => a.map(x => x.id === id ? { ...x, resolved: true } : x)) } catch {} }

  const metricsChart = ts ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category' as const, data: ts.timestamps, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Events/min', data: ts.events_per_min, type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#6366f1', width: 2 }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.2)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } } },
      { name: 'API Requests', data: ts.api_requests, type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#06b6d4', width: 2 } },
    ],
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Monitoring" subtitle="Platform health, alerts, and infrastructure status" icon={<Activity className="size-6" />} />

      {loading ? <CardSkeleton /> : health && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'System Status', value: health.status || 'Healthy', icon: <Heart className="size-5 text-emerald-400" />, gradient: 'from-emerald-500/15 to-emerald-600/5' },
            { label: 'Active Alerts', value: alerts.filter(a => !a.resolved).length, icon: <AlertTriangle className="size-5 text-amber-400" />, gradient: 'from-amber-500/15 to-amber-600/5' },
            { label: 'Nodes Online', value: `${nodes.filter(n => n.status === 'healthy' || n.status === 'online').length}/${nodes.length}`, icon: <Server className="size-5 text-blue-400" />, gradient: 'from-blue-500/15 to-blue-600/5' },
            { label: 'Uptime', value: health.uptime || '99.9%', icon: <Clock className="size-5 text-violet-400" />, gradient: 'from-violet-500/15 to-violet-600/5' },
          ].map(c => (
            <motion.div key={c.label} variants={fadeUp} className="stat-card p-5">
              <div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>{c.icon}</div><span className="text-xs font-medium text-[var(--c-text-secondary)]">{c.label}</span></div>
              <p className="text-2xl font-bold tracking-tight">{c.value}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">System Metrics</h3>
        {loading || !metricsChart ? <ChartSkeleton /> : <ReactECharts option={metricsChart} style={{ height: 300 }} />}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Active Alerts</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {alerts.filter(a => !a.resolved).length === 0 ? <p className="text-sm text-center py-4 text-[var(--c-text-muted)]">No active alerts</p> :
              alerts.filter(a => !a.resolved).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                  <div><p className="text-sm font-medium">{a.message || a.title}</p><StatusBadge label={a.severity} variant={a.severity === 'error' ? 'error' : 'warning'} /></div>
                  <button onClick={() => resolveAlert(a.id)} className="btn btn-success btn-sm"><CheckCircle className="size-3" /> Resolve</button>
                </div>
              ))
            }
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Infrastructure Nodes</h3>
          <div className="space-y-2.5">
            {nodes.map((n: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                <div className="flex items-center gap-3"><Server className="size-4 text-blue-400" /><div><p className="text-sm font-medium">{n.name}</p><p className="text-xs text-[var(--c-text-muted)]">{n.role}</p></div></div>
                <div className="text-right"><StatusBadge label={n.status} variant={n.status === 'healthy' || n.status === 'online' ? 'success' : 'warning'} dot /><p className="text-xs text-[var(--c-text-muted)] mt-0.5">CPU: {n.cpu_percent}%</p></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
