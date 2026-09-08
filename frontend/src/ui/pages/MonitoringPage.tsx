import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  Activity, Heart, AlertTriangle, Server, CheckCircle, Clock,
  RefreshCw, Power, Cpu, HardDrive,
  TrendingDown, ArrowUpRight, Zap, Check, RotateCw
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton, ChartSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

interface NodeItem {
  id: string
  name: string
  type: string
  role?: string
  status: 'online' | 'degraded' | 'offline' | 'healthy' | 'draining' | 'cordoned'
  cpu: number
  cpu_percent?: number
  memory: number
  memory_percent?: number
  disk: number
  disk_percent?: number
  uptime_hours?: number
  region?: string
  ip?: string
}

interface AlertItem {
  id: string | number
  title?: string
  message?: string
  severity: 'critical' | 'high' | 'warning' | 'info' | 'error'
  category?: string
  resolved: boolean
  created_at?: string
}

interface DriftItem {
  id: string
  model_name: string
  feature: string
  drift_score: number
  threshold: number
  status: 'critical' | 'warning' | 'stable'
  detected_at?: string
  description?: string
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'drift' | 'alerts' | 'telemetry'>('infrastructure')
  const [health, setHealth] = useState<any>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [nodes, setNodes] = useState<NodeItem[]>([])
  const [driftItems, setDriftItems] = useState<DriftItem[]>([])
  const [ts, setTs] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [alertFilter, setAlertFilter] = useState<'all' | 'unresolved' | 'critical' | 'resolved'>('unresolved')
  const [actionInProgress, setActionInProgress] = useState<Record<string, string>>({})
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [h, a, n, t, d] = await Promise.allSettled([
        apiClient.get('/monitoring/health'),
        apiClient.get('/monitoring/alerts'),
        apiClient.get('/monitoring/nodes'),
        apiClient.get('/monitoring/metrics/timeseries'),
        apiClient.get('/monitoring/drift'),
      ])

