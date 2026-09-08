import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Plus, Clock, XCircle, Terminal,
  Play, Layers, RefreshCw, X,
  Copy, Check
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

interface SparkStage {
  stage_id: number
  name: string
  tasks: number
  completed: number
  status: 'SUCCESS' | 'RUNNING' | 'PENDING' | 'FAILED'
}

interface SparkJob {
  id: string
  name: string
  master: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  progress?: number
  start_time: string
  end_time?: string | null
  duration_seconds?: number
  executor_memory?: string
  num_executors?: number
  shuffle_read_mb?: number
  shuffle_write_mb?: number
  stages?: SparkStage[]
  logs?: string
}

const JOB_PRESETS = [
  {
    name: 'ETL Pipeline — Enterprise Sales Mart',
    script: 's3://lake/pipelines/sales_mart_delta.py',
    master: 'spark://cluster:7077',
    executor_memory: '4g',
    num_executors: 4,
  },
  {
    name: 'ML Feature Store Generation',
    script: 's3://lake/ml/feature_store_vectorize.py',
    master: 'spark://cluster:7077',
    executor_memory: '8g',
    num_executors: 4,
  },
  {
    name: 'Multivariate Anomaly Batch Scan',
    script: 's3://lake/anomaly/isolation_forest_scan.py',
    master: 'local[*]',
    executor_memory: '2g',
    num_executors: 2,
  },
]

