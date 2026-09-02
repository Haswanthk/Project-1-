import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Target, Zap, CheckCircle, Info } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

export function PredictionsPage() {
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [inputData, setInputData] = useState('')
  const [result, setResult] = useState<any>(null)
  const [predicting, setPredicting] = useState(false)
  const [modelFeatures, setModelFeatures] = useState<string[]>([])

  useEffect(() => {
    apiClient.get('/ml/models').then(r => {
      setModels(r.data)
      if (r.data && r.data.length > 0) {
        const first = r.data[0].model_name || r.data[0].name
        loadModelDetails(first)
      }
    }).catch(() => {})
  }, [])

  const loadModelDetails = async (modelName: string) => {
    setSelectedModel(modelName)
    setResult(null)
    if (!modelName) return

    try {
      const res = await apiClient.get(`/ml/explain/${modelName}`)
      const feats = Object.keys(res.data.feature_importances || {})
      setModelFeatures(feats)

      // Prefill realistic JSON sample with the model's actual features
      const sampleObj: Record<string, number> = {}
      feats.forEach(f => {
        sampleObj[f] = 1.0
      })
      setInputData(JSON.stringify(sampleObj, null, 2))
    } catch {
      setInputData('{\n  "feature1": 1.0,\n  "feature2": 2.5\n}')
    }
  }

  const handlePredict = async () => {
    if (!selectedModel || !inputData) return
    setPredicting(true)
    setResult(null)
    try {
      const parsed = JSON.parse(inputData)
      const r = await apiClient.post('/ml/predict', {
        model_name: selectedModel,
        features: parsed,
        input_data: parsed,
      })
      setResult(r.data)
    } catch (err: any) {
      setResult({
        error: err.response?.data?.detail || 'Prediction failed. Ensure input is valid JSON with model features.',
      })
    }
    setPredicting(false)
  }

  const handleBatch = async () => {
    if (!selectedModel || !inputData) return
    setPredicting(true)
    setResult(null)
    try {
      const parsed = JSON.parse(inputData)
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      const r = await apiClient.post('/ml/batch-predict', {
        model_name: selectedModel,
        rows,
        input_data: rows,
      })
      setResult(r.data)
    } catch (err: any) {
      setResult({ error: err.response?.data?.detail || 'Batch prediction failed.' })
    }
    setPredicting(false)
  }

  return (
    <div className="p-6 space-y-7">
      <PageHeader
        title="Predictions"
        subtitle="Run single or batch predictions with trained models"
        icon={<Target className="size-6" />}
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Model Inference & Prediction</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="form-label">Active Model</label>
              <select
                value={selectedModel}
                onChange={e => loadModelDetails(e.target.value)}
                className="form-select font-medium text-indigo-300"
              >
                <option value="">Select model...</option>
                {models.map((m: any) => (
                  <option key={m.model_name || m.name} value={m.model_name || m.name}>
                    {m.model_name || m.name} ({m.problem_type || 'model'})
                  </option>
                ))}
              </select>
            </div>

            {modelFeatures.length > 0 && (
              <div className="p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15 text-xs text-slate-300">
                <span className="font-semibold text-indigo-400 block mb-1 flex items-center gap-1.5">
                  <Info className="size-3.5" /> Required Features ({modelFeatures.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {modelFeatures.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded-md bg-[var(--c-bg-secondary)] border border-[var(--c-border)] font-mono text-[11px]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Input Data (JSON)</label>
              <textarea
                value={inputData}
                onChange={e => setInputData(e.target.value)}
                className="form-textarea font-mono text-xs"
                rows={9}
                placeholder='{"feature1": 1.5, "feature2": 3.0}'
              />
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePredict}
                disabled={!selectedModel || !inputData || predicting}
                className="btn btn-primary"
              >
                {predicting ? (
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}{' '}
                Run Prediction
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBatch}
                disabled={!selectedModel || !inputData || predicting}
                className="btn btn-secondary"
              >
                Batch Predict
              </motion.button>
            </div>
          </div>

          <div>
            <label className="form-label">Inference Result</label>
            <div className="p-5 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)] min-h-[250px] flex flex-col justify-center">
              {result ? (
                result.error ? (
                  <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-xs">
                    {result.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="size-6 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs text-emerald-300 font-medium">Prediction Output</p>
                        <p className="text-xl font-bold text-white">
                          {result.predicted_label || result.prediction}
                        </p>
                      </div>
                    </div>

                    {result.probabilities && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--c-text-muted)] uppercase mb-2">Class Probabilities</p>
                        <div className="space-y-1.5">
                          {Object.entries(result.probabilities).map(([cls, prob]) => (
                            <div key={cls} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Class {cls}</span>
                                <span className="text-indigo-400 font-semibold">{((prob as number) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(prob as number) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="text-xs text-[var(--c-text-muted)]">
                      <summary className="cursor-pointer hover:text-white">Raw JSON Response</summary>
                      <pre className="mt-2 p-3 rounded-lg bg-black/40 text-[11px] font-mono overflow-x-auto">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </details>
                  </div>
                )
              ) : (
                <div className="text-center py-10 text-[var(--c-text-muted)] text-sm">
                  Select a model, enter JSON features, and click Run Prediction.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
