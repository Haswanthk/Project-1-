import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Cpu, Settings2, Zap } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

export function TrainingPage() {
  const [datasets, setDatasets] = useState<any[]>([])
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [form, setForm] = useState({ dataset_id: '', model_name: '', algorithm: 'random_forest', target_column: '', features: '', test_size: '0.2' })

  useEffect(() => {
    Promise.allSettled([apiClient.get('/datasets/'), apiClient.get('/ml/algorithms')]).then(([d, a]) => {
      if (d.status === 'fulfilled') setDatasets(d.value.data)
      if (a.status === 'fulfilled') setAlgorithms(a.value.data)
    })
  }, [])

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault(); setTraining(true); setResult(null)
    try {
      const payload: any = { dataset_id: +form.dataset_id, model_name: form.model_name, algorithm: form.algorithm, target_column: form.target_column, test_size: +form.test_size }
      if (form.features.trim()) payload.features = form.features.split(',').map((f: string) => f.trim())
      const r = await apiClient.post('/ml/train', payload)
      setResult(r.data)
    } catch (err: any) { setResult({ error: err.response?.data?.detail || 'Training failed' }) }
    setTraining(false)
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Model Training" subtitle="Train machine learning models with hyperparameter tuning" icon={<Play className="size-6" />} />

      {/* Algorithm Cards */}
      {algorithms.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {algorithms.map((a: any) => (
            <motion.button key={a.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setForm(f => ({ ...f, algorithm: a.id }))}
              className={`p-4 rounded-xl border text-left transition-all ${form.algorithm === a.id ? 'border-indigo-500/30 bg-indigo-500/8' : 'border-[var(--c-border)] hover:border-[var(--c-border-strong)]'}`}>
              <div className="flex items-center gap-2 mb-1"><Cpu className="size-4 text-indigo-400" /><span className="text-sm font-semibold">{a.name}</span></div>
              <p className="text-[11px] text-[var(--c-text-muted)]">{a.type || a.description}</p>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Training Form */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Settings2 className="size-4 text-indigo-400" /> Training Configuration</h3>
        <form onSubmit={handleTrain} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="form-label">Dataset</label>
            <select value={form.dataset_id} onChange={e => setForm(f => ({ ...f, dataset_id: e.target.value }))} className="form-select" required>
              <option value="">Select dataset...</option>
              {datasets.map((d: any) => <option key={d.id} value={d.id}>{d.filename || d.name}</option>)}
            </select>
          </div>
          <div><label className="form-label">Model Name</label><input value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} className="form-input" placeholder="my_model" required /></div>
          <div><label className="form-label">Target Column</label><input value={form.target_column} onChange={e => setForm(f => ({ ...f, target_column: e.target.value }))} className="form-input" placeholder="target" required /></div>
          <div><label className="form-label">Features (comma-separated, optional)</label><input value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} className="form-input" placeholder="col1, col2, col3" /></div>
          <div><label className="form-label">Test Size</label><input type="number" step="0.05" min="0.1" max="0.5" value={form.test_size} onChange={e => setForm(f => ({ ...f, test_size: e.target.value }))} className="form-input" /></div>
          <div className="flex items-end">
            <motion.button type="submit" disabled={training} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn btn-primary w-full">
              {training ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Training...</> : <><Zap className="size-4" /> Start Training</>}
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6">
          {result.error ? (
            <div className="flex items-center gap-3 text-rose-400"><span className="text-sm">{result.error}</span></div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400"><Zap className="size-6" /></div>
                <div><h3 className="text-lg font-semibold">Training Complete</h3><p className="text-sm text-[var(--c-text-secondary)]">Model: {result.model_name}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {result.metrics && Object.entries(result.metrics).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
                    <p className="text-xs text-[var(--c-text-muted)] uppercase tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                    <p className="text-lg font-bold text-indigo-400">{typeof v === 'number' ? v.toFixed(4) : String(v)}</p>
                  </div>
                ))}
              </div>
              {result.feature_importance && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold mb-3">Feature Importance</h4>
                  <div className="space-y-2">
                    {Object.entries(result.feature_importance).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10).map(([feat, imp]) => (
                      <div key={feat} className="space-y-1">
                        <div className="flex justify-between text-sm"><span>{feat}</span><span className="font-semibold">{((imp as number) * 100).toFixed(1)}%</span></div>
                        <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 progress-bar-fill" style={{ width: `${(imp as number) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
