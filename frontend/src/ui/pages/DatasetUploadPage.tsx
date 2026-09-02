import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, AlertCircle, CheckCircle, X, CloudUpload } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

export function DatasetUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setError(null); setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiClient.post('/datasets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
    }
    setUploading(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Dataset Upload" subtitle="Upload CSV, Excel, or JSON datasets for analysis" icon={<Upload className="size-6" />} />

      {/* Drop Zone */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <div
          onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            dragActive ? 'border-indigo-400 bg-indigo-500/8 scale-[1.01]' : 'border-[var(--c-border-strong)] hover:border-indigo-400/50 hover:bg-[var(--c-bg-hover)]'
          }`}
        >
          <input id="file-input" type="file" className="hidden" accept=".csv,.xlsx,.xls,.json"
            onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
          />
          <motion.div animate={dragActive ? { scale: 1.1, y: -8 } : { scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300 }}>
            <CloudUpload className={`size-12 mx-auto mb-4 ${dragActive ? 'text-indigo-400' : 'text-[var(--c-text-muted)]'}`} />
          </motion.div>
          <p className="text-lg font-semibold mb-1">Drop your dataset here</p>
          <p className="text-sm text-[var(--c-text-secondary)]">or click to browse · CSV, Excel, JSON</p>
        </div>

        {/* Selected file */}
        {file && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center justify-between p-4 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-indigo-400" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-[var(--c-text-muted)]">{formatSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setFile(null); setResult(null) }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition"><X className="size-4" /></button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleUpload} disabled={uploading} className="btn btn-primary btn-sm">
                {uploading ? <><div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</> : <><Upload className="size-3.5" /> Upload</>}
              </motion.button>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-rose-500/8 border border-rose-500/15 text-rose-400 text-sm">
            <AlertCircle className="size-5 shrink-0" /> {error}
          </motion.div>
        )}
      </motion.div>

      {/* Upload Result */}
      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400"><CheckCircle className="size-6" /></div>
            <div>
              <h3 className="text-lg font-semibold">Upload Successful</h3>
              <p className="text-sm text-[var(--c-text-secondary)]">Dataset processed and ready for analysis</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Dataset ID', value: result.id },
              { label: 'File Name', value: result.name || result.filename },
              { label: 'Total Rows', value: (result.row_count ?? result.rows)?.toLocaleString() },
              { label: 'Columns', value: result.column_count ?? result.columns },
              { label: 'File Size', value: formatSize(result.file_size_bytes ?? result.file_size ?? 0) },
              { label: 'Duplicates', value: (result.duplicate_rows ?? 0).toLocaleString() },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
                <p className="text-xs text-[var(--c-text-muted)] mb-1">{item.label}</p>
                <p className="text-sm font-semibold truncate" title={String(item.value ?? '')}>{item.value ?? '—'}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