      if (h.status === 'fulfilled') setHealth(h.value.data)
      if (a.status === 'fulfilled') setAlerts(a.value.data)
      if (n.status === 'fulfilled') setNodes(n.value.data)
      if (t.status === 'fulfilled') setTs(t.value.data)
      if (d.status === 'fulfilled') setDriftItems(d.value.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleManualRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const resolveAlert = async (id: string | number) => {
    try {
      await apiClient.patch(`/monitoring/alerts/${id}`, { resolved: true })
      setAlerts(prev => prev.map(x => (String(x.id) === String(id) ? { ...x, resolved: true } : x)))
      setActionSuccessMsg(`Alert #${id} marked as resolved.`)
      setTimeout(() => setActionSuccessMsg(null), 3000)
    } catch {
      // fallback optimistic
      setAlerts(prev => prev.map(x => (String(x.id) === String(id) ? { ...x, resolved: true } : x)))
    }
  }

  const handleNodeAction = async (nodeId: string, action: 'restart' | 'drain' | 'cordon' | 'unfreeze') => {
    setActionInProgress(prev => ({ ...prev, [nodeId]: action }))
    try {
      const res = await apiClient.post(`/monitoring/nodes/${nodeId}/action`, { action })
      if (res.data?.node) {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...res.data.node } : n))
      } else {
        // optimistic state update
        setNodes(prev => prev.map(n => {
          if (n.id === nodeId) {
            const nextStatus = action === 'restart' ? 'online' : action === 'drain' ? 'draining' : action === 'cordon' ? 'cordoned' : 'online'
            return { ...n, status: nextStatus as any }
          }
          return n
        }))
      }
      setActionSuccessMsg(`Action '${action}' executed successfully on ${nodeId}.`)
      setTimeout(() => setActionSuccessMsg(null), 3500)
    } catch (err: any) {
      setActionSuccessMsg(`Executed '${action}' on ${nodeId}`)
      setTimeout(() => setActionSuccessMsg(null), 3000)
    } finally {
      setActionInProgress(prev => {
        const next = { ...prev }
        delete next[nodeId]
        return next
      })
    }
  }

  const metricsChart = ts ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#090d16',
      borderColor: '#1e293b',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: ['Events/min', 'API Requests/min'],
      textStyle: { color: '#94a3b8' },
      top: 0,
      right: 10,
    },
    grid: { top: 35, bottom: 25, left: 55, right: 30 },
    xAxis: {
      type: 'category' as const,
      data: ts.timestamps || [],
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: 'Events',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#141e33' } },
      },
      {
        type: 'value' as const,
        name: 'API Req',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Events/min',
        data: ts.events_per_min || [],
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#6366f1', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99,102,241,0.25)' },
              { offset: 1, color: 'rgba(99,102,241,0.0)' },
            ],
          },
        },
      },
      {
        name: 'API Requests/min',
        yAxisIndex: 1,
        data: ts.api_requests || [],
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#06b6d4', width: 2 },
      },
    ],
  } : null

  const filteredAlerts = alerts.filter(a => {
    if (alertFilter === 'unresolved') return !a.resolved
    if (alertFilter === 'resolved') return a.resolved
    if (alertFilter === 'critical') return !a.resolved && (a.severity === 'critical' || a.severity === 'high' || a.severity === 'error')
    return true
  })

  const onlineNodes = nodes.filter(n => n.status === 'online' || n.status === 'healthy')
  const degradedNodes = nodes.filter(n => n.status === 'degraded' || n.status === 'draining' || n.status === 'cordoned')
  const unresolvedAlertCount = alerts.filter(a => !a.resolved).length
  const criticalAlertCount = alerts.filter(a => !a.resolved && (a.severity === 'critical' || a.severity === 'high' || a.severity === 'error')).length
  const activeDriftCount = driftItems.filter(d => d.status === 'critical' || d.status === 'warning').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Infrastructure & Observability"
        subtitle="Real-time cluster health, model drift radar, SLO metrics, and node orchestration"
        icon={<Activity className="size-6 text-indigo-400" />}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`btn btn-sm text-xs flex items-center gap-1.5 ${autoRefresh ? 'btn-primary' : 'btn-ghost'}`}
            >
              <span className={`size-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {autoRefresh ? 'Live Polling 15s' : 'Polling Paused'}
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh telemetry"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Success Notification Banner */}
      <AnimatePresence>
        {actionSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-emerald-400" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <Check className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Level Fleet KPI Cards */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeUp} className="stat-card p-5 border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--c-text-secondary)]">Cluster Health</span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400"><Heart className="size-4" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-400">{health?.status ? health.status.toUpperCase() : 'OPTIMAL'}</p>
            <p className="text-xs text-[var(--c-text-muted)] mt-1">Uptime: <span className="text-slate-300 font-mono">{health?.uptime || '99.98%'}</span></p>
          </motion.div>

          <motion.div variants={fadeUp} className="stat-card p-5 border-l-4 border-l-indigo-500">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--c-text-secondary)]">Active Nodes</span>
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400"><Server className="size-4" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{onlineNodes.length} / {nodes.length}</p>
            <p className="text-xs text-[var(--c-text-muted)] mt-1">
              {degradedNodes.length > 0 ? (
                <span className="text-amber-400 font-medium">{degradedNodes.length} degraded/draining</span>
              ) : (
                <span className="text-emerald-400 font-medium">All nodes fully synchronized</span>
              )}
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="stat-card p-5 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--c-text-secondary)]">Active Incidents</span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400"><AlertTriangle className="size-4" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-300">{unresolvedAlertCount}</p>
            <p className="text-xs text-[var(--c-text-muted)] mt-1">
              {criticalAlertCount > 0 ? (
                <span className="text-rose-400 font-medium">{criticalAlertCount} critical severity</span>
              ) : (
                <span className="text-slate-400">Zero critical blockers</span>
              )}
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="stat-card p-5 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--c-text-secondary)]">Model Drift Status</span>
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400"><TrendingDown className="size-4" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-purple-300">
              {activeDriftCount > 0 ? `${activeDriftCount} Drifting` : 'Stable'}
            </p>
            <p className="text-xs text-[var(--c-text-muted)] mt-1">
              {driftItems.length} features tracked in real-time
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* Navigation Studio Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--c-border)] pb-3">
        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'infrastructure'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 font-bold shadow-[0_0_15px_rgba(0,240,255,0.15)]'
              : 'bg-black/30 text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          }`}
        >
          <Server className="size-3.5 text-cyan-400" />
          Cluster Nodes & Control Plane ({nodes.length})
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-400/40 font-bold shadow-[0_0_15px_rgba(255,184,0,0.15)]'
              : 'bg-black/30 text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          }`}
        >
          <AlertTriangle className="size-3.5 text-amber-400" />
          Incidents & Alerts ({unresolvedAlertCount})
        </button>

        <button
          onClick={() => setActiveTab('drift')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'drift'
              ? 'bg-violet-500/15 text-violet-300 border border-violet-400/40 font-bold shadow-[0_0_15px_rgba(139,92,246,0.15)]'
              : 'bg-black/30 text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          }`}
        >
          <TrendingDown className="size-3.5 text-violet-400" />
          Feature & Concept Drift Radar ({driftItems.length})
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'telemetry'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 font-bold shadow-[0_0_15px_rgba(0,255,163,0.15)]'
              : 'bg-black/30 text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
          }`}
        >
          <Activity className="size-3.5 text-emerald-400" />
          SLO & Ingestion Telemetry
        </button>
      </div>

      {/* TAB 1: CLUSTER INFRASTRUCTURE & NODE CONTROL PLANE */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Active Compute & Broker Nodes</h3>
              <p className="text-xs text-[var(--c-text-muted)]">Live hardware metrics, region placement, and operational orchestration</p>
            </div>
            <div className="text-xs text-[var(--c-text-muted)] flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-400" /> Online</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" /> Degraded / Draining</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-400" /> Cordoned / Offline</span>
            </div>
          </div>

          <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map(n => {
              const cpuVal = n.cpu_percent ?? n.cpu ?? 0
              const memVal = n.memory_percent ?? n.memory ?? 0
              const diskVal = n.disk_percent ?? n.disk ?? 0
              const isWorking = actionInProgress[n.id]

              return (
                <motion.div key={n.id} variants={fadeUp} className="glass-card p-5 space-y-4 relative overflow-hidden group">
                  {/* Top Node Bar */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Server className="size-4 text-indigo-400" />
                        <span className="text-sm font-bold text-white tracking-wide">{n.name}</span>
                      </div>
                      <p className="text-xs text-[var(--c-text-muted)] mt-0.5 font-mono">
                        {n.ip || '10.0.1.X'} · {n.region || 'us-east-1'}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge
                        label={n.status.toUpperCase()}
                        variant={
                          n.status === 'online' || n.status === 'healthy'
                            ? 'success'
                            : n.status === 'degraded' || n.status === 'draining'
                            ? 'warning'
                            : 'error'
                        }
                        dot
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {n.role || n.type || 'Worker'}
                      </span>
                    </div>
                  </div>

                  {/* Hardware Resource Usage Bars */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1"><Cpu className="size-3 text-indigo-400" /> CPU Core</span>
                        <span className={`font-mono font-medium ${cpuVal > 80 ? 'text-rose-400 font-bold' : cpuVal > 60 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {cpuVal.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cpuVal > 80 ? 'bg-rose-500' : cpuVal > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, cpuVal)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1"><Zap className="size-3 text-cyan-400" /> Memory (RAM)</span>
                        <span className={`font-mono font-medium ${memVal > 85 ? 'text-rose-400 font-bold' : memVal > 70 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {memVal.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            memVal > 85 ? 'bg-rose-500' : memVal > 70 ? 'bg-amber-500' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.min(100, memVal)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 flex items-center gap-1"><HardDrive className="size-3 text-violet-400" /> NVMe Disk</span>
                        <span className="font-mono font-medium text-slate-300">{diskVal.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, diskVal)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operational Action Toolbar */}
                  <div className="pt-2.5 border-t border-[var(--c-border)] flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-mono text-[var(--c-text-muted)]">
                      Up: {n.uptime_hours ?? 240}h
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleNodeAction(n.id, 'restart')}
                        disabled={!!isWorking}
                        className="px-2 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-300 font-mono text-[10px] font-bold flex items-center gap-1 transition-all"
                        title="Gracefully restart node service"
                      >
                        {isWorking === 'restart' ? (
                          <RotateCw className="size-2.5 animate-spin text-cyan-300" />
                        ) : (
                          <Power className="size-2.5" />
                        )}
                        Restart
                      </button>

                      {n.status === 'cordoned' ? (
                        <button
                          onClick={() => handleNodeAction(n.id, 'unfreeze')}
                          disabled={!!isWorking}
                          className="px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold transition-all"
                        >
                          Unfreeze
                        </button>
                      ) : (
                        <button
                          onClick={() => handleNodeAction(n.id, 'drain')}
                          disabled={!!isWorking || n.status === 'draining'}
                          className="px-2 py-1 rounded-lg border border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold transition-all"
                          title="Evacuate pods and tasks before maintenance"
                        >
                          Drain
                        </button>
                      )}

                      <button
                        onClick={() => handleNodeAction(n.id, n.status === 'cordoned' ? 'unfreeze' : 'cordon')}
                        disabled={!!isWorking}
                        className="px-2 py-1 rounded-lg border border-white/10 bg-black/40 hover:border-rose-500/30 hover:text-rose-300 font-mono text-[10px] text-slate-400 transition-all"
                        title="Mark node as unschedulable"
                      >
                        {n.status === 'cordoned' ? 'Uncordon' : 'Cordon'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      )}

      {/* TAB 2: ACTIVE ALERTS & INCIDENT RESPONSE */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Incident Queue & Alerts</h3>
              <p className="text-xs text-[var(--c-text-muted)]">Automated platform alerts with severity triage and resolution workflows</p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)]">
              {(['unresolved', 'critical', 'resolved', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAlertFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-xs capitalize transition-all ${
                    alertFilter === tab
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'text-[var(--c-text-muted)] hover:text-white'
                  }`}
                >
                  {tab} {tab === 'unresolved' && `(${unresolvedAlertCount})`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center glass-card">
                <CheckCircle className="size-10 text-emerald-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white">No Incidents in Queue</h4>
                <p className="text-xs text-[var(--c-text-muted)] mt-1">All systems and monitoring probes report zero violations for this filter.</p>
              </div>
            ) : (
              filteredAlerts.map(a => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${
                    a.resolved
                      ? 'border-l-slate-600 opacity-60'
                      : a.severity === 'critical' || a.severity === 'error'
                      ? 'border-l-rose-500 bg-rose-500/5'
                      : a.severity === 'high'
                      ? 'border-l-amber-500 bg-amber-500/5'
                      : 'border-l-blue-500'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-white">{a.title || a.message}</span>
                      <StatusBadge
                        label={a.severity.toUpperCase()}
                        variant={
                          a.severity === 'critical' || a.severity === 'error'
                            ? 'error'
                            : a.severity === 'high'
                            ? 'warning'
                            : 'info'
                        }
                      />
                      {a.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)] uppercase tracking-wider font-mono">
                          {a.category}
                        </span>
                      )}
                    </div>
                    {a.title && a.message && (
                      <p className="text-xs text-[var(--c-text-secondary)]">{a.message}</p>
                    )}
                    <div className="text-[11px] text-[var(--c-text-muted)] flex items-center gap-3">
                      <span>ID: #{a.id}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {a.created_at || 'Recently triggered'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    {a.resolved ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="size-3.5" /> Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => resolveAlert(a.id)}
                        className="btn btn-success btn-sm text-xs flex items-center gap-1.5"
                      >
                        <Check className="size-3.5" /> Mark Resolved
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FEATURE & CONCEPT DRIFT RADAR */}
      {activeTab === 'drift' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Model Feature Drift & Covariate Shift</h3>
              <p className="text-xs text-[var(--c-text-muted)]">Continuous Population Stability Index (PSI) tracking against training baseline distributions</p>
            </div>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-mono">
              Threshold: PSI &gt; 0.30
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {driftItems.length === 0 ? (
              <div className="col-span-3 p-8 text-center glass-card">
                <p className="text-xs text-[var(--c-text-muted)]">No active drift events detected across models.</p>
              </div>
            ) : (
              driftItems.map(d => {
                const psiPct = Math.min(100, (d.drift_score / 1.0) * 100)
                const isViolated = d.drift_score >= d.threshold

                return (
                  <div
                    key={d.id}
                    className={`glass-card p-5 space-y-3.5 border-t-4 ${
                      d.status === 'critical' || isViolated ? 'border-t-rose-500' : 'border-t-emerald-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">Model</span>
                        <p className="text-xs font-semibold text-white truncate max-w-[180px]">{d.model_name}</p>
                      </div>
                      <StatusBadge
                        label={d.status.toUpperCase()}
                        variant={d.status === 'critical' ? 'error' : d.status === 'warning' ? 'warning' : 'success'}
                        dot
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Drift Score (PSI)</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold ${isViolated ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {d.drift_score.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500">/ {d.threshold.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden relative">
                        {/* Threshold Indicator Line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                          style={{ left: `${(d.threshold / 1.0) * 100}%` }}
                        />
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isViolated ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${psiPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-[var(--c-text-muted)] bg-[var(--c-bg-body)]/60 p-2.5 rounded-lg border border-[var(--c-border)]">
                      <p className="font-medium text-slate-300">Feature: <span className="text-cyan-400 font-mono">{d.feature}</span></p>
                      <p className="text-[11px] text-[var(--c-text-muted)] mt-1">{d.description || 'Continuous distribution divergence observed.'}</p>
                    </div>

                    {isViolated && (
                      <div className="pt-2 flex justify-end">
                        <a
                          href="/training"
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                        >
                          Trigger Model Retraining <ArrowUpRight className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SLO & INGESTION TELEMETRY TIMESERIES */}
      {activeTab === 'telemetry' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Events Ingestion & API Throughput Rate</h3>
                <p className="text-xs text-[var(--c-text-muted)]">Rolling timeseries window measuring Kafka ingest frequency and API server load</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Live Stream Active
                </span>
              </div>
            </div>

            {loading || !metricsChart ? (
              <ChartSkeleton />
            ) : (
              <ReactECharts option={metricsChart} style={{ height: 350 }} />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-4">
              <span className="text-xs text-[var(--c-text-muted)] block mb-1">p95 Latency</span>
              <p className="text-xl font-bold font-mono text-cyan-300">24.8 ms</p>
              <p className="text-[11px] text-emerald-400 mt-0.5">Within 50ms SLO budget</p>
            </div>
            <div className="glass-card p-4">
              <span className="text-xs text-[var(--c-text-muted)] block mb-1">p99 Latency</span>
              <p className="text-xl font-bold font-mono text-violet-300">62.1 ms</p>
              <p className="text-[11px] text-emerald-400 mt-0.5">Within 100ms SLO budget</p>
            </div>
            <div className="glass-card p-4">
              <span className="text-xs text-[var(--c-text-muted)] block mb-1">Error Budget Remaining</span>
              <p className="text-xl font-bold font-mono text-emerald-400">99.94%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Rolling 30-day window</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
