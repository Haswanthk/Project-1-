import { useState } from 'react'
import { Upload, Database, Globe, Radio, CheckCircle, AlertCircle, HardDrive } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

export function DatasetUploadPage() {
  const [activeTab, setActiveTab] = useState<'file' | 'rest' | 'sql' | 'stream'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // REST state
  const [restName, setRestName] = useState('')
  const [restUrl, setRestUrl] = useState('')

  // SQL state
  const [sqlName, setSqlName] = useState('')
  const [sqlConnection, setSqlConnection] = useState('')
  const [sqlQuery, setSqlQuery] = useState('')

  // Stream state
  const [streamName, setStreamName] = useState('')
  const [streamType, setStreamType] = useState('kafka')
  const [streamEndpoint, setStreamEndpoint] = useState('')

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setStatusMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiClient.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setStatusMessage({ type: 'success', text: `Dataset '${res.data.name}' uploaded & profiled successfully!` })
      setFile(null)
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleRestIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage(null)
    try {
      await apiClient.post('/sources/rest', { name: restName, url: restUrl })
      setStatusMessage({ type: 'success', text: `REST source '${restName}' ingested successfully!` })
      setRestName('')
      setRestUrl('')
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.detail || 'REST Ingest failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleSqlIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage(null)
    try {
      await apiClient.post('/sources/sql', { name: sqlName, connection_url: sqlConnection, query: sqlQuery })
      setStatusMessage({ type: 'success', text: `SQL Query '${sqlName}' executed and ingested!` })
      setSqlName('')
      setSqlConnection('')
      setSqlQuery('')
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.detail || 'SQL Ingest failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleStreamRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatusMessage(null)
    try {
      await apiClient.post('/sources/stream', { name: streamName, source_type: streamType, configuration: { endpoint: streamEndpoint } })
      setStatusMessage({ type: 'success', text: `Stream '${streamName}' registered successfully!` })
      setStreamName('')
      setStreamEndpoint('')
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.detail || 'Stream registration failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dataset Ingestion & Connectors</h2>
          <p className="text-sm text-slate-400">Import structured files, REST endpoints, SQL databases, or stream topics</p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 border ${
            statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle className="size-5" /> : <AlertCircle className="size-5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-3 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'file' ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="size-4" /> File Upload
        </button>
        <button
          onClick={() => setActiveTab('rest')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'rest' ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="size-4" /> REST API
        </button>
        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'sql' ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <Database className="size-4" /> SQL Connector
        </button>
        <button
          onClick={() => setActiveTab('stream')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'stream' ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-400 hover:text-white'
          }`}
        >
          <Radio className="size-4" /> Stream Topic
        </button>
      </div>

      <GlassCard>
        {activeTab === 'file' && (
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="border-2 border-dashed border-white/20 rounded-2xl p-10 text-center hover:border-violet-400 transition cursor-pointer">
              <HardDrive className="mx-auto size-12 text-violet-400 mb-3" />
              <p className="text-lg font-semibold text-white">Drag and drop your file here, or click to browse</p>
              <p className="text-sm text-slate-400 mt-1">Supports CSV, Excel (.xlsx/.xls), JSON datasets</p>
              <input
                type="file"
                accept=".csv, .xlsx, .xls, .json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-4 block mx-auto text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500"
              />
            </div>
            {file && (
              <p className="text-sm text-emerald-400">Selected file: {file.name} ({Math.round(file.size / 1024)} KB)</p>
            )}
            <button
              type="submit"
              disabled={!file || loading}
              className="w-full py-3 rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition"
            >
              {loading ? 'Uploading & Profiling...' : 'Upload & Automatic Profile'}
            </button>
          </form>
        )}

        {activeTab === 'rest' && (
          <form onSubmit={handleRestIngest} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-slate-300">Dataset Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Live Weather REST API"
                value={restName}
                onChange={(e) => setRestName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Endpoint URL (JSON)</label>
              <input
                type="url"
                required
                placeholder="https://api.example.com/data.json"
                value={restUrl}
                onChange={(e) => setRestUrl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-500 transition"
            >
              {loading ? 'Ingesting REST Payload...' : 'Fetch & Ingest REST Endpoint'}
            </button>
          </form>
        )}

        {activeTab === 'sql' && (
          <form onSubmit={handleSqlIngest} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-slate-300">Dataset Alias</label>
              <input
                type="text"
                required
                placeholder="e.g., PostgreSQL Sales Dump"
                value={sqlName}
                onChange={(e) => setSqlName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">SQL Connection URL</label>
              <input
                type="text"
                required
                placeholder="postgresql://user:password@localhost:5432/db"
                value={sqlConnection}
                onChange={(e) => setSqlConnection(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">SQL Query</label>
              <textarea
                required
                rows={3}
                placeholder="SELECT * FROM transactions WHERE status = 'completed'"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-500 transition"
            >
              {loading ? 'Executing Query & Ingesting...' : 'Execute SQL Query & Import'}
            </button>
          </form>
        )}

        {activeTab === 'stream' && (
          <form onSubmit={handleStreamRegister} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-slate-300">Stream Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Telemetry Event Queue"
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Source Type</label>
              <select
                value={streamType}
                onChange={(e) => setStreamType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              >
                <option value="kafka">Kafka Topic</option>
                <option value="iot">IoT Sensor Broker</option>
                <option value="web_logs">Web Socket Log Stream</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Broker Endpoint / Topic</label>
              <input
                type="text"
                required
                placeholder="localhost:9092/telemetry-topic"
                value={streamEndpoint}
                onChange={(e) => setStreamEndpoint(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-500 transition"
            >
              {loading ? 'Registering Stream...' : 'Register Stream Connection'}
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
