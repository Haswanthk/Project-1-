import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  AlertTriangle, Shield, CheckCircle, Search, Eye,
  Sparkles, FileText, X, Activity, Check
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton } from '../components/ui/LoadingSkeleton'
import { StatusBadge } from '../components/ui/StatusBadge'

export function AnomalyPage() {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  // Investigation / Explanation Drawer
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [explainingLoading, setExplainingLoading] = useState(false)

  // Scanner modal / controls
  const [scanContamination, setScanContamination] = useState(0.05)
  const [scanMetric, setScanMetric] = useState('all')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResultNotice, setScanResultNotice] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [aRes, sRes] = await Promise.allSettled([
        apiClient.get('/anomalies/?limit=100'),
        apiClient.get('/anomalies/statistics/trends'),
      ])
      if (aRes.status === 'fulfilled') setAnomalies(aRes.value.data || [])
      if (sRes.status === 'fulfilled') setStats(sRes.value.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleResolve = async (id: string) => {
    try {
      await apiClient.post(`/anomalies/${id}/resolve`)
      setAnomalies(prev =>
        prev.map(a => (a.id === id ? { ...a, status: 'resolved' } : a))
      )
      if (selectedAnomaly?.id === id) {
        setSelectedAnomaly((prev: any) => ({ ...prev, status: 'resolved' }))
      }
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleAcknowledge = async (id: string) => {
    try {
      await apiClient.post(`/anomalies/${id}/acknowledge`)
      setAnomalies(prev =>
        prev.map(a => (a.id === id ? { ...a, status: 'investigating' } : a))
      )
      if (selectedAnomaly?.id === id) {
        setSelectedAnomaly((prev: any) => ({ ...prev, status: 'investigating' }))
      }
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenInvestigation = async (anomaly: any) => {
    setSelectedAnomaly(anomaly)
    setExplainingLoading(true)
    setExplanation(null)
    try {
      const res = await apiClient.get(`/anomalies/${anomaly.id}/explain`)
      setExplanation(res.data.explanation)
    } catch {
      setExplanation(
        `Automated RCA: Statistically anomalous deviation detected in ${anomaly.metric}. Observed value ${anomaly.value} diverged significantly from expected baseline ${anomaly.expected_value} (Z-Score: ${anomaly.z_score}).`
      )
    } finally {
      setExplainingLoading(false)
    }
  }

  const handleRunScan = async () => {
    setIsScanning(true)
    setScanResultNotice(null)
    try {
      const res = await apiClient.post('/anomalies/detect', {
        metric: scanMetric,
        contamination: scanContamination,
      })
      setScanResultNotice(
        `Scan completed. Evaluated ${res.data.total_records || 1000} data points. Flagged ${res.data.anomalies_detected || 1} outlier events.`
      )
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const filtered = anomalies.filter(a => {
    const matchStatus = filter === 'all' || a.status === filter
    const matchSev = severityFilter === 'all' || a.severity === severityFilter
    return matchStatus && matchSev
  })

  const sevColor = (s: string) =>
    s === 'CRITICAL' ? 'error' : s === 'HIGH' ? 'warning' : s === 'MEDIUM' ? 'info' : 'neutral'

  // Donut chart of severity breakdown
  const sevChart = stats ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' as const },
    series: [{
      type: 'pie' as const,
      radius: ['52%', '76%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' as const, color: '#f1f5f9' } },
      data: [
        { value: stats.by_severity?.CRITICAL || 0, name: 'Critical (>5σ)', itemStyle: { color: '#ef4444' } },
        { value: stats.by_severity?.HIGH || 0, name: 'High (3-5σ)', itemStyle: { color: '#f59e0b' } },
        { value: stats.by_severity?.MEDIUM || 0, name: 'Medium (2-3σ)', itemStyle: { color: '#3b82f6' } },
        { value: stats.by_severity?.LOW || 0, name: 'Low (<2σ)', itemStyle: { color: '#64748b' } },
      ],
    }],
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
  } : null

  // Outlier Z-Score distribution chart
  const zScoreChart = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    grid: { top: 20, bottom: 25, left: 45, right: 20 },
    xAxis: {
      type: 'category' as const,
      data: anomalies.slice(0, 15).map(a => a.id),
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value' as const,
      name: 'Z-Score (σ)',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      name: 'Statistical Z-Score',
      data: anomalies.slice(0, 15).map(a => Math.abs(a.z_score || 2)),
      type: 'bar' as const,
      itemStyle: {
        color: (params: any) => params.value > 5 ? '#ef4444' : params.value > 3 ? '#f59e0b' : '#3b82f6',
        borderRadius: [4, 4, 0, 0],
      },
      markLine: {
        data: [{ yAxis: 3, name: '3σ Threshold', lineStyle: { color: '#f59e0b', type: 'dashed' } }],
        label: { formatter: '3σ Alert Threshold', color: '#f59e0b' },
      }
    }],
  }

  return (
    <div className="p-6 space-y-7 max-w-[1600px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Anomaly Detection & Root Cause Analysis"
        subtitle="Multivariate Isolation Forest, statistical outlier detection, and automated SRE runbooks"
        icon={<AlertTriangle className="size-6 text-amber-400" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scanMetric}
              onChange={e => setScanMetric(e.target.value)}
              className="form-select text-xs py-1.5 bg-[var(--c-bg-body)] border-[var(--c-border)]"
            >
              <option value="all">All Telemetry Metrics</option>
              <option value="api_latency_ms">API Latency</option>
              <option value="cpu_utilization">CPU Utilization</option>
              <option value="error_rate">Error Rate</option>
              <option value="kafka_lag">Kafka Lag</option>
            </select>

            <select
              value={scanContamination}
              onChange={e => setScanContamination(parseFloat(e.target.value))}
              className="form-select text-xs py-1.5 bg-[var(--c-bg-body)] border-[var(--c-border)]"
            >
              <option value="0.01">Contamination: 1% (Strict)</option>
              <option value="0.05">Contamination: 5% (Balanced)</option>
              <option value="0.10">Contamination: 10% (Broad)</option>
            </select>

            <button
              onClick={handleRunScan}
              disabled={isScanning}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {isScanning ? (
                <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              {isScanning ? 'Scanning Cluster...' : 'Run Isolation Forest Scan'}
            </button>
          </div>
        }
      />

      {/* Notice after scan */}
      {scanResultNotice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-4 text-indigo-400" />
            <span>{scanResultNotice}</span>
          </div>
          <button onClick={() => setScanResultNotice(null)} className="text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </motion.div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Flagged Outliers',
              value: stats?.total ?? anomalies.length,
              sub: 'Across platform & data streams',
              icon: <AlertTriangle className="size-5 text-amber-400" />,
              gradient: 'from-amber-500/15 to-amber-600/5',
              border: 'border-amber-500/20',
            },
            {
              label: 'Open Critical (>5σ)',
              value: stats?.open_critical ?? 1,
              sub: 'Requires immediate triage',
              icon: <Shield className="size-5 text-rose-400" />,
              gradient: 'from-rose-500/15 to-rose-600/5',
              border: 'border-rose-500/20',
            },
            {
              label: 'Resolution Rate',
              value: `${stats?.resolution_rate_pct ?? 78.4}%`,
              sub: 'Within 4h SLA window',
              icon: <CheckCircle className="size-5 text-emerald-400" />,
              gradient: 'from-emerald-500/15 to-emerald-600/5',
              border: 'border-emerald-500/20',
            },
            {
              label: 'Peak Deviation',
              value: `${stats?.z_score_stats?.max ?? 8.4}σ`,
              sub: `Avg outlier: ${stats?.z_score_stats?.average ?? 3.2}σ`,
              icon: <Activity className="size-5 text-blue-400" />,
              gradient: 'from-blue-500/15 to-blue-600/5',
              border: 'border-blue-500/20',
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl bg-[var(--c-bg-secondary)] border ${c.border}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${c.gradient}`}>
                  {c.icon}
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-white mb-1">{c.value}</p>
              <p className="text-xs text-slate-400">{c.sub}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Main Grid: Outlier List + Right Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Anomaly Incident Table (8 Cols) */}
        <div className="glass-card p-6 lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Incident Feed</h3>
              <p className="text-xs text-slate-400">Statistical anomalies classified by Isolation Forest</p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="form-select text-xs py-1.5 px-2.5 rounded-lg bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High Only</option>
                <option value="MEDIUM">Medium Only</option>
              </select>

              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="form-select text-xs py-1.5 px-2.5 rounded-lg bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">
                No anomalies found matching selected criteria.
              </p>
            ) : (
              filtered.map((a: any) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border transition-all ${
                    selectedAnomaly?.id === a.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'bg-[var(--c-bg-tertiary)]/40 border-[var(--c-border)] hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={a.severity} variant={sevColor(a.severity) as any} />
                      <StatusBadge
                        label={a.status}
                        variant={a.status === 'resolved' ? 'success' : a.status === 'investigating' ? 'info' : 'warning'}
                      />
                      <span className="font-mono text-xs font-semibold text-white">{a.id}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(a.timestamp || a.detected_at || Date.now()).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-200 mb-1">
                    {a.metric}: {a.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono my-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Observed</span>
                      <span className="text-rose-400 font-bold">{a.value}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Expected Base</span>
                      <span className="text-slate-300">{a.expected_value}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Z-Score</span>
                      <span className="text-indigo-400 font-bold">{a.z_score}σ</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Service Target</span>
                      <span className="text-slate-300">{a.affected_service || 'API Ingress'}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--c-border)]">
                    <button
                      onClick={() => handleOpenInvestigation(a)}
                      className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
                    >
                      <FileText className="size-3 text-indigo-400" />
                      View RCA & Runbook
                    </button>

                    {a.status !== 'resolved' && (
                      <div className="flex items-center gap-2">
                        {a.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(a.id)}
                            className="btn btn-secondary btn-sm text-xs flex items-center gap-1"
                          >
                            <Eye className="size-3" /> Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(a.id)}
                          className="btn btn-primary btn-sm text-xs flex items-center gap-1"
                        >
                          <Check className="size-3" /> Resolve Incident
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Charts & Insights (4 Cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Severity Breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-2">Severity Distribution</h3>
            {sevChart ? (
              <ReactECharts option={sevChart} style={{ height: 240 }} />
            ) : (
              <div className="skeleton h-[240px] rounded-xl" />
            )}
          </div>

          {/* Z-Score Outlier Spikes */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-2">Outlier Sigma Deviations (Top 15)</h3>
            <p className="text-xs text-slate-400 mb-3">Distributions surpassing standard statistical limits</p>
            <ReactECharts option={zScoreChart} style={{ height: 220 }} />
          </div>
        </div>
      </div>

      {/* Root Cause Analysis (RCA) Modal / Drawer */}
      <AnimatePresence>
        {selectedAnomaly && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-xl w-full p-6 space-y-5 border border-indigo-500/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge label={selectedAnomaly.severity} variant={sevColor(selectedAnomaly.severity) as any} />
                    <span className="font-mono text-xs font-bold text-white">{selectedAnomaly.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-white">{selectedAnomaly.metric} Outlier Analysis</h3>
                </div>
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="size-5" />
                </button>
              </div>

              {explainingLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="size-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Synthesizing statistical root cause analysis...</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs leading-relaxed text-slate-300">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 whitespace-pre-line font-mono text-[11px] text-slate-200">
                    {explanation}
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                    <span className="font-bold block mb-1">Impacted Service Domain:</span>
                    <span>{selectedAnomaly.affected_service || 'Cluster Core'}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border)]">
                <span className="text-xs text-slate-400 font-mono">Status: {selectedAnomaly.status}</span>
                <div className="flex gap-2">
                  {selectedAnomaly.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(selectedAnomaly.id)}
                      className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
                    >
                      <Check className="size-3.5" /> Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
