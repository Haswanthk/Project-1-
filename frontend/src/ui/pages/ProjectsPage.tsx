import { useEffect, useState } from 'react'
import { FolderPlus, Folder, Calendar, User, Search } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

type Project = {
  id: number
  name: string
  description: string
  owner_id: number
  created_at: string
}


export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [filter, setFilter] = useState('')

  const fetchProjects = async () => {
    try {
      const res = await apiClient.get('/projects/')
      setProjects(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/projects/', { name, description })
      setName('')
      setDescription('')
      setShowModal(false)
      fetchProjects()
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = projects.filter(
    (p) => p.name.toLowerCase().includes(filter.toLowerCase()) || p.description.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Projects</h2>
          <p className="text-sm text-slate-400">Workspace grouping for datasets, models, reports, and streaming pipelines</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
        >
          <FolderPlus className="size-4" /> New Project
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter projects by name or description..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-400"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading enterprise projects...</div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Folder className="mx-auto size-12 text-slate-500 mb-3" />
          <h3 className="text-lg font-semibold text-white">No Projects Found</h3>
          <p className="text-sm text-slate-400 mt-1">Create your first analytics workspace project to get started.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((proj) => (
            <GlassCard key={proj.id} className="hover:border-violet-500/40 transition">
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300">
                  <Folder className="size-6" />
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  Active
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">{proj.name}</h3>
              <p className="mt-1 text-sm text-slate-300 line-clamp-2">
                {proj.description || 'No description provided for this project.'}
              </p>
              <div className="mt-6 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-3">
                <span className="flex items-center gap-1">
                  <User className="size-3.5" /> Owner #{proj.owner_id}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" /> {new Date(proj.created_at).toLocaleDateString()}
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">Create New Project</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Financial Risk Analytics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Description</label>
                <textarea
                  rows={3}
                  placeholder="Scope, dataset requirements, and objectives..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-white focus:outline-none focus:border-violet-400"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
