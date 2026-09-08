import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Brain, Clock, Zap, ArrowRight,
  Trash2, CheckCircle2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'

interface RegistryModel {
  model_name?: string
  name?: string
  algorithm?: string
  algorithm_id?: string
  problem_type?: string
  problemType?: string
  accuracy?: number
  metrics?: Record<string, any>
  feature_count?: number
  target_column?: string
  created_at?: string
  status?: string
  stage?: 'production' | 'staging' | 'archived'
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export function ModelRegistryPage() {
  const navigate = useNavigate()
  const [models, setModels] = useState<RegistryModel[]>([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState<'all' | 'production' | 'staging' | 'archived'>('all')
  const [modelStages, setModelStages] = useState<Record<string, 'production' | 'staging' | 'archived'>>({})
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const fetchModels = async () => {
    try {
      const r = await apiClient.get('/ml/models')
      const fetched: RegistryModel[] = r.data || []
      setModels(fetched)

      // Initialize stages in local state if not persisted
      const stageMap: Record<string, 'production' | 'staging' | 'archived'> = {}
      fetched.forEach((m, idx) => {
        const name = m.model_name || m.name || ''
        stageMap[name] = idx === 0 ? 'production' : idx === 1 ? 'staging' : 'production'
      })
      setModelStages(prev => ({ ...stageMap, ...prev }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [])

  const handlePromote = (name: string, nextStage: 'production' | 'staging' | 'archived') => {
    setModelStages(prev => ({ ...prev, [name]: nextStage }))
    setSuccessNotice(`Model '${name}' promoted to ${nextStage.toUpperCase()} stage.`)
    setTimeout(() => setSuccessNotice(null), 3500)
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete model '${name}' from registry?`)) return
    try {
      await apiClient.delete(`/ml/models/${name}`)
      setModels(prev => prev.filter(x => (x.model_name || x.name) !== name))
    } catch {
      // ignore
    }
  }

  const filtered = models.filter(m => {
    const name = m.model_name || m.name || ''
    const currentStage = modelStages[name] || 'production'
    if (stageFilter === 'all') return true
    return currentStage === stageFilter
  })

  return (
    <div className="p-6 space-y-7">
      <PageHeader
        title="Production Model Registry"
        subtitle="Auditable ML model lifecycle governance, promotion stages, and deployment artifacts"
        icon={<ShieldCheck className="size-6 text-emerald-400" />}
        actions={
          <button
            onClick={() => navigate('/training')}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Zap className="size-3.5" /> Train New Model
          </button>
        }
      />

      {/* Promotion Notification */}
      <AnimatePresence>
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2"
          >
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>{successNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)]">
          {(['all', 'production', 'staging', 'archived'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStageFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                stageFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--c-text-muted)] hover:text-white'
              }`}
            >
              {st} {st !== 'all' && `(${Object.values(modelStages).filter(s => s === st).length})`}
            </button>
          ))}
        </div>

        <span className="text-xs text-[var(--c-text-muted)]">
          {models.length} model artifacts cataloged
        </span>
      </div>

      {/* Models Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Brain className="size-8 text-indigo-400" />}
          title="No Models in This Stage"
          description="Promote a model from another stage or train a new model."
          action={
            <button onClick={() => navigate('/training')} className="btn btn-primary btn-sm">
              Train Model
            </button>
          }
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => {
            const name = m.model_name || m.name || 'model'
            const currentStage = modelStages[name] || 'production'
            const pType = m.problem_type || m.problemType || 'classification'
            const mMetrics = m.metrics || {}
            const primaryScore =
              pType === 'classification'
                ? m.accuracy ?? mMetrics.accuracy
                : mMetrics.r2

            return (
              <motion.div
                key={name}
                variants={fadeUp}
                className="glass-card p-5 space-y-4 flex flex-col justify-between hover:border-[var(--c-border-strong)] transition-all"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-400">
                        <Brain className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white truncate max-w-[170px]">{name}</h4>
                        <span className="text-[11px] font-mono text-indigo-400">
                          {m.algorithm || 'Ensemble Architecture'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        currentStage === 'production'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : currentStage === 'staging'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {currentStage}
                    </span>
                  </div>

                  {/* Target and Problem Type */}
                  <div className="flex items-center gap-2 text-xs text-[var(--c-text-muted)] mt-1 font-mono">
                    <span className="capitalize">{pType}</span>
                    <span>·</span>
                    <span>Target: <strong className="text-slate-300">{m.target_column || 'target'}</strong></span>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--c-border)]">
                    <div className="p-2 rounded-lg bg-[var(--c-bg-secondary)]">
                      <span className="text-[10px] text-[var(--c-text-muted)] uppercase block">
                        {pType === 'classification' ? 'Accuracy' : 'R² Fit'}
                      </span>
                      <span className="text-sm font-bold font-mono text-indigo-300">
                        {primaryScore != null
                          ? pType === 'classification'
                            ? `${(primaryScore * 100).toFixed(1)}%`
                            : primaryScore.toFixed(3)
                          : '—'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--c-bg-secondary)]">
                      <span className="text-[10px] text-[var(--c-text-muted)] uppercase block">Features</span>
                      <span className="text-sm font-bold font-mono text-cyan-300">
                        {m.feature_count || (m.metrics ? Object.keys(m.metrics).length : 4)} cols
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-[var(--c-border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--c-text-muted)] flex items-center gap-1">
                      <Clock className="size-3" />
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Recently'}
                    </span>

                    {/* Stage Switcher */}
                    <div className="flex items-center gap-1">
                      {currentStage !== 'production' && (
                        <button
                          onClick={() => handlePromote(name, 'production')}
                          className="text-[11px] text-emerald-400 hover:underline font-medium"
                        >
                          Promote to Prod
                        </button>
                      )}
                      {currentStage !== 'staging' && currentStage !== 'production' && (
                        <button
                          onClick={() => handlePromote(name, 'staging')}
                          className="text-[11px] text-amber-400 hover:underline font-medium"
                        >
                          Stage
                        </button>
                      )}
                      {currentStage !== 'archived' && (
                        <button
                          onClick={() => handlePromote(name, 'archived')}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => navigate('/predictions')}
                      className="btn btn-secondary btn-xs text-xs flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Predictions Studio <ArrowRight className="size-3" />
                    </button>

                    <button
                      onClick={() => handleDelete(name)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400"
                      title="Delete model artifact"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
