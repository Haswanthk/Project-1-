import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { BarChart2, Database, CheckCircle, AlertTriangle, Gauge } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { CardSkeleton } from '../components/ui/LoadingSkeleton'
import { EmptyState } from '../components/ui/EmptyState'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function DataProfilingPage() {
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profiling, setProfiling] = useState(false)

  useEffect(() => { apiClient.get('/datasets/').then(r => { setDatasets(r.data); setLoading(false) }).catch(() => setLoading(false)) }, [])

  const runProfile = async (id: number) => {
    setSelectedId(id); setProfiling(true)
    try { const r = await apiClient.get(`/datasets/${id}/profile`); setProfile(r.data) } catch {}
    setProfiling(false)
  }

  const qualityScore = profile?.data_quality?.overall_score ?? profile?.profiling?.data_quality?.overall_score
  const qualityDims = profile?.data_quality?.dimensions ?? profile?.profiling?.data_quality?.dimensions
  const missing = profile?.missing_values ?? profile?.profiling?.missing_values ?? {}
  const dist = profile?.distribution_analysis ?? profile?.profiling?.distribution_analysis ?? {}
  const histograms = profile?.chart_payload?.histograms ?? profile?.profiling?.chart_payload?.histograms ?? {}

  const qualityColor = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444'

  const histChart = Object.keys(histograms).length ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 40, right: 20 },
    xAxis: { type: 'category' as const, data: histograms[Object.keys(histograms)[0]]?.map((_: any, i: number) => `Bin ${i + 1}`), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: Object.entries(histograms).slice(0, 4).map(([name, data], i) => ({
      name, data: data as number[], type: 'bar' as const, stack: 'total',
      itemStyle: { color: ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b'][i], borderRadius: i === Object.keys(histograms).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0] },
    })),
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Data Profiling" subtitle="Comprehensive data quality analysis and distribution insights" icon={<BarChart2 className="size-6" />} />

      {/* Dataset Selector */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Select Dataset to Profile</h3>
        {loading ? <CardSkeleton count={3} /> : datasets.length === 0 ? (
          <EmptyState icon={<Database className="size-8" />} title="No datasets" description="Upload a dataset first" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {datasets.map((d: any) => (
              <motion.button key={d.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => runProfile(d.id)}
                className={`p-4 rounded-xl border text-left transition-all ${selectedId === d.id ? 'border-indigo-500/30 bg-indigo-500/8' : 'border-[var(--c-border)] hover:border-[var(--c-border-strong)]'}`}>
                <p className="text-sm font-semibold">{d.name || d.filename}</p>
                <p className="text-xs text-[var(--c-text-muted)]">{(d.row_count ?? d.rows)?.toLocaleString() ?? '?'} rows · {(d.column_count ?? d.columns) ?? '?'} cols</p>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {profiling && <div className="flex items-center justify-center py-12"><div className="size-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>}

      {profile && !profiling && (
        <>
          {/* Quality Score */}
          {qualityScore !== undefined && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={fadeUp} className="stat-card p-5">
                <div className="flex items-center gap-3 mb-3"><div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5"><Gauge className="size-5 text-emerald-400" /></div><span className="text-xs font-medium text-[var(--c-text-secondary)]">Quality Score</span></div>
                <p className="text-3xl font-bold" style={{ color: qualityColor(qualityScore) }}>{qualityScore}<span className="text-lg text-[var(--c-text-muted)]">/100</span></p>
              </motion.div>
              {qualityDims && Object.entries(qualityDims).map(([k, v]) => (
                <motion.div key={k} variants={fadeUp} className="stat-card p-5">
                  <div className="flex items-center gap-3 mb-3"><div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-600/5"><CheckCircle className="size-5 text-indigo-400" /></div><span className="text-xs font-medium text-[var(--c-text-secondary)] capitalize">{k}</span></div>
                  <p className="text-2xl font-bold">{v as number}<span className="text-sm text-[var(--c-text-muted)]">%</span></p>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 progress-bar-fill" style={{ width: `${v as number}%` }} /></div>
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Missing Values */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="size-4 text-amber-400" /> Missing Values</h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                {Object.entries(missing).map(([col, count]) => (
                  <div key={col} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[200px]">{col}</span>
                    <div className="flex items-center gap-2"><span className={`text-sm font-semibold ${(count as number) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{count as number}</span></div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Distribution Analysis */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-4">Distribution Analysis</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {Object.entries(dist).map(([col, info]: [string, any]) => (
                  <div key={col} className="p-3 rounded-lg bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                    <p className="text-sm font-medium mb-1">{col}</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[var(--c-bg-secondary)] text-[var(--c-text-secondary)]">Skew: {info.skewness}</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--c-bg-secondary)] text-[var(--c-text-secondary)]">Kurt: {info.kurtosis}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{info.skewness_label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Histogram */}
          {histChart && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold mb-4">Value Distribution Histograms</h3>
              <ReactECharts option={histChart} style={{ height: 350 }} />
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