export function SparkJobsPage() {
  const [jobs, setJobs] = useState<SparkJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    script: '',
    master: 'spark://cluster:7077',
    executor_memory: '4g',
    num_executors: 2,
  })
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'RUNNING' | 'COMPLETED' | 'FAILED'>('ALL')
  const [selectedLogs, setSelectedLogs] = useState<{ jobName: string; logs: string } | null>(null)
  const [copiedLogs, setCopiedLogs] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchJobs = async () => {
    try {
      const r = await apiClient.get('/spark/jobs')
      setJobs(r.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const handleApplyPreset = (p: typeof JOB_PRESETS[0]) => {
    setForm({
      name: p.name,
      script: p.script,
      master: p.master,
      executor_memory: p.executor_memory,
      num_executors: p.num_executors,
    })
  }

  const submitJob = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/spark/submit', form)
      setShowForm(false)
      fetchJobs()
    } catch {
      // ignore
    }
  }

  const cancelJob = async (id: string) => {
    try {
      await apiClient.delete(`/spark/jobs/${id}`)
      fetchJobs()
    } catch {
      // ignore
    }
  }

  const openLogs = async (job: SparkJob) => {
    try {
      const r = await apiClient.get(`/spark/jobs/${job.id}/logs`)
      setSelectedLogs({ jobName: job.name, logs: r.data.logs || job.logs || 'No logs recorded.' })
    } catch {
      setSelectedLogs({ jobName: job.name, logs: job.logs || 'No logs recorded.' })
    }
  }

  const handleCopyLogs = () => {
    if (!selectedLogs) return
    navigator.clipboard.writeText(selectedLogs.logs)
    setCopiedLogs(true)
    setTimeout(() => setCopiedLogs(false), 2000)
  }

  const filteredJobs = jobs.filter(j => {
    if (filterStatus === 'ALL') return true
    return j.status === filterStatus
  })

  const runningCount = jobs.filter(j => j.status === 'RUNNING').length
  const completedCount = jobs.filter(j => j.status === 'COMPLETED').length
  const failedCount = jobs.filter(j => j.status === 'FAILED').length
  const totalShuffleRead = jobs.reduce((acc, j) => acc + (j.shuffle_read_mb || 0), 0)

  return (
    <div className="p-6 space-y-7">
      {/* Header */}
      <PageHeader
        title="Apache Spark Batch & DAG Studio"
        subtitle="Submit, monitor, and inspect distributed PySpark and Scala jobs across compute clusters"
        icon={<Cpu className="size-6 text-orange-400" />}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true)
                fetchJobs()
              }}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh job status"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus className="size-3.5" /> Submit Spark Job
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card p-5 border-l-4 border-l-orange-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Active Spark Jobs</span>
          <p className="text-2xl font-bold tracking-tight text-orange-400 mt-2">{runningCount}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">{jobs.length} total scheduled/history</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Completed Runs</span>
          <p className="text-2xl font-bold tracking-tight text-emerald-400 mt-2">{completedCount}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Zero data loss reported</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-rose-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Failed Runs</span>
          <p className="text-2xl font-bold tracking-tight text-rose-400 mt-2">{failedCount}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Requires driver memory review</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-indigo-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Total Shuffle Read</span>
          <p className="text-2xl font-bold tracking-tight text-indigo-300 mt-2">
            {(totalShuffleRead / 1024).toFixed(2)} GB
          </p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Network & disk I/O throughput</p>
        </div>
      </div>

      {/* Submit Job Wizard */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 space-y-4 border border-orange-500/30 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Submit New Spark DAG Task</h3>
                <p className="text-xs text-[var(--c-text-muted)]">Configure driver, script URI, and resource allocations</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Templates */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-[var(--c-text-muted)]">Presets:</span>
              {JOB_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-[var(--c-bg-secondary)] hover:bg-orange-500/20 text-slate-300 hover:text-orange-300 border border-[var(--c-border)] transition-all flex items-center gap-1.5"
                >
                  <Plus className="size-2.5" /> {p.name.split('—')[0]}
                </button>
              ))}
            </div>

            <form onSubmit={submitJob} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="form-label">Job Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Daily Warehouse Materialization"
                  required
                />
              </div>

              <div>
                <label className="form-label">Script URI / Main Class</label>
                <input
                  value={form.script}
                  onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
                  className="form-input font-mono text-xs"
                  placeholder="s3://lake/jobs/etl.py"
                  required
                />
              </div>

              <div>
                <label className="form-label">Spark Master URL</label>
                <input
                  value={form.master}
                  onChange={e => setForm(f => ({ ...f, master: e.target.value }))}
                  className="form-input font-mono text-xs"
                  placeholder="spark://cluster:7077"
                />
              </div>

              <div>
                <label className="form-label">Executor Memory</label>
                <select
                  value={form.executor_memory}
                  onChange={e => setForm(f => ({ ...f, executor_memory: e.target.value }))}
                  className="form-select text-xs"
                >
                  <option value="2g">2 GB (Lightweight)</option>
                  <option value="4g">4 GB (Standard)</option>
                  <option value="8g">8 GB (High Compute)</option>
                  <option value="16g">16 GB (Heavy Shuffling)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Number of Executors</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={form.num_executors}
                  onChange={e => setForm(f => ({ ...f, num_executors: parseInt(e.target.value) || 2 }))}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex items-end justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm flex items-center gap-1.5">
                  <Play className="size-3.5" /> Submit to Cluster
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--c-bg-body)] rounded-xl border border-[var(--c-border)] w-max">
        {(['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterStatus === tab
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-[var(--c-text-muted)] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Jobs List with Multi-Stage DAG and Hardware Specs */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={<Cpu className="size-8 text-orange-400" />}
          title="No Spark Jobs in Queue"
          description="Submit a distributed job or click one of the presets above."
        />
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(j => (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 space-y-4 border-l-4 transition-all"
              style={{
                borderLeftColor:
                  j.status === 'RUNNING'
                    ? '#f97316'
                    : j.status === 'COMPLETED'
                    ? '#10b981'
                    : j.status === 'FAILED'
                    ? '#ef4444'
                    : '#64748b',
              }}
            >
              {/* Job Top Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-400 shrink-0">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{j.name}</h4>
                      <span className="text-[11px] font-mono text-slate-400">ID: {j.id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--c-text-muted)] mt-1">
                      <span className="font-mono text-cyan-400">{j.master}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {j.duration_seconds != null ? `${j.duration_seconds}s duration` : 'Recently started'}
                      </span>
                      <span>·</span>
                      <span>
                        {j.num_executors ?? 2} Executors ({j.executor_memory ?? '4g'} RAM each)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <StatusBadge
                    label={j.status}
                    variant={
                      j.status === 'RUNNING'
                        ? 'warning'
                        : j.status === 'COMPLETED'
                        ? 'success'
                        : j.status === 'FAILED'
                        ? 'error'
                        : 'neutral'
                    }
                    dot
                  />

                  <button
                    onClick={() => openLogs(j)}
                    className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                  >
                    <Terminal className="size-3.5 text-indigo-400" /> View Logs
                  </button>

                  {j.status === 'RUNNING' && (
                    <button
                      onClick={() => cancelJob(j.id)}
                      className="btn btn-danger btn-sm text-xs flex items-center gap-1"
                      title="Terminate Spark Job"
                    >
                      <XCircle className="size-3.5" /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar (if running or has progress) */}
              {j.progress != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[var(--c-text-muted)] font-mono">
                    <span>Overall DAG Execution Progress</span>
                    <span className="text-orange-400 font-bold">{j.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        j.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : j.status === 'FAILED'
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse'
                      }`}
                      style={{ width: `${j.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Multi-Stage DAG Visualizer */}
              {j.stages && j.stages.length > 0 && (
                <div className="pt-2 border-t border-[var(--c-border)] space-y-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-indigo-400" /> DAG Execution Stages ({j.stages.length})
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {j.stages.map(st => {
                      const stagePct = st.tasks > 0 ? Math.round((st.completed / st.tasks) * 100) : 0
                      return (
                        <div
                          key={st.stage_id}
                          className="p-3 rounded-xl bg-[var(--c-bg-body)]/70 border border-[var(--c-border)] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-slate-400">Stage {st.stage_id}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                st.status === 'SUCCESS'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : st.status === 'RUNNING'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : st.status === 'FAILED'
                                  ? 'bg-rose-500/15 text-rose-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {st.status}
                            </span>
                          </div>

                          <p className="font-medium text-slate-200 truncate" title={st.name}>
                            {st.name}
                          </p>

                          <div>
                            <div className="flex justify-between text-[11px] text-[var(--c-text-muted)] mb-1">
                              <span>Tasks: {st.completed}/{st.tasks}</span>
                              <span>{stagePct}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  st.status === 'SUCCESS'
                                    ? 'bg-emerald-500'
                                    : st.status === 'FAILED'
                                    ? 'bg-rose-500'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${stagePct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Shuffle & I/O Telemetry Footer */}
              <div className="flex flex-wrap items-center justify-between text-xs text-[var(--c-text-muted)] pt-2 border-t border-[var(--c-border)]">
                <div className="flex items-center gap-4">
                  <span>
                    Shuffle Read: <strong className="text-slate-200">{j.shuffle_read_mb ?? 0} MB</strong>
                  </span>
                  <span>
                    Shuffle Write: <strong className="text-slate-200">{j.shuffle_write_mb ?? 0} MB</strong>
                  </span>
                </div>
                <div>
                  Started: {new Date(j.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Console Logs Modal */}
      <AnimatePresence>
        {selectedLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden border border-orange-500/30 shadow-2xl"
            >
              <div className="p-4 border-b border-[var(--c-border)] flex items-center justify-between bg-[var(--c-bg-secondary)]">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-white truncate max-w-md">
                    {selectedLogs.jobName} — Output Logs
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLogs}
                    className="btn btn-ghost btn-xs text-xs flex items-center gap-1 text-slate-300 hover:text-white"
                  >
                    {copiedLogs ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copiedLogs ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => setSelectedLogs(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto font-mono text-xs bg-[#090d16] text-slate-300 leading-relaxed space-y-1">
                {selectedLogs.logs.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${
                      line.includes('ERROR') || line.includes('Exception')
                        ? 'text-rose-400 bg-rose-500/10 px-1 rounded'
                        : line.includes('WARN')
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 select-none text-right w-6">{i + 1}</span>
                    <span className="whitespace-pre-wrap">{line}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-[var(--c-border)] bg-[var(--c-bg-body)] flex justify-end">
                <button
                  onClick={() => setSelectedLogs(null)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Close Console
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
