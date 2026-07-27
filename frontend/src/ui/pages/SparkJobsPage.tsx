import { useEffect, useState } from 'react'
import { Play, Cpu, CheckCircle2, XCircle, FileText, RefreshCw } from 'lucide-react'


import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

type SparkJob = {
  id: string
  name: string
  master: string
  status: string
  start_time: string
  duration_seconds: number
  executor_memory: string
  logs: string
}

export function SparkJobsPage() {
  const [jobs, setJobs] = useState<SparkJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [master, setMaster] = useState('spark://spark-master:7077')
  const [executorMemory, setExecutorMemory] = useState('2g')
  const [script, setScript] = useState('from pyspark.sql import SparkSession\n\nspark = SparkSession.builder.appName("Sample").getOrCreate()\nprint("Spark job execution completed successfully.")')

  const fetchJobs = async () => {
    try {
      const res = await apiClient.get('/spark/jobs')
      setJobs(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/spark/submit', {
        name,
        master,
        executor_memory: executorMemory,
        script,
      })
      setName('')
      setShowSubmitModal(false)
      fetchJobs()
    } catch (err) {
      console.error(err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'FINISHED':
      case 'SUCCESS':
        return <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full"><CheckCircle2 className="size-3.5" /> Finished</span>
      case 'RUNNING':
        return <span className="flex items-center gap-1 text-xs text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full animate-pulse"><RefreshCw className="size-3.5 animate-spin" /> Running</span>
      default:
        return <span className="flex items-center gap-1 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full"><XCircle className="size-3.5" /> Failed</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Spark Big Data Processing</h2>
          <p className="text-sm text-slate-400">Distributed PySpark batch & streaming job orchestration cluster</p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
        >
          <Play className="size-4 fill-current" /> Submit Spark Job
        </button>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="size-5 text-violet-400" /> Active Spark Cluster Jobs
          </h3>
          <button onClick={fetchJobs} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Fetching cluster job telemetry...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Job Alias</th>
                  <th className="px-4 py-3">Cluster Master</th>
                  <th className="px-4 py-3">Executor RAM</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted At</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job: SparkJob) => (
                  <tr key={job.id} className="hover:bg-white/5">

                    <td className="px-4 py-3 font-mono text-xs text-violet-300">{job.id}</td>
                    <td className="px-4 py-3 font-semibold text-white">{job.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{job.master}</td>
                    <td className="px-4 py-3">{job.executor_memory}</td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(job.start_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLogs(job.logs)}
                        className="flex items-center gap-1 rounded-lg bg-slate-800 border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                      >
                        <FileText className="size-3.5" /> View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">Submit PySpark Job</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Job Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Aggregated_Financial_Pipeline"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-white focus:outline-none focus:border-violet-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Spark Master URL</label>
                  <input
                    type="text"
                    required
                    value={master}
                    onChange={(e) => setMaster(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Executor Memory</label>
                  <select
                    value={executorMemory}
                    onChange={(e) => setExecutorMemory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-white focus:outline-none focus:border-violet-400"
                  >
                    <option value="1g">1 GB</option>
                    <option value="2g">2 GB</option>
                    <option value="4g">4 GB</option>
                    <option value="8g">8 GB</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">PySpark Code / Script</label>
                <textarea
                  rows={6}
                  required
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-white font-mono text-xs focus:outline-none focus:border-violet-400"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Deploy to Cluster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {selectedLogs !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="size-5 text-violet-400" /> Driver Log Execution Output
            </h3>
            <pre className="p-4 rounded-xl bg-slate-900 border border-white/10 text-slate-300 font-mono text-xs max-h-96 overflow-y-auto whitespace-pre-wrap">
              {selectedLogs}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLogs(null)}
                className="rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
