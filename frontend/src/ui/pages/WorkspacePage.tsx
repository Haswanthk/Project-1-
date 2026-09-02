import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Table2, Download, Eye, Trash2, Search } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/LoadingSkeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

export function WorkspacePage() {
  const [datasets, setDatasets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<any>(null)

  const fetchDatasets = async () => { try { const r = await apiClient.get('/datasets/'); setDatasets(r.data) } catch {} finally { setLoading(false) } }
  useEffect(() => { fetchDatasets() }, [])

  const handleDelete = async (id: number) => { try { await apiClient.delete(`/datasets/${id}`); fetchDatasets() } catch {} }
  const handlePreview = async (id: number) => { try { const r = await apiClient.get(`/datasets/${id}/preview`); setPreview(r.data) } catch {} }

  const filtered = datasets.filter(d => d.filename?.toLowerCase().includes(search.toLowerCase()) || d.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Data Workspace" subtitle="Manage, preview, and export your datasets" icon={<Table2 className="size-6" />} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--c-text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search datasets..." className="form-input pl-10" />
          </div>
          <span className="text-xs text-[var(--c-text-muted)]">{filtered.length} datasets</span>
        </div>

        {loading ? <TableSkeleton /> : filtered.length === 0 ? (
          <EmptyState icon={<Table2 className="size-8" />} title="No datasets" description="Upload your first dataset to get started" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Rows</th><th>Columns</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.filename || d.name}</td>
                    <td><StatusBadge label={d.rows?.toLocaleString() || '—'} variant="info" /></td>
                    <td>{d.columns || '—'}</td>
                    <td className="text-[var(--c-text-secondary)]">{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}</td>
                    <td className="text-xs text-[var(--c-text-muted)]">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => handlePreview(d.id)} className="btn btn-ghost btn-sm" title="Preview"><Eye className="size-3.5" /></button>
                        <a href={`/api/v1/datasets/${d.id}/download`} className="btn btn-ghost btn-sm" title="Download"><Download className="size-3.5" /></a>
                        <button onClick={() => handleDelete(d.id)} className="btn btn-ghost btn-sm text-rose-400" title="Delete"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Preview Modal */}
      {preview && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Data Preview</h3>
            <button onClick={() => setPreview(null)} className="btn btn-ghost btn-sm">Close</button>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            {preview.columns && preview.rows ? (
              <table className="data-table">
                <thead><tr>{preview.columns.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{preview.rows.map((row: any[], i: number) => <tr key={i}>{row.map((v: any, j: number) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody>
              </table>
            ) : <pre className="text-xs text-[var(--c-text-secondary)] whitespace-pre-wrap">{JSON.stringify(preview, null, 2)}</pre>}
          </div>
        </motion.div>
      )}
    </div>
  )
}
