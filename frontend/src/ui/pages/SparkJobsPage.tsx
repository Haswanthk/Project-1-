import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Plus, Clock, XCircle } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

export function SparkJobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', script: '', cluster: 'default-cluster' })

  const fetchJobs = async () => { try { const r = await apiClient.get('/spark/jobs'); setJobs(r.data) } catch {} finally { setLoading(false) } }
  useEffect(() => { fetchJobs() }, [])

  const submitJob = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await apiClient.post('/spark/submit', form); setShowForm(false); fetchJobs() } catch {}
  }
  const cancelJob = async (id: string) => { try { await apiClient.delete(`/spark/jobs/${id}`); fetchJobs() } catch {} }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Spark Jobs" subtitle="Submit and monitor Apache Spark batch jobs" icon={<Cpu className="size-6" />}
        actions={<button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> Submit Job</button>} />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <form onSubmit={submitJob} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="form-label">Job Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" required /></div>
            <div><label className="form-label">Script Path</label><input value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))} className="form-input" placeholder="s3://..." required /></div>
            <div><label className="form-label">Cluster</label><input value={form.cluster} onChange={e => setForm(f => ({ ...f, cluster: e.target.value }))} className="form-input" /></div>
            <div className="sm:col-span-3 flex gap-2"><button type="submit" className="btn btn-primary btn-sm">Submit</button><button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">Cancel</button></div>
          </form>
        </motion.div>
      )}

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div> : jobs.length === 0 ? (
        <EmptyState icon={<Cpu className="size-8" />} title="No Spark jobs" description="Submit your first job" />
      ) : (
        <div className="space-y-3">
          {jobs.map((j: any) => (
            <motion.div key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10"><Cpu className="size-5 text-orange-400" /></div>
                  <div>
                    <p className="text-sm font-semibold">{j.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge label={j.status} variant={j.status === 'RUNNING' ? 'info' : j.status === 'COMPLETED' ? 'success' : j.status === 'FAILED' ? 'error' : 'neutral'} dot />
                      <span className="text-xs text-[var(--c-text-muted)] flex items-center gap-1"><Clock className="size-3" />{j.duration || j.submitted_at || 'Recently'}</span>
                    </div>
                  </div>
                </div>
                {j.status === 'RUNNING' && <button onClick={() => cancelJob(j.id)} className="btn btn-danger btn-sm"><XCircle className="size-3.5" /> Cancel</button>}
              </div>
              {j.progress != null && (
                <div className="mt-3"><div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 progress-bar-fill" style={{ width: `${j.progress}%` }} /></div></div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
