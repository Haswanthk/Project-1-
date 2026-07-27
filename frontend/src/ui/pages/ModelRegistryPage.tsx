import { useEffect, useState } from 'react'
import { ShieldCheck, Download, RefreshCw } from 'lucide-react'


import { GlassCard } from '../components/ui/GlassCard'
import { apiClient } from '../lib/api'

type ModelItem = {
  model_name: string
  model_type: string
  features: string[]
  problem_type: string
  target_column: string
  file_size: number
  created_at: number
}

export function ModelRegistryPage() {
  const [models, setModels] = useState<ModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deployments, setDeployments] = useState<Record<string, 'Staging' | 'Production'>>({})

  const fetchModels = async () => {
    try {
      const res = await apiClient.get('/ml/models')
      setModels(res.data)
      const deps: Record<string, 'Staging' | 'Production'> = {}
      res.data.forEach((m: ModelItem, idx: number) => {
        deps[m.model_name] = idx === 0 ? 'Production' : 'Staging'
      })
      setDeployments(deps)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [])

  const toggleDeployment = (modelName: string) => {
    setDeployments((prev) => ({
      ...prev,
      [modelName]: prev[modelName] === 'Production' ? 'Staging' : 'Production',
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Enterprise Model Registry & Governance</h2>
          <p className="text-sm text-slate-400">MLOps stage management, staging vs production deployment, and version control</p>
        </div>
        <button onClick={fetchModels} className="flex items-center gap-2 rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          <RefreshCw className="size-4" /> Refresh Registry
        </button>
      </div>

      <GlassCard>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading model registry governance metadata...</div>
        ) : models.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No registered models found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Model Name</th>
                  <th className="px-4 py-3">Algorithm</th>
                  <th className="px-4 py-3">Problem Type</th>
                  <th className="px-4 py-3">Features</th>
                  <th className="px-4 py-3">Deployment Stage</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {models.map((m: ModelItem) => (

                  <tr key={m.model_name} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{m.model_name}</td>
                    <td className="px-4 py-3 text-violet-300">{m.model_type}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold">{m.problem_type}</td>
                    <td className="px-4 py-3">{m.features.length} Features</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleDeployment(m.model_name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                          deployments[m.model_name] === 'Production'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <ShieldCheck className="size-3.5" />
                        {deployments[m.model_name]}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => alert(`Downloading artifact ${m.model_name}`)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 hover:bg-slate-700 mr-2"
                      >
                        <Download className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
