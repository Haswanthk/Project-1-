import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Trash2, Eye, GitCompare } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/LoadingSkeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

export function MLModelsPage() {
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    Promise.allSettled([apiClient.get('/ml/models'), apiClient.get('/ml/algorithms')]).then(([m, a]) => {
      if (m.status === 'fulfilled') setModels(m.value.data)
      if (a.status === 'fulfilled') setAlgorithms(a.value.data)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (name: string) => { try { await apiClient.delete(`/ml/models/${name}`); setModels(m => m.filter(x => (x.model_name || x.name) !== name)) } catch {} }
  const handleView = async (name: string) => { try { const r = await apiClient.get(`/ml/models/${name}`); setSelected(r.data) } catch {} }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="ML Models" subtitle="Trained models, algorithms, and model registry" icon={<Brain className="size-6" />} />

      {/* Algorithms */}
      {algorithms.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><GitCompare className="size-4 text-indigo-400" /> Available Algorithms</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {algorithms.map((a: any) => (
              <div key={a.id} className="p-3 rounded-xl bg-[var(--c-bg-body)]/50 border border-[var(--c-border)] hover:border-indigo-500/20 transition-all">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-[11px] text-[var(--c-text-muted)] mt-0.5">{a.type || a.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Models Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Trained Models</h3>
        {loading ? <TableSkeleton /> : models.length === 0 ? (
          <EmptyState icon={<Brain className="size-8" />} title="No trained models" description="Train your first model from the Training page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Model</th><th>Algorithm</th><th>Accuracy</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {models.map((m: any) => (
                  <tr key={m.model_name || m.name}>
                    <td className="font-medium">{m.model_name || m.name}</td>
                    <td className="text-[var(--c-text-secondary)]">{m.algorithm || '—'}</td>
                    <td><span className="font-semibold text-indigo-400">{m.accuracy != null ? `${(m.accuracy * 100).toFixed(1)}%` : m.metrics?.accuracy ? `${(m.metrics.accuracy * 100).toFixed(1)}%` : '—'}</span></td>
                    <td><StatusBadge label={m.status || 'active'} variant={m.status === 'drifting' ? 'warning' : 'success'} dot /></td>
                    <td className="text-xs text-[var(--c-text-muted)]">{m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Recently'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => handleView(m.model_name || m.name)} className="btn btn-ghost btn-sm"><Eye className="size-3.5" /></button>
                        <button onClick={() => handleDelete(m.model_name || m.name)} className="btn btn-ghost btn-sm text-rose-400"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Model Detail */}
      {selected && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Model Details: {selected.model_name || selected.name}</h3>
            <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">Close</button>
          </div>
          <pre className="text-xs text-[var(--c-text-secondary)] bg-[var(--c-bg-body)] p-4 rounded-xl overflow-auto max-h-[300px]">{JSON.stringify(selected, null, 2)}</pre>
        </motion.div>
      )}
    </div>
  )
}
