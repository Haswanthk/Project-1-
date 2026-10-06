import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Zap,
  Sliders,
  Sparkles,
  Gauge,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Activity,
} from 'lucide-react'
import { apiClient } from '../../lib/api'
import { AnimatedCounter } from './AnimatedCounter'

interface ColumnInfo {
  name: string
  dtype?: string
  is_numeric?: boolean
  unique_values?: number
  sample_values?: string[]
}

interface LiveInferencePlaygroundProps {
  modelName: string
  algorithmName: string
  problemType: 'classification' | 'regression'
  features: string[]
  columns: ColumnInfo[]
  initialInputs?: Record<string, string>
}

export function LiveInferencePlayground({
  modelName,
  algorithmName,
  problemType,
  features,
  columns,
  initialInputs = {},
}: LiveInferencePlaygroundProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [autoPredict, setAutoPredict] = useState(true)

  // Determine feature specifications (min, max, step, sample)
  const featureSpecs = useMemo(() => {
    return features.map(featName => {
      const col = columns.find(c => c.name === featName)
      const sampleVal = col?.sample_values?.[0]
      const numSample = sampleVal ? parseFloat(sampleVal) : 1.0

      const isNum = col?.is_numeric ?? !isNaN(numSample)
      const base = !isNaN(numSample) ? numSample : 2.0
      const min = Math.floor(Math.max(0, base * 0.2 * 10)) / 10
      const max = Math.ceil(Math.max(base * 2.5, 10) * 10) / 10
      const step = max > 50 ? 1 : max > 10 ? 0.5 : 0.1

      return {
        name: featName,
        isNumeric: isNum,
        min,
        max,
        step,
        sample: sampleVal || (isNum ? String(base) : 'value'),
      }
    })
  }, [features, columns])

  // Initialize input state
  useEffect(() => {
    const init: Record<string, string> = {}
    featureSpecs.forEach(spec => {
      init[spec.name] = initialInputs[spec.name] || spec.sample
    })
    setInputs(init)
  }, [featureSpecs, initialInputs])

  // Execute inference call
  const executePrediction = useCallback(async (currentInputs: Record<string, string>) => {
    if (!modelName || Object.keys(currentInputs).length === 0) return
    setLoading(true)
    const startTime = performance.now()

    try {
      const parsedFeatures: Record<string, any> = {}
      Object.entries(currentInputs).forEach(([k, v]) => {
        const num = parseFloat(v)
        parsedFeatures[k] = isNaN(num) ? v : num
      })

      const payload = {
        model_name: modelName,
        modelName: modelName,
        features: parsedFeatures,
        input_data: parsedFeatures,
      }

      const res = await apiClient.post('/ml/predict', payload)
      const duration = Math.round(performance.now() - startTime)
      setLatency(duration)
      setResult(res.data)
    } catch (err: any) {
      setResult({ error: err.response?.data?.detail || 'Inference call failed.' })
    } finally {
      setLoading(false)
    }
  }, [modelName])

  // Auto-predict on initial mount or debounced input changes
  useEffect(() => {
    if (!autoPredict || Object.keys(inputs).length === 0) return

    const timer = setTimeout(() => {
      executePrediction(inputs)
    }, 250)

    return () => clearTimeout(timer)
  }, [inputs, autoPredict, executePrediction])

  const handleInputChange = (field: string, val: string) => {
    setInputs(prev => ({ ...prev, [field]: val }))
  }

  // Quick Preset Handlers
  const applyPreset = (type: 'min' | 'mid' | 'max' | 'random') => {
    const updated: Record<string, string> = {}
    featureSpecs.forEach(spec => {
      if (!spec.isNumeric) {
        updated[spec.name] = spec.sample
        return
      }
      if (type === 'min') {
        updated[spec.name] = String(spec.min)
      } else if (type === 'max') {
        updated[spec.name] = String(spec.max)
      } else if (type === 'mid') {
        updated[spec.name] = ((spec.min + spec.max) / 2).toFixed(1)
      } else {
        const rand = spec.min + Math.random() * (spec.max - spec.min)
        updated[spec.name] = rand.toFixed(spec.step < 1 ? 1 : 0)
      }
    })
    setInputs(updated)
  }

  const confidenceScore = result?.confidence != null
    ? Math.round(result.confidence * 100)
    : result?.probability != null
    ? Math.round(result.probability * 100)
    : 95

  return (
    <div className="mt-8 rounded-2xl bg-[var(--c-bg-card)] border border-[var(--c-border-strong)] p-5 sm:p-6 relative overflow-hidden shadow-[var(--shadow-card)]">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--c-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--c-accent-light)] border border-[var(--c-border)] text-[var(--c-accent)] shrink-0">
            <Zap className="size-5" />
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-[var(--c-text-primary)] uppercase tracking-wider flex items-center gap-2">
              Interactive Inference Playground
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                Live Engine
              </span>
            </h4>
            <p className="text-[11px] font-mono text-[var(--c-text-muted)]">
              Model: <span className="text-[var(--c-accent)] font-bold">{algorithmName}</span> ({modelName})
            </p>
          </div>
        </div>

        {/* Presets & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--c-text-muted)] uppercase mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('min')}
            className="px-2 py-1 rounded-lg bg-[var(--c-bg-secondary)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[10px] font-mono text-[var(--c-text-secondary)] transition-all"
          >
            Min Bounds
          </button>
          <button
            type="button"
            onClick={() => applyPreset('mid')}
            className="px-2 py-1 rounded-lg bg-[var(--c-bg-secondary)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[10px] font-mono text-[var(--c-text-secondary)] transition-all"
          >
            Median Profile
          </button>
          <button
            type="button"
            onClick={() => applyPreset('max')}
            className="px-2 py-1 rounded-lg bg-[var(--c-bg-secondary)] hover:bg-[var(--c-bg-hover)] border border-[var(--c-border)] text-[10px] font-mono text-[var(--c-text-secondary)] transition-all"
          >
            Max Bounds
          </button>
          <button
            type="button"
            onClick={() => applyPreset('random')}
            className="px-2 py-1 rounded-lg bg-[var(--c-accent-light)] hover:bg-[var(--c-accent)]/20 border border-[var(--c-accent)]/30 text-[10px] font-mono text-[var(--c-accent)] transition-all font-bold flex items-center gap-1"
          >
            <Sparkles className="size-3" />
            Random Jitter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Feature Sliders */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[var(--c-text-primary)] flex items-center gap-1.5">
              <Sliders className="size-3.5 text-[var(--c-accent)]" />
              Adjust Predictor Variables ({features.length} Features)
            </span>

            <label className="flex items-center gap-2 cursor-pointer font-mono text-[11px] text-[var(--c-text-muted)]">
              <input
                type="checkbox"
                checked={autoPredict}
                onChange={e => setAutoPredict(e.target.checked)}
                className="rounded accent-[var(--c-accent)]"
              />
              Auto-Score on Change
            </label>
          </div>

          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
            {featureSpecs.map(spec => {
              const currentVal = inputs[spec.name] ?? spec.sample
              const numericVal = parseFloat(currentVal)

              return (
                <div
                  key={spec.name}
                  className="p-3 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] space-y-2 hover:border-[var(--c-border-strong)] transition-all"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-[var(--c-text-primary)] truncate max-w-[200px]">
                      {spec.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type={spec.isNumeric ? 'number' : 'text'}
                        step={spec.step}
                        value={currentVal}
                        onChange={e => handleInputChange(spec.name, e.target.value)}
                        className="w-24 px-2 py-0.5 rounded-lg bg-[var(--c-bg-card)] border border-[var(--c-border)] text-right font-mono font-bold text-xs text-[var(--c-accent)] focus:outline-none focus:border-[var(--c-accent)]"
                      />
                    </div>
                  </div>

                  {spec.isNumeric && !isNaN(numericVal) && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[var(--c-text-muted)] w-8 text-left">
                        {spec.min}
                      </span>
                      <input
                        type="range"
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        value={isNaN(numericVal) ? spec.min : numericVal}
                        onChange={e => handleInputChange(spec.name, e.target.value)}
                        className="flex-1 h-1.5 rounded-lg bg-[var(--c-bg-tertiary)] accent-[var(--c-accent)] cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-[var(--c-text-muted)] w-8 text-right">
                        {spec.max}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!autoPredict && (
            <button
              type="button"
              onClick={() => executePrediction(inputs)}
              disabled={loading}
              className="btn btn-neon-solid w-full py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Computing Inference...</span>
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  <span>Execute Prediction Run</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Column: Real-Time Prediction Outcome Gauge */}
        <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border-strong)] relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[var(--c-text-primary)] flex items-center gap-1.5">
                <Gauge className="size-4 text-[var(--c-accent)]" />
                Live Model Output
              </span>

              {latency != null && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Activity className="size-3" />
                  {latency}ms latency
                </span>
              )}
            </div>

            {/* Prediction Display Card */}
            <div className="p-5 rounded-xl bg-[var(--c-bg-card)] border border-[var(--c-border)] text-center relative overflow-hidden">
              <span className="font-mono text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider block mb-1">
                {problemType === 'classification' ? 'Class Prediction' : 'Continuous Estimated Value'}
              </span>

              {loading ? (
                <div className="py-6 flex flex-col items-center gap-2">
                  <div className="size-6 border-2 border-[var(--c-accent)] border-t-transparent rounded-full animate-spin" />
                  <span className="font-mono text-xs text-[var(--c-text-muted)]">Scoring vector...</span>
                </div>
              ) : result?.error ? (
                <div className="py-4 text-xs font-mono text-rose-500 flex items-center justify-center gap-1.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{result.error}</span>
                </div>
              ) : result ? (
                <motion.div
                  key={String(result.predicted_label || result.prediction)}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="py-2"
                >
                  <p className="font-display text-2xl sm:text-3xl font-black text-[var(--c-accent)] tracking-tight">
                    {String(result.predicted_label || result.prediction)}
                  </p>

                  {problemType === 'classification' && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[var(--c-text-muted)]">Confidence:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          <AnimatedCounter value={confidenceScore} decimals={1} suffix="%" />
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden border border-[var(--c-border)]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${confidenceScore}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="py-6 font-mono text-xs text-[var(--c-text-muted)]">
                  Move sliders to view live inference predictions
                </div>
              )}
            </div>

            {/* Model Architecture Quick Facts */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded-lg bg-[var(--c-bg-card)] border border-[var(--c-border)]">
                <span className="text-[var(--c-text-muted)]">Algorithm:</span>
                <span className="font-bold text-[var(--c-text-primary)]">{algorithmName}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[var(--c-bg-card)] border border-[var(--c-border)]">
                <span className="text-[var(--c-text-muted)]">Task Type:</span>
                <span className="font-bold uppercase text-[var(--c-accent)]">{problemType}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[var(--c-bg-card)] border border-[var(--c-border)]">
                <span className="text-[var(--c-text-muted)]">Vector Dimensions:</span>
                <span className="font-bold text-[var(--c-text-primary)]">{features.length} inputs</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--c-border)] flex items-center justify-between text-[11px] font-mono text-[var(--c-text-muted)]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Low-Latency API Active
            </span>
            <button
              type="button"
              onClick={() => applyPreset('mid')}
              className="hover:text-[var(--c-accent)] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset Inputs
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
