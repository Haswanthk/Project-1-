import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Trash2, Eye, GitCompare, Sparkles,
  ArrowRight, X, Layers,
  Activity, Zap
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/LoadingSkeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

interface ModelItem {
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
}

export function MLModelsPage() {
  const navigate = useNavigate()
  const [models, setModels] = useState<ModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null)
  const [explanation, setExplanation] = useState<any | null>(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [quickTestInput, setQuickTestInput] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<any | null>(null)
  const [testingInference, setTestingInference] = useState(false)

  const fetchData = async () => {
    try {
      const [m, a] = await Promise.allSettled([
        apiClient.get('/ml/models'),
        apiClient.get('/ml/algorithms')
      ])
      if (m.status === 'fulfilled') setModels(m.value.data || [])
      if (a.status === 'fulfilled') setAlgorithms(a.value.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to permanently delete model '${name}'?`)) return
    try {
      await apiClient.delete(`/ml/models/${name}`)
      setModels(prev => prev.filter(x => (x.model_name || x.name) !== name))
      if ((selectedModel?.model_name || selectedModel?.name) === name) {
        setSelectedModel(null)
      }
    } catch {
      // ignore
    }
  }

  const handleInspect = async (model: ModelItem) => {
    const name = model.model_name || model.name || ''
    setSelectedModel(model)
    setExplanation(null)
    setTestResult(null)
    setQuickTestInput({})
    setLoadingExplanation(true)

    try {
      const [metaRes, expRes] = await Promise.allSettled([
        apiClient.get(`/ml/models/${name}`),
        apiClient.get(`/ml/explain/${name}`)
      ])

      if (metaRes.status === 'fulfilled') {
        setSelectedModel(prev => ({ ...prev, ...metaRes.value.data }))
      }
      if (expRes.status === 'fulfilled') {
        setExplanation(expRes.value.data)
        const feats = Object.keys(expRes.value.data.feature_importances || {})
        const initInputs: Record<string, string> = {}
        feats.forEach(f => { initInputs[f] = '1.0' })
        setQuickTestInput(initInputs)
      }
    } catch {
      // ignore
    } finally {
      setLoadingExplanation(false)
    }
  }

  const handleQuickPredict = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedModel) return
    const modelName = selectedModel.model_name || selectedModel.name || ''
    setTestingInference(true)
    setTestResult(null)

    try {
      const parsed: Record<string, any> = {}
      Object.entries(quickTestInput).forEach(([k, v]) => {
        const num = parseFloat(v)
        parsed[k] = isNaN(num) ? v : num
      })

      const res = await apiClient.post('/ml/predict', {
        model_name: modelName,
        features: parsed,
        input_data: parsed,
      })
      setTestResult(res.data)
    } catch (err: any) {
      setTestResult({ error: err.response?.data?.detail || 'Inference failed.' })
    } finally {
      setTestingInference(false)
    }
  }

  const classificationCount = models.filter(m => (m.problem_type || m.problemType) === 'classification').length
  const regressionCount = models.filter(m => (m.problem_type || m.problemType) === 'regression').length

  return (
    <div className="p-6 space-y-7">
      <PageHeader
        title="Trained Model Catalog & Artifacts"
        subtitle="Version-controlled machine learning model artifacts, feature importances, and live inference inspection"
        icon={<Brain className="size-6 text-indigo-400" />}
        actions={
          <button
            onClick={() => navigate('/training')}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Zap className="size-3.5" /> Train New Model
          </button>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card p-5 border-l-4 border-l-indigo-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Total Trained Artifacts</span>
          <p className="text-2xl font-bold tracking-tight text-white mt-2">{models.length}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Serialized in <code className="text-indigo-400 font-mono">/models</code> directory</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-cyan-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Classification Models</span>
          <p className="text-2xl font-bold tracking-tight text-cyan-300 mt-2">{classificationCount}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Evaluated with Accuracy & F1</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-violet-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Regression Models</span>
          <p className="text-2xl font-bold tracking-tight text-violet-300 mt-2">{regressionCount}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Evaluated with R² & RMSE</p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-[var(--c-text-secondary)]">Supported Frameworks</span>
          <p className="text-2xl font-bold tracking-tight text-emerald-400 mt-2">{algorithms.length || 8}</p>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">Ensemble, Linear, Tree & SVM</p>
        </div>
      </div>

      {/* Models Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Active Deployed Model Artifacts</h3>
          <span className="text-xs text-[var(--c-text-muted)]">Click Inspect to view feature importances & live prediction test</span>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : models.length === 0 ? (
          <EmptyState
            icon={<Brain className="size-8 text-indigo-400" />}
            title="No Trained Models Found"
            description="Go to the Model Training Studio to build and evaluate your first model."
            action={
              <button onClick={() => navigate('/training')} className="btn btn-primary btn-sm">
                Train Model
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--c-border)]">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)] border-b border-[var(--c-border)]">
                <tr>
                  <th className="p-3">Model Name</th>
                  <th className="p-3">Algorithm</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Primary Score</th>
                  <th className="p-3">Target Column</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {models.map(m => {
                  const name = m.model_name || m.name || 'model'
                  const pType = m.problem_type || m.problemType || 'classification'
                  const mMetrics = m.metrics || {}
                  const primaryVal =
                    pType === 'classification'
                      ? m.accuracy ?? mMetrics.accuracy
                      : mMetrics.r2

                  return (
                    <tr key={name} className="hover:bg-[var(--c-bg-secondary)]/40 transition-colors">
                      <td className="p-3 font-semibold font-mono text-white flex items-center gap-2">
                        <Brain className="size-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{name}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-300">
                        {m.algorithm || m.algorithm_id || 'Ensemble'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          pType === 'classification'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                        }`}>
                          {pType}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-sm">
                        {primaryVal != null ? (
                          pType === 'classification' ? (
                            <span className="text-emerald-400">{(primaryVal * 100).toFixed(1)}% Acc</span>
                          ) : (
                            <span className="text-indigo-400">{primaryVal.toFixed(3)} R²</span>
                          )
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {m.target_column || '—'}
                      </td>
                      <td className="p-3">
                        <StatusBadge
                          label={m.status || 'DEPLOYED'}
                          variant={m.status === 'drifting' ? 'warning' : 'success'}
                          dot
                        />
                      </td>
                      <td className="p-3 text-[var(--c-text-muted)]">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Recently'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleInspect(m)}
                            className="btn btn-secondary btn-xs flex items-center gap-1"
                            title="Inspect model explanation & run quick inference"
                          >
                            <Eye className="size-3 text-indigo-400" /> Inspect
                          </button>
                          <button
                            onClick={() => handleDelete(name)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete model artifact"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Available Algorithms Reference */}
      {algorithms.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
            <GitCompare className="size-4 text-indigo-400" /> Supported Algorithm Architectures
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {algorithms.map(a => (
              <div
                key={a.id}
                className="p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]"
              >
                <p className="text-xs font-semibold text-white">{a.name}</p>
                <p className="text-[11px] text-[var(--c-text-muted)] mt-1 line-clamp-2">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODEL INSPECT & TEST MODAL */}
      <AnimatePresence>
        {selectedModel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-indigo-500/30 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-[var(--c-border)] flex items-center justify-between bg-[var(--c-bg-secondary)]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                    <Brain className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {selectedModel.model_name || selectedModel.name}
                    </h3>
                    <p className="text-xs text-[var(--c-text-muted)]">
                      {selectedModel.algorithm || 'Custom Architecture'} · Target: <span className="text-cyan-400 font-mono">{selectedModel.target_column || 'target'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/predictions')}
                    className="btn btn-primary btn-xs text-xs flex items-center gap-1"
                  >
                    Predictions Studio <ArrowRight className="size-3" />
                  </button>
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1">
                {loadingExplanation ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="size-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-[var(--c-text-muted)]">Loading model artifacts and computing feature weights...</p>
                  </div>
                ) : (
                  <>
                    {/* Auto Plain-Text Explanation */}
                    {explanation?.explanation && (
                      <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
                        <Sparkles className="size-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block mb-0.5 text-indigo-300">Automated Model Explanation</span>
                          <p>{explanation.explanation}</p>
                        </div>
                      </div>
                    )}

                    {/* Metrics Breakdown Cards */}
                    {selectedModel.metrics && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Activity className="size-3.5 text-cyan-400" /> Evaluation Metrics
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {Object.entries(selectedModel.metrics)
                            .filter(([, v]) => typeof v === 'number')
                            .map(([k, v]) => (
                              <div key={k} className="p-3 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)]">
                                <span className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider block mb-0.5">
                                  {k.replace(/_/g, ' ')}
                                </span>
                                <span className="font-mono text-sm font-bold text-white">
                                  {['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].includes(k)
                                    ? `${((v as number) * 100).toFixed(1)}%`
                                    : (v as number).toFixed(4)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Feature Importances */}
                    {explanation?.feature_importances && Object.keys(explanation.feature_importances).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Layers className="size-3.5 text-violet-400" /> Feature Weights (Top Predictors)
                        </span>
                        <div className="space-y-2 p-3.5 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)]">
                          {Object.entries(explanation.feature_importances).slice(0, 6).map(([feat, imp]) => {
                            const pct = Math.round((imp as number) * 100)
                            return (
                              <div key={feat} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-mono text-slate-300">{feat}</span>
                                  <span className="font-mono text-indigo-400 font-semibold">{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                                    style={{ width: `${Math.max(pct, 3)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Inline Test Prediction */}
                    <div className="p-4 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Zap className="size-3.5 text-amber-400" /> Quick Live Inference Test
                        </span>
                        <span className="text-[11px] text-[var(--c-text-muted)]">Test with arbitrary feature values</span>
                      </div>

                      <form onSubmit={handleQuickPredict} className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.keys(quickTestInput).slice(0, 8).map(f => (
                            <div key={f}>
                              <label className="text-[10px] text-slate-400 block mb-0.5 truncate font-mono">{f}</label>
                              <input
                                type="text"
                                value={quickTestInput[f] || ''}
                                onChange={e => setQuickTestInput({ ...quickTestInput, [f]: e.target.value })}
                                className="form-input text-xs font-mono py-1"
                                placeholder="0.0"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="submit"
                            disabled={testingInference}
                            className="btn btn-primary btn-xs flex items-center gap-1"
                          >
                            {testingInference ? 'Evaluating...' : 'Run Quick Predict'}
                          </button>

                          {testResult && (
                            <div className="text-xs font-mono">
                              {testResult.error ? (
                                <span className="text-rose-400">{testResult.error}</span>
                              ) : (
                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                  <span>Output:</span>
                                  <strong className="text-white font-bold">
                                    {testResult.predicted_label || testResult.prediction}
                                  </strong>
                                  {testResult.confidence != null && (
                                    <span className="text-emerald-400">
                                      ({(testResult.confidence * 100).toFixed(1)}%)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--c-border)] bg-[var(--c-bg-secondary)] flex justify-end">
                <button
                  onClick={() => setSelectedModel(null)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
