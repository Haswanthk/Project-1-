import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Brain, Clock } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function ModelRegistryPage() {
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { apiClient.get('/ml/models').then(r => { setModels(r.data); setLoading(false) }).catch(() => setLoading(false)) }, [])

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Model Registry" subtitle="Version-controlled model catalog for production deployment" icon={<ShieldCheck className="size-6" />} />
      {loading ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-xl" />)}</div> : models.length === 0 ? (
        <EmptyState icon={<Brain className="size-8" />} title="Empty Registry" description="Train models to see them here" />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m: any) => (
            <motion.div key={m.model_name || m.name} variants={fadeUp} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/10"><Brain className="size-5 text-violet-400" /></div>
                  <div><p className="text-sm font-semibold">{m.model_name || m.name}</p><p className="text-xs text-[var(--c-text-muted)]">{m.algorithm || 'Custom'}</p></div>
                </div>
                <StatusBadge label={m.status || 'active'} variant={m.status === 'drifting' ? 'warning' : 'success'} dot />
              </div>
              {m.metrics && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {Object.entries(m.metrics).slice(0, 4).map(([k, v]) => (
                    <div key={k} className="px-2 py-1.5 rounded-lg bg-[var(--c-bg-secondary)]">
                      <p className="text-[10px] text-[var(--c-text-muted)] uppercase">{k.replace(/_/g, ' ')}</p>
                      <p className="text-sm font-semibold text-indigo-400">{typeof v === 'number' ? v.toFixed(3) : String(v)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 text-xs text-[var(--c-text-muted)]"><Clock className="size-3" />{m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Recently'}</div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
