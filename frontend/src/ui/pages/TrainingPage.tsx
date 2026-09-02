import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Cpu, Settings2, Zap, CheckSquare, Square, ArrowRight, CheckCircle, Database } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

interface ColumnInfo {
  name: string
  dtype?: string
  is_numeric?: boolean
  unique_values?: number
  sample_values?: string[]
}

export function TrainingPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<any[]>([])
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [datasetMeta, setDatasetMeta] = useState<{ row_count?: number; column_count?: number } | null>(null)

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [targetColumn, setTargetColumn] = useState<string>('')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [problemType, setProblemType] = useState<'classification' | 'regression'>('classification')
  const [algorithm, setAlgorithm] = useState<string>('random_forest')
  const [modelName, setModelName] = useState<string>('')
  const [testSize, setTestSize] = useState<string>('0.2')

  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Load datasets and algorithms on mount
  useEffect(() => {
    Promise.allSettled([apiClient.get('/datasets/'), apiClient.get('/ml/algorithms')]).then(([d, a]) => {
      if (d.status === 'fulfilled') setDatasets(d.value.data)
      if (a.status === 'fulfilled') setAlgorithms(a.value.data)
    })
  }, [])

  // When dataset changes, fetch its columns dynamically
  const handleDatasetChange = async (datasetId: string) => {
    setSelectedDatasetId(datasetId)
    setTargetColumn('')
    setSelectedFeatures([])
    setColumns([])
    setDatasetMeta(null)
    setResult(null)

    if (!datasetId) return

    setLoadingCols(true)
    try {
      // Fetch column information
      const res = await apiClient.get(`/datasets/${datasetId}/columns`)
      const fetchedCols: ColumnInfo[] = res.data.columns || []
      const colNames: string[] = res.data.column_names || fetchedCols.map(c => c.name)

      setColumns(fetchedCols.length > 0 ? fetchedCols : colNames.map(n => ({ name: n })))
      setDatasetMeta({
        row_count: res.data.row_count,
        column_count: res.data.column_count || colNames.length,
      })

      // Smart default target column: prefer column named 'target', 'label', 'class', 'species', 'churn' or last column
      if (colNames.length > 0) {
        const lowerCols = colNames.map(c => c.toLowerCase())
        const targetIdx = lowerCols.findIndex(c => ['species', 'target', 'label', 'class', 'churn', 'price', 'outcome'].includes(c))
        const defaultTarget = targetIdx >= 0 ? colNames[targetIdx] : colNames[colNames.length - 1]
        setTargetColumn(defaultTarget)

        // Features default to all other columns
        const defaultFeatures = colNames.filter(c => c !== defaultTarget)
        setSelectedFeatures(defaultFeatures)

        // Infer problem type from the target column info
        const targetInfo = fetchedCols.find(c => c.name === defaultTarget)
        if (targetInfo) {
          if (!targetInfo.is_numeric || (targetInfo.unique_values !== undefined && targetInfo.unique_values <= 10)) {
            setProblemType('classification')
          } else {
            setProblemType('regression')
          }
        }

        // Auto-generate a clean model name
        const dsObj = datasets.find(d => String(d.id) === datasetId)
        const dsName = (dsObj?.name || dsObj?.filename || `ds${datasetId}`).replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
        setModelName(`${algorithm}_${dsName}`)
      }
    } catch {
      // Fallback: try preview
      try {
        const prevRes = await apiClient.get(`/datasets/${datasetId}/preview`)
        const cols: string[] = prevRes.data.columns || prevRes.data.headers || []
        setColumns(cols.map(c => ({ name: c })))
        if (cols.length > 0) {
          const defaultTarget = cols[cols.length - 1]
          setTargetColumn(defaultTarget)
          setSelectedFeatures(cols.filter(c => c !== defaultTarget))
        }
      } catch {}
    } finally {
      setLoadingCols(false)
    }
  }

  // When target column changes, adjust problem type and features
  const handleTargetChange = (newTarget: string) => {
    setTargetColumn(newTarget)
    // Remove new target from selected features
    setSelectedFeatures(prev => prev.filter(f => f !== newTarget))

    // Auto-detect problem type
    const col = columns.find(c => c.name === newTarget)
    if (col) {
      if (!col.is_numeric || (col.unique_values !== undefined && col.unique_values <= 10)) {
        setProblemType('classification')
      } else {
        setProblemType('regression')
      }
    }
  }

  // Toggle feature selection
  const toggleFeature = (colName: string) => {
    if (colName === targetColumn) return
    setSelectedFeatures(prev =>
      prev.includes(colName) ? prev.filter(f => f !== colName) : [...prev, colName]
    )
  }

  const selectAllFeatures = () => {
    setSelectedFeatures(columns.map(c => c.name).filter(c => c !== targetColumn))
  }

  const clearAllFeatures = () => {
    setSelectedFeatures([])
  }

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDatasetId || !targetColumn) return
    if (selectedFeatures.length === 0) {
      setResult({ error: 'Please select at least one feature column for training.' })
      return
    }

    setTraining(true)
    setResult(null)

    try {
      const payload = {
        dataset_id: +selectedDatasetId,
        model_name: modelName || `${algorithm}_model`,
        algorithm_id: algorithm,
        problem_type: problemType,
        target_column: targetColumn,
        feature_columns: selectedFeatures,
        test_size: +testSize,
      }

      const res = await apiClient.post('/ml/train', payload)
      setResult(res.data)
    } catch (err: any) {
      setResult({ error: err.response?.data?.detail || 'Training failed. Please check parameters.' })
    } finally {
      setTraining(false)
    }
  }

  const availableFeatures = columns.filter(c => c.name !== targetColumn)

  return (
    <div className="p-6 space-y-7">
      <PageHeader
        title="Model Training"
        subtitle="Select dataset, target column, features, and train machine learning models"
        icon={<Play className="size-6" />}
      />

      {/* Algorithm Selection */}
      {algorithms.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-2.5 block">
            Select Algorithm
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {algorithms.map((a: any) => (
              <motion.button
                key={a.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setAlgorithm(a.id)
                  if (modelName) {
                    const dsObj = datasets.find(d => String(d.id) === selectedDatasetId)
                    const dsName = (dsObj?.name || dsObj?.filename || 'model').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
                    setModelName(`${a.id}_${dsName}`)
                  }
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  algorithm === a.id
                    ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                    : 'border-[var(--c-border)] hover:border-[var(--c-border-strong)] bg-[var(--c-bg-card)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className={`size-4 ${algorithm === a.id ? 'text-indigo-400' : 'text-[var(--c-text-muted)]'}`} />
                  <span className="text-sm font-semibold">{a.name}</span>
                </div>
                <p className="text-[11px] text-[var(--c-text-muted)] truncate">{a.type || a.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Training Configuration Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
          <Settings2 className="size-4 text-indigo-400" /> Training Configuration
        </h3>

        <form onSubmit={handleTrain} className="space-y-6">
          {/* Top Row: Dataset, Target, Problem Type, Test Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Dataset Selector */}
            <div>
              <label className="form-label">
                Dataset <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedDatasetId}
                onChange={e => handleDatasetChange(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Select dataset...</option>
                {datasets.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.filename} ({(d.row_count ?? d.rows)?.toLocaleString() || '?'} rows)
                  </option>
                ))}
              </select>
              {datasetMeta && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Database className="size-3" />
                  {datasetMeta.row_count?.toLocaleString()} rows × {datasetMeta.column_count} columns detected
                </p>
              )}
            </div>

            {/* 2. Target Column Dropdown */}
            <div>
              <label className="form-label">
                Target Column (Prediction Goal) <span className="text-rose-400">*</span>
              </label>
              {loadingCols ? (
                <div className="p-2.5 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-xs text-[var(--c-text-muted)] flex items-center gap-2">
                  <div className="size-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Extracting columns...
                </div>
              ) : (
                <select
                  value={targetColumn}
                  onChange={e => handleTargetChange(e.target.value)}
                  className="form-select font-medium text-indigo-300"
                  disabled={!selectedDatasetId || columns.length === 0}
                  required
                >
                  <option value="">Select target column...</option>
                  {columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} {c.dtype ? `(${c.dtype}${c.unique_values ? `, ${c.unique_values} uniques` : ''})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 3. Problem Type Toggle */}
            <div>
              <label className="form-label">Problem Type</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--c-bg-body)] border border-[var(--c-border)]">
                <button
                  type="button"
                  onClick={() => setProblemType('classification')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    problemType === 'classification'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-[var(--c-text-muted)] hover:text-white'
                  }`}
                >
                  Classification
                </button>
                <button
                  type="button"
                  onClick={() => setProblemType('regression')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    problemType === 'regression'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-[var(--c-text-muted)] hover:text-white'
                  }`}
                >
                  Regression
                </button>
              </div>
            </div>

            {/* 4. Test Split & Model Name */}
            <div>
              <label className="form-label">Test Split Ratio</label>
              <select
                value={testSize}
                onChange={e => setTestSize(e.target.value)}
                className="form-select"
              >
                <option value="0.1">10% Test / 90% Train</option>
                <option value="0.2">20% Test / 80% Train (Recommended)</option>
                <option value="0.25">25% Test / 75% Train</option>
                <option value="0.3">30% Test / 70% Train</option>
              </select>
            </div>
          </div>

          {/* Model Name Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Model Name</label>
              <input
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                className="form-input font-mono text-xs"
                placeholder="e.g. rf_classifier_iris"
                required
              />
            </div>
          </div>

          {/* Feature Selection Section */}
          {selectedDatasetId && availableFeatures.length > 0 && (
            <div className="pt-2 border-t border-[var(--c-border)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="form-label mb-0">Feature Columns (Inputs to Model)</label>
                  <p className="text-xs text-[var(--c-text-muted)]">
                    {selectedFeatures.length} of {availableFeatures.length} features selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllFeatures}
                    className="btn btn-ghost btn-xs text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllFeatures}
                    className="btn btn-ghost btn-xs text-xs text-[var(--c-text-muted)] hover:text-white"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto p-1">
                {availableFeatures.map(col => {
                  const isSelected = selectedFeatures.includes(col.name)
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => toggleFeature(col.name)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500/40 bg-indigo-500/10 text-white'
                          : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)]/50 text-[var(--c-text-muted)] hover:border-[var(--c-border-strong)]'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-indigo-400 shrink-0" />
                      ) : (
                        <Square className="size-4 text-[var(--c-text-muted)] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{col.name}</p>
                        {col.dtype && (
                          <span className="text-[10px] text-[var(--c-text-muted)]">
                            {col.is_numeric ? 'numeric' : col.dtype}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <motion.button
              type="submit"
              disabled={training || !selectedDatasetId || !targetColumn || selectedFeatures.length === 0}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="btn btn-primary px-8 py-3 text-sm font-semibold w-full sm:w-auto"
            >
              {training ? (
                <>
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Training {algorithm.replace(/_/g, ' ')} model...
                </>
              ) : (
                <>
                  <Zap className="size-4" /> Start Model Training
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* Results Card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-6 space-y-6"
          >
            {result.error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
                <span className="font-semibold">Training Error:</span> {result.error}
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--c-border)]">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                      <CheckCircle className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Model Trained Successfully!</h3>
                      <p className="text-xs text-[var(--c-text-secondary)]">
                        Artifact saved as <code className="text-indigo-300">{result.model_name || result.modelName}</code>
                        {' · '}Target: <strong className="text-white">{result.target_column}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/predictions')}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    Test in Predictions <ArrowRight className="size-3.5" />
                  </button>
                </div>

                {/* Metrics Grid */}
                {result.metrics && Object.keys(result.metrics).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-3">
                      Performance Evaluation Metrics
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {Object.entries(result.metrics)
                        .filter(([_, v]) => typeof v === 'number' || typeof v === 'string')
                        .map(([k, v]) => (
                          <div key={k} className="p-3.5 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
                            <p className="text-[10px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-1">
                              {k.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xl font-extrabold text-indigo-400">
                              {typeof v === 'number' ? (k === 'accuracy' || k === 'precision' || k === 'recall' || k === 'f1' ? `${(v * 100).toFixed(1)}%` : v.toFixed(4)) : String(v)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Feature Importance Bar Chart */}
                {result.feature_importance && Object.keys(result.feature_importance).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wider mb-3">
                      Top Feature Importances
                    </h4>
                    <div className="space-y-2.5">
                      {Object.entries(result.feature_importance)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 8)
                        .map(([feat, imp]) => {
                          const pct = Math.round((imp as number) * 100)
                          return (
                            <div key={feat} className="space-y-1">
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-slate-200">{feat}</span>
                                <span className="text-indigo-400 font-semibold">{pct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 progress-bar-fill"
                                  style={{ width: `${Math.max(pct, 4)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
