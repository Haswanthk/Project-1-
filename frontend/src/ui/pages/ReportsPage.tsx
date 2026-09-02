import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Plus, Download, Trash2, Clock } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

export function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [datasets, setDatasets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', format: 'pdf', dataset_ids: [] as number[] })

  const fetchAll = async () => {
    const [r, d] = await Promise.allSettled([apiClient.get('/reports/'), apiClient.get('/datasets/')])
    if (r.status === 'fulfilled') setReports(r.value.data)
    if (d.status === 'fulfilled') setDatasets(d.value.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault(); setGenerating(true)
    try { await apiClient.post('/reports/generate', form); setShowForm(false); fetchAll() } catch {}
    setGenerating(false)
  }

  const handleDelete = async (id: number) => { try { await apiClient.delete(`/reports/${id}`); fetchAll() } catch {} }

  const formatIcon = (f: string) => {
    const colors: Record<string, string> = { pdf: 'text-rose-400', docx: 'text-blue-400', excel: 'text-emerald-400', xlsx: 'text-emerald-400', csv: 'text-amber-400', html: 'text-violet-400', json: 'text-cyan-400' }
    return colors[f] || 'text-slate-400'
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Reports" subtitle="Generate, download, and manage analytics reports" icon={<FileText className="size-6" />}
        actions={<button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> Generate Report</button>} />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <form onSubmit={generate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="form-label">Title</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="form-input" placeholder="Monthly Analytics Report" required /></div>
            <div><label className="form-label">Format</label>
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} className="form-select">
                {['pdf', 'docx', 'excel', 'csv', 'html', 'json'].map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className="form-label">Dataset</label>
              <select onChange={e => setForm(f => ({ ...f, dataset_ids: e.target.value ? [+e.target.value] : [] }))} className="form-select">
                <option value="">None (empty report)</option>
                {datasets.map((d: any) => <option key={d.id} value={d.id}>{d.filename || d.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button type="submit" disabled={generating} className="btn btn-primary btn-sm">
                {generating ? <><div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</> : 'Generate'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div> : reports.length === 0 ? (
        <EmptyState icon={<FileText className="size-8" />} title="No reports" description="Generate your first report" action={<button onClick={() => setShowForm(true)} className="btn btn-primary btn-sm"><Plus className="size-3.5" /> Generate</button>} />
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-[var(--c-bg-secondary)]"><FileText className={`size-5 ${formatIcon(r.format)}`} /></div>
                  <div>
                    <p className="text-sm font-semibold">{r.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge label={r.format?.toUpperCase()} variant="accent" />
                      <StatusBadge label={r.status} variant={r.status === 'COMPLETED' ? 'success' : 'info'} dot />
                      <span className="text-xs text-[var(--c-text-muted)] flex items-center gap-1"><Clock className="size-3" />{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {r.download_url && <a href={r.download_url} className="btn btn-secondary btn-sm"><Download className="size-3.5" /> Download</a>}
                  <button onClick={() => handleDelete(r.id)} className="btn btn-ghost btn-sm text-rose-400"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
