import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { AlertTriangle, Shield, CheckCircle, Clock, Search, Eye } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function AnomalyPage() {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchData = async () => {
    const [aRes, sRes] = await Promise.allSettled([
      apiClient.get('/anomalies/'), apiClient.get('/anomalies/statistics/trends'),
    ])
    if (aRes.status === 'fulfilled') setAnomalies(aRes.value.data)
    if (sRes.status === 'fulfilled') setStats(sRes.value.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleResolve = async (id: string) => {
    try { await apiClient.post(`/anomalies/${id}/resolve`); fetchData() } catch {}
  }
  const handleAcknowledge = async (id: string) => {
    try { await apiClient.post(`/anomalies/${id}/acknowledge`); fetchData() } catch {}
  }

  const filtered = filter === 'all' ? anomalies : anomalies.filter(a => a.status === filter)
  const sevColor = (s: string) => s === 'CRITICAL' ? 'error' : s === 'HIGH' ? 'warning' : s === 'MEDIUM' ? 'info' : 'neutral'

  const sevChart = stats ? {
    backgroundColor: 'transparent', tooltip: { trigger: 'item' as const },
    series: [{ type: 'pie' as const, radius: ['50%', '75%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 3 },
      label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#f1f5f9' } },
      data: [
        { value: stats.by_severity?.CRITICAL || 0, name: 'Critical', itemStyle: { color: '#ef4444' } },
        { value: stats.by_severity?.HIGH || 0, name: 'High', itemStyle: { color: '#f59e0b' } },
        { value: stats.by_severity?.MEDIUM || 0, name: 'Medium', itemStyle: { color: '#3b82f6' } },
        { value: stats.by_severity?.LOW || 0, name: 'Low', itemStyle: { color: '#64748b' } },
      ],
    }],
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Anomaly Detection" subtitle="AI-powered detection, investigation, and resolution" icon={<AlertTriangle className="size-6" />}
        actions={<button className="btn btn-primary btn-sm" onClick={() => apiClient.post('/anomalies/detect', { dataset: 'system_metrics', method: 'z_score' }).then(() => fetchData())}><Search className="size-3.5" /> Run Detection</button>}
      />

      {loading ? <CardSkeleton /> : stats && (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Anomalies', value: stats.total, icon: <AlertTriangle className="size-5 text-amber-400" />, gradient: 'from-amber-500/15 to-amber-600/5' },
            { label: 'Open Critical', value: stats.open_critical, icon: <Shield className="size-5 text-rose-400" />, gradient: 'from-rose-500/15 to-rose-600/5' },
            { label: 'Resolution Rate', value: `${stats.resolution_rate_pct}%`, icon: <CheckCircle className="size-5 text-emerald-400" />, gradient: 'from-emerald-500/15 to-emerald-600/5' },
            { label: 'Avg Z-Score', value: stats.z_score_stats?.average, icon: <Clock className="size-5 text-blue-400" />, gradient: 'from-blue-500/15 to-blue-600/5' },
          ].map(c => (
            <motion.div key={c.label} variants={fadeUp} className="stat-card p-5">
              <div className="flex items-center gap-3 mb-3"><div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>{c.icon}</div><span className="text-xs font-medium text-[var(--c-text-secondary)]">{c.label}</span></div>
              <p className="text-2xl font-bold tracking-tight">{c.value}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Anomaly List */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold">Detected Anomalies</h3>
            <div className="relative">
              <select value={filter} onChange={e => setFilter(e.target.value)} className="form-select text-xs py-1.5 pr-8 pl-3 bg-[var(--c-bg-secondary)] rounded-lg">
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-[var(--c-text-muted)] py-8 text-center">No anomalies found</p> :
              filtered.map((a: any) => (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)] hover:border-[var(--c-border-strong)] transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={a.severity} variant={sevColor(a.severity) as any} />
                      <StatusBadge label={a.status} variant={a.status === 'resolved' ? 'success' : a.status === 'investigating' ? 'info' : 'warning'} />
                    </div>
                    <span className="text-[10px] text-[var(--c-text-muted)]">{a.detected_at}</span>
                  </div>
                  <p className="text-sm font-medium mb-1">{a.metric} — {a.description}</p>
                  <p className="text-xs text-[var(--c-text-secondary)] mb-3">Dataset: {a.dataset} · Z-Score: {a.z_score} · Service: {a.affected_service}</p>
                  {a.status !== 'resolved' && (
                    <div className="flex gap-2">
                      {a.status === 'open' && <button onClick={() => handleAcknowledge(a.id)} className="btn btn-secondary btn-sm"><Eye className="size-3" /> Acknowledge</button>}
                      <button onClick={() => handleResolve(a.id)} className="btn btn-success btn-sm"><CheckCircle className="size-3" /> Resolve</button>
                    </div>
                  )}
                </motion.div>
              ))
            }
          </div>
        </motion.div>

        {/* Severity Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Severity Distribution</h3>
          {sevChart ? <ReactECharts option={sevChart} style={{ height: 280 }} /> : <div className="skeleton h-[280px] rounded-xl" />}
          {stats && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wider">By Status</h4>
              {Object.entries(stats.by_status || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm"><span className="capitalize">{k}</span><span className="font-semibold">{v as number}</span></div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
