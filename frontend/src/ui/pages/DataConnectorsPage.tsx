import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PlugZap, Plus, TestTube2, Eye, Database, Globe, Server } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export function DataConnectorsPage() {
  const [connectors, setConnectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'postgresql', connection_string: '' })
  const [testing, setTesting] = useState<string | null>(null)

  const fetchConnectors = async () => { try { const r = await apiClient.get('/connectors/'); setConnectors(r.data) } catch {} finally { setLoading(false) } }
  useEffect(() => { fetchConnectors() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await apiClient.post('/connectors/', form); setShowForm(false); setForm({ name: '', type: 'postgresql', connection_string: '' }); fetchConnectors() } catch {}
  }

  const handleTest = async (id: number) => { setTesting(String(id)); try { await apiClient.get(`/connectors/${id}/test`) } catch {} setTesting(null) }

  const typeIcon = (t: string) => {
    if (t.includes('postgres') || t.includes('mysql') || t.includes('sql')) return <Database className="size-5 text-blue-400" />
    if (t.includes('api') || t.includes('rest')) return <Globe className="size-5 text-emerald-400" />
    return <Server className="size-5 text-violet-400" />
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Data Connectors" subtitle="Connect to databases, APIs, and data sources" icon={<PlugZap className="size-6" />}
        actions={<button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> New Connector</button>}
      />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Create Connector</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="form-label">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="My Database" required /></div>
            <div><label className="form-label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="form-select">
                <option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="mongodb">MongoDB</option><option value="rest_api">REST API</option><option value="s3">S3 Bucket</option>
              </select>
            </div>
            <div><label className="form-label">Connection String</label><input value={form.connection_string} onChange={e => setForm(f => ({ ...f, connection_string: e.target.value }))} className="form-input" placeholder="postgresql://..." required /></div>
            <div className="sm:col-span-3 flex gap-2"><button type="submit" className="btn btn-primary btn-sm">Create</button><button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">Cancel</button></div>
          </form>
        </motion.div>
      )}

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div> : connectors.length === 0 ? (
        <EmptyState icon={<PlugZap className="size-8" />} title="No connectors" description="Create your first data connector" action={<button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> Create Connector</button>} />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((c: any) => (
            <motion.div key={c.id} variants={fadeUp} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">{typeIcon(c.type)}<div><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-[var(--c-text-muted)]">{c.type}</p></div></div>
                <StatusBadge label={c.status || 'connected'} variant={c.status === 'error' ? 'error' : 'success'} dot />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleTest(c.id)} disabled={testing === String(c.id)} className="btn btn-secondary btn-sm">
                  {testing === String(c.id) ? <div className="size-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <TestTube2 className="size-3" />} Test
                </button>
                <button className="btn btn-ghost btn-sm"><Eye className="size-3" /> Preview</button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
