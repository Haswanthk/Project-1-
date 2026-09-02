import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Target, Zap } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

export function PredictionsPage() {
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [inputData, setInputData] = useState('')
  const [result, setResult] = useState<any>(null)
  const [predicting, setPredicting] = useState(false)

  useEffect(() => { apiClient.get('/ml/models').then(r => setModels(r.data)).catch(() => {}) }, [])

  const handlePredict = async () => {
    setPredicting(true); setResult(null)
    try {
      const parsed = JSON.parse(inputData)
      const r = await apiClient.post('/ml/predict', { model_name: selectedModel, input_data: parsed })
      setResult(r.data)
    } catch (err: any) { setResult({ error: err.response?.data?.detail || 'Prediction failed. Ensure input is valid JSON.' }) }
    setPredicting(false)
  }

  const handleBatch = async () => {
    setPredicting(true); setResult(null)
    try {
      const parsed = JSON.parse(inputData)
      const r = await apiClient.post('/ml/batch-predict', { model_name: selectedModel, input_data: Array.isArray(parsed) ? parsed : [parsed] })
      setResult(r.data)
    } catch (err: any) { setResult({ error: err.response?.data?.detail || 'Batch prediction failed.' }) }
    setPredicting(false)
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Predictions" subtitle="Run single or batch predictions with trained models" icon={<Target className="size-6" />} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Prediction Input</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div><label className="form-label">Model</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="form-select">
                <option value="">Select model...</option>
                {models.map((m: any) => <option key={m.model_name || m.name} value={m.model_name || m.name}>{m.model_name || m.name}</option>)}
              </select>
            </div>
            <div><label className="form-label">Input Data (JSON)</label>
              <textarea value={inputData} onChange={e => setInputData(e.target.value)} className="form-textarea font-mono text-xs" rows={8} placeholder='{"feature1": 1.5, "feature2": 3.0}' />
            </div>
            <div className="flex gap-2">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handlePredict} disabled={!selectedModel || !inputData || predicting} className="btn btn-primary">
                {predicting ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="size-4" />} Predict
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleBatch} disabled={!selectedModel || !inputData || predicting} className="btn btn-secondary">Batch Predict</motion.button>
            </div>
          </div>
          <div>
            <label className="form-label">Result</label>
            <div className="p-4 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)] min-h-[200px]">
              {result ? result.error ? <p className="text-rose-400 text-sm">{result.error}</p> : (
                <pre className="text-xs text-[var(--c-text-secondary)] whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              ) : <p className="text-sm text-[var(--c-text-muted)]">Results will appear here</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
