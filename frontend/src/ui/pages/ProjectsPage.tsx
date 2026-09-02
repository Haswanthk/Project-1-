import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Folder, Plus, Clock } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const fetch = async () => { try { const r = await apiClient.get('/projects/'); setProjects(r.data) } catch {} finally { setLoading(false) } }
  useEffect(() => { fetch() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await apiClient.post('/projects/', form); setShowForm(false); setForm({ name: '', description: '' }); fetch() } catch {}
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Projects" subtitle="Organize your analytics work into projects" icon={<Folder className="size-6" />}
        actions={<button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> New Project</button>} />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" required /></div>
            <div><label className="form-label">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="form-input" /></div>
            <div className="sm:col-span-2 flex gap-2"><button type="submit" className="btn btn-primary btn-sm">Create</button><button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">Cancel</button></div>
          </form>
        </motion.div>
      )}

      {loading ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div> : projects.length === 0 ? (
        <EmptyState icon={<Folder className="size-8" />} title="No projects yet" description="Create your first project" />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => (
            <motion.div key={p.id} variants={fadeUp} className="glass-card p-5 hover:border-indigo-500/20 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10"><Folder className="size-5 text-indigo-400" /></div>
                <div><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-[var(--c-text-muted)]">{p.description || 'No description'}</p></div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--c-text-muted)]"><Clock className="size-3" />{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recently'}</div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
