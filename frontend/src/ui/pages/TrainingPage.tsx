import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  Play, Cpu, Zap, CheckSquare, Square, ArrowRight,
  CheckCircle, GitCompare, BarChart3, Sliders, Layers, Sparkles,
  RefreshCw, Eye, EyeOff, Search, ShieldCheck
} from 'lucide-react'
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

interface AlgorithmMeta {
  id: string
  name: string
  problem_types: string[]
  description: string
  badge?: string
  speed?: string
}

const ALGORITHM_DETAILS: Record<string, { badge: string; speed: string; highlight: string; recommended?: boolean }> = {
  random_forest: { badge: 'Top Accuracy', speed: 'Moderate', highlight: 'Ensemble of decision trees. Robust against noise and overfitting.', recommended: true },
  gradient_boosting: { badge: 'High Precision', speed: 'Moderate', highlight: 'Sequential error correction. Top tabular performance on complex datasets.', recommended: true },
  xgboost: { badge: 'Production Standard', speed: 'Fast', highlight: 'Optimized gradient boosted trees with deep regularization.', recommended: true },
  logistic_regression: { badge: 'Fast Linear', speed: 'Ultra Fast', highlight: 'Fast baseline classification with probabilistic boundaries.' },
  linear_regression: { badge: 'Continuous Line', speed: 'Ultra Fast', highlight: 'Ordinary least squares for continuous numeric prediction.' },
  svm: { badge: 'Kernel Margin', speed: 'Slower', highlight: 'High-dimensional hyperplane separator. Excellent for clear margins.' },
  knn: { badge: 'Instance Voting', speed: 'Fast Train', highlight: 'Local neighborhood similarity voting.' },
  decision_tree: { badge: 'Interpretable', speed: 'Ultra Fast', highlight: 'Pure rule-based hierarchical splitting tree.' },
}

export function TrainingPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<any[]>([])
  const [algorithms, setAlgorithms] = useState<AlgorithmMeta[]>([])
  const [loadingCols, setLoadingCols] = useState(false)
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [datasetMeta, setDatasetMeta] = useState<{ row_count?: number; column_count?: number } | null>(null)
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [featureSearch, setFeatureSearch] = useState('')

  // Config State
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single')
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [targetColumn, setTargetColumn] = useState<string>('')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [problemType, setProblemType] = useState<'classification' | 'regression'>('classification')
  const [algorithm, setAlgorithm] = useState<string>('random_forest')
  const [modelName, setModelName] = useState<string>('')
  const [testSize, setTestSize] = useState<string>('0.2')
  const [crossValidation, setCrossValidation] = useState<boolean>(true)
  const [hyperPreset, setHyperPreset] = useState<'standard' | 'accuracy' | 'fast'>('accuracy')

  // Execution State
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [comparing, setComparing] = useState(false)
  const [compareResult, setCompareResult] = useState<any>(null)

  // Live Inline Prediction Tester State
  const [testInputs, setTestInputs] = useState<Record<string, string>>({})
  const [predicting, setPredicting] = useState(false)
  const [predictionResult, setPredictionResult] = useState<any>(null)

  // Load datasets and algorithms on mount
  useEffect(() => {
    Promise.allSettled([apiClient.get('/datasets/'), apiClient.get('/ml/algorithms')]).then(([d, a]) => {
      if (d.status === 'fulfilled') {
        const list = d.value.data || []
        setDatasets(list)
        // Prefer Iris if available for immediate testing
        const iris = list.find((item: any) => item.name?.toLowerCase().includes('iris'))
        if (iris) {
          handleDatasetChange(String(iris.id))
        } else if (list.length > 0) {
          handleDatasetChange(String(list[0].id))
        }
      }
      if (a.status === 'fulfilled') setAlgorithms(a.value.data || [])
    })
  }, [])

  // When dataset changes, fetch its columns dynamically
  const handleDatasetChange = async (datasetId: string) => {
    setSelectedDatasetId(datasetId)
    setTargetColumn('')
    setSelectedFeatures([])
    setColumns([])
    setDatasetMeta(null)
    setPreviewRows([])
    setResult(null)
    setCompareResult(null)
    setPredictionResult(null)

    if (!datasetId) return

    setLoadingCols(true)
    try {
      const res = await apiClient.get(`/datasets/${datasetId}/columns`)
      const fetchedCols: ColumnInfo[] = res.data.columns || []
      const colNames: string[] = res.data.column_names || fetchedCols.map(c => c.name)

      // Cleaned column list
      const cleanCols: ColumnInfo[] = fetchedCols.length > 0
        ? fetchedCols.map(c => ({ ...c, name: c.name.trim() }))
        : colNames.map(n => ({ name: n.trim() }))

      setColumns(cleanCols)
      setDatasetMeta({
        row_count: res.data.row_count,
        column_count: res.data.column_count || colNames.length,
      })

      if (cleanCols.length > 0) {
        const lowerCols = cleanCols.map(c => c.name.toLowerCase())
        // Auto-select smart target column
        const targetIdx = lowerCols.findIndex(c =>
          ['species', 'churn', 'target', 'label', 'class', 'price', 'outcome', 'revenue', 'status', 'vendor'].includes(c)
        )
        const defaultTarget = targetIdx >= 0 ? cleanCols[targetIdx].name : cleanCols[cleanCols.length - 1].name
        setTargetColumn(defaultTarget)

        // Features default to all other columns
        const defaultFeatures = cleanCols.map(c => c.name).filter(c => c !== defaultTarget)
        setSelectedFeatures(defaultFeatures)

        // Infer problem type from target column
        const targetInfo = cleanCols.find(c => c.name === defaultTarget)
        let inferredType: 'classification' | 'regression' = 'classification'
        if (targetInfo) {
          if (!targetInfo.is_numeric || (targetInfo.unique_values !== undefined && targetInfo.unique_values <= 10)) {
            inferredType = 'classification'
          } else {
            inferredType = 'regression'
          }
        }
        setProblemType(inferredType)

        // Auto-generate a clean model name
        const dsObj = datasets.find(d => String(d.id) === datasetId)
        const dsName = (dsObj?.name || dsObj?.filename || `ds${datasetId}`)
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_]/g, '_')
        setModelName(`${algorithm}_${dsName}`)
      }

      // Fetch preview sample rows
      apiClient.get(`/datasets/${datasetId}/preview`).then(p => {
        const rows = p.data?.rows || p.data?.preview || p.data?.data || []
        if (Array.isArray(rows)) setPreviewRows(rows.slice(0, 5))
      }).catch(() => {})
    } catch {
      // Fallback preview
      try {
        const prevRes = await apiClient.get(`/datasets/${datasetId}/preview`)
        const cols: string[] = prevRes.data.columns || prevRes.data.headers || []
        const cleanCols: ColumnInfo[] = cols.map(c => ({ name: c.trim() }))
        setColumns(cleanCols)
        if (cleanCols.length > 0) {
          const defaultTarget = cleanCols[cleanCols.length - 1].name
          setTargetColumn(defaultTarget)
          setSelectedFeatures(cleanCols.map(c => c.name).filter(c => c !== defaultTarget))
        }
      } catch {}
    } finally {
      setLoadingCols(false)
    }
  }

  // When target column changes, adjust problem type and features
  const handleTargetChange = (newTarget: string) => {
    const clean = newTarget.trim()
    setTargetColumn(clean)
    setSelectedFeatures(prev => prev.filter(f => f !== clean))

    const col = columns.find(c => c.name === clean)
    if (col) {
      if (!col.is_numeric || (col.unique_values !== undefined && col.unique_values <= 10)) {
        setProblemType('classification')
      } else {
        setProblemType('regression')
      }
    }
  }

  const toggleFeature = (colName: string) => {
    const clean = colName.trim()
    if (clean === targetColumn) return
    setSelectedFeatures(prev =>
      prev.includes(clean) ? prev.filter(f => f !== clean) : [...prev, clean]
    )
  }

  const selectAllFeatures = () => {
    setSelectedFeatures(columns.map(c => c.name).filter(c => c !== targetColumn))
  }

  const clearAllFeatures = () => {
    setSelectedFeatures([])
  }

  // Single Model Training
  const handleTrain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedDatasetId || !targetColumn) return
    if (selectedFeatures.length === 0) {
      setResult({ error: 'Please select at least one feature column for training.' })
      return
    }

    setTraining(true)
    setResult(null)
    setPredictionResult(null)

    // Build hyperparameter preset map
    let hyperparameters: Record<string, any> = {}
    if (hyperPreset === 'accuracy') {
      if (algorithm.includes('forest')) hyperparameters = { n_estimators: 200, max_depth: 15 }
      else if (algorithm.includes('boosting') || algorithm.includes('xgboost')) hyperparameters = { n_estimators: 200, learning_rate: 0.08, max_depth: 5 }
      else if (algorithm === 'logistic_regression') hyperparameters = { C: 1.0, max_iter: 500 }
      else if (algorithm === 'knn') hyperparameters = { n_neighbors: 5, weights: 'distance' }
    } else if (hyperPreset === 'fast') {
      if (algorithm.includes('forest')) hyperparameters = { n_estimators: 50, max_depth: 6 }
      else if (algorithm.includes('boosting')) hyperparameters = { n_estimators: 50, learning_rate: 0.15, max_depth: 3 }
      else if (algorithm === 'knn') hyperparameters = { n_neighbors: 3 }
    }

    try {
      const payload = {
        dataset_id: +selectedDatasetId,
        datasetId: +selectedDatasetId,
        model_name: modelName || `${algorithm}_model`,
        modelName: modelName || `${algorithm}_model`,
        algorithm_id: algorithm,
        algorithmId: algorithm,
        problem_type: problemType,
        problemType: problemType,
        target_column: targetColumn,
        targetColumn: targetColumn,
        feature_columns: selectedFeatures,
        featureColumns: selectedFeatures,
        test_size: +testSize,
        testSize: +testSize,
        cross_validation: crossValidation,
        crossValidation: crossValidation,
        hyperparameters,
      }

      const res = await apiClient.post('/ml/train', payload)
      setResult(res.data)

      // Pre-fill test inputs with sample values if available
      const sampleInputs: Record<string, string> = {}
      selectedFeatures.forEach(f => {
        const colMeta = columns.find(c => c.name === f)
        sampleInputs[f] = colMeta?.sample_values?.[0] || '1.0'
      })
      setTestInputs(sampleInputs)
    } catch (err: any) {
      setResult({ error: err.response?.data?.detail || 'Training failed. Please check your dataset parameters.' })
    } finally {
      setTraining(false)
    }
  }

  // Compare All Algorithms Benchmark
  const handleCompareAll = async () => {
    if (!selectedDatasetId || !targetColumn || selectedFeatures.length === 0) return
    setComparing(true)
    setCompareResult(null)
    try {
      const payload = {
        dataset_id: +selectedDatasetId,
        datasetId: +selectedDatasetId,
        target_column: targetColumn,
        targetColumn: targetColumn,
        feature_columns: selectedFeatures,
        featureColumns: selectedFeatures,
        problem_type: problemType,
        problemType: problemType,
        test_size: +testSize,
        testSize: +testSize,
      }
      const res = await apiClient.post('/ml/compare', payload)
      setCompareResult(res.data)
    } catch (err: any) {
      setCompareResult({ error: err.response?.data?.detail || 'Benchmark comparison failed.' })
    } finally {
      setComparing(false)
    }
  }

  // Live Test Prediction
  const handleRunTestPrediction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!result) return
    setPredicting(true)
    setPredictionResult(null)
    try {
      const parsedFeatures: Record<string, any> = {}
      Object.entries(testInputs).forEach(([k, v]) => {
        const num = parseFloat(v)
        parsedFeatures[k] = isNaN(num) ? v : num
      })

      const modelNameArtifact = result.model_name || result.modelName || `${algorithm}_model.pkl`
      const payload = {
        model_name: modelNameArtifact,
        modelName: modelNameArtifact,
        features: parsedFeatures,
        input_data: parsedFeatures,
      }
      const res = await apiClient.post('/ml/predict', payload)
      setPredictionResult(res.data)
    } catch (err: any) {
      setPredictionResult({ error: err.response?.data?.detail || 'Prediction failed. Check input values.' })
    } finally {
      setPredicting(false)
    }
  }

  const filteredAlgorithms = algorithms.filter(a => {
    if (!a.problem_types || a.problem_types.length === 0) return true
    return a.problem_types.includes(problemType)
  })

  const availableFeatures = columns.filter(c => c.name !== targetColumn)
  const visibleFeatures = featureSearch
    ? availableFeatures.filter(c => c.name.toLowerCase().includes(featureSearch.toLowerCase()))
    : availableFeatures

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto text-[#f8fafc]">
      <PageHeader
        title="ML Engine & Model Training"
        subtitle="Automated end-to-end model training, hyperparameter presets, 5-fold cross-validation, and live inference testing"
        icon={<Cpu className="size-6 text-cyan-400" />}
      />

      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/15 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`btn btn-sm ${activeTab === 'single' ? 'btn-neon-solid' : 'btn-ghost text-[#cbd5e1]'}`}
          >
            <Play className="size-3.5" />
            <span>Single Model Training</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`btn btn-sm ${activeTab === 'compare' ? 'btn-neon-solid' : 'btn-ghost text-[#cbd5e1]'}`}
          >
            <GitCompare className="size-3.5" />
            <span>Benchmark & Compare All</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#94a3b8]">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Scikit-Learn & MLflow Orchestration Active</span>
        </div>
      </div>

      {/* ── STEP 1: DATASET SELECTION & INSTANT PRESETS ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="cyber-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-6 rounded-full bg-cyan-400 text-black font-display font-black text-xs">
              1
            </span>
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
              Select Dataset & Explore Data
            </h3>
          </div>

          {/* Instant Quick-Pick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[#94a3b8] uppercase">Quick Presets:</span>
            {datasets.map((d: any) => {
              const isSelected = String(d.id) === selectedDatasetId
              let label = d.name || d.filename
              if (label.toLowerCase().includes('iris')) label = '🌸 Iris Flower'
              else if (label.toLowerCase().includes('churn')) label = '👥 Customer Churn'
              else if (label.toLowerCase().includes('house')) label = '🏡 Housing Prices'
              else label = label.slice(0, 18)

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleDatasetChange(String(d.id))}
                  className={`font-mono text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'border-white/10 bg-black/40 text-[#cbd5e1] hover:border-cyan-500/30'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dataset Dropdown & Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-2">
            <label className="form-label text-[#cbd5e1]">
              Active Dataset in Repository <span className="text-cyan-400">*</span>
            </label>
            <select
              value={selectedDatasetId}
              onChange={e => handleDatasetChange(e.target.value)}
              className="form-select bg-[#0a0f1e] text-white border-cyan-500/20 font-mono text-xs"
              required
            >
              <option value="" className="bg-[#0a0f1e] text-white">Select dataset...</option>
              {datasets.map((d: any) => (
                <option key={d.id} value={d.id} className="bg-[#0a0f1e] text-white">
                  {d.name || d.filename} — ({(d.row_count ?? d.rows)?.toLocaleString() || '?'} rows × {d.column_count || '?'} cols)
                </option>
              ))}
            </select>
            {datasetMeta && (
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[#94a3b8]">
                <span>Total Samples: <strong className="text-cyan-300">{datasetMeta.row_count?.toLocaleString() || '?'}</strong></span>
                <span>•</span>
                <span>Features: <strong className="text-cyan-300">{datasetMeta.column_count || columns.length}</strong></span>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="btn btn-secondary w-full py-2.5 text-xs font-mono flex items-center justify-center gap-1.5"
              >
                {showPreview ? <EyeOff className="size-3.5 text-cyan-400" /> : <Eye className="size-3.5 text-cyan-400" />}
                <span>{showPreview ? 'Hide Preview' : 'Preview Data (5 Rows)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Dataset Preview Drawer */}
        <AnimatePresence>
          {showPreview && previewRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-xl bg-black/60 border border-cyan-500/20 overflow-x-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-cyan-400">Sample Records (First 5 Rows):</span>
                <span className="font-mono text-[10px] text-[#94a3b8]">Verified Cleaned Headers</span>
              </div>
              <table className="data-table text-xs font-mono">
                <thead>
                  <tr>
                    {Object.keys(previewRows[0] || {}).map(k => (
                      <th key={k} className="text-cyan-300 font-bold">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="text-[#cbd5e1]">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── STEP 2: TARGET & FEATURES CONFIGURATION ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="cyber-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-6 rounded-full bg-cyan-400 text-black font-display font-black text-xs">
              2
            </span>
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
              Target Prediction Column & Input Features
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#94a3b8]">Task Type:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 font-bold uppercase">
              {problemType}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Target Column Selector */}
          <div>
            <label className="form-label text-[#cbd5e1]">
              Target Prediction Column (What to predict) <span className="text-cyan-400">*</span>
            </label>
            {loadingCols ? (
              <div className="form-input flex items-center gap-2 text-xs text-[#94a3b8]">
                <div className="size-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Analyzing column types...
              </div>
            ) : (
              <select
                value={targetColumn}
                onChange={e => handleTargetChange(e.target.value)}
                className="form-select bg-[#0a0f1e] text-cyan-300 font-bold border-cyan-500/30 text-sm"
                disabled={!selectedDatasetId || columns.length === 0}
                required
              >
                <option value="" className="bg-[#0a0f1e] text-white">Select target column...</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name} className="bg-[#0a0f1e] text-white">
                    {c.name} {c.dtype ? `[${c.dtype}${c.unique_values ? `, ${c.unique_values} classes` : ''}]` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="font-mono text-[11px] text-[#94a3b8] mt-1.5">
              The target column is excluded from inputs and used as ground truth for supervised learning.
            </p>
          </div>

          {/* Task Type Explicit Override */}
          <div>
            <label className="form-label text-[#cbd5e1]">Learning Task Formulation</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-cyan-500/20">
              <button
                type="button"
                onClick={() => setProblemType('classification')}
                className={`py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                  problemType === 'classification'
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                Classification (Categories)
              </button>
              <button
                type="button"
                onClick={() => setProblemType('regression')}
                className={`py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                  problemType === 'regression'
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                Regression (Numbers)
              </button>
            </div>
            <p className="font-mono text-[11px] text-[#94a3b8] mt-1.5">
              {problemType === 'classification'
                ? 'Classification computes Accuracy, Precision, Recall, F1, and Confusion Matrix.'
                : 'Regression computes R², RMSE, MSE, and MAE continuous prediction metrics.'}
            </p>
          </div>
        </div>

        {/* Feature Columns Selection */}
        {selectedDatasetId && availableFeatures.length > 0 && (
          <div className="pt-5 border-t border-cyan-500/15">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label className="form-label !mb-0 text-[#cbd5e1]">Feature Columns (Model Inputs)</label>
                <p className="font-mono text-xs text-cyan-300">
                  {selectedFeatures.length} of {availableFeatures.length} features selected
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="size-3.5 text-[#94a3b8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={featureSearch}
                    onChange={e => setFeatureSearch(e.target.value)}
                    placeholder="Search features..."
                    className="bg-black/60 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-white placeholder-[#94a3b8] focus:border-cyan-400 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAllFeatures}
                  className="btn btn-ghost btn-sm text-cyan-400 hover:text-cyan-300 font-mono text-xs"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllFeatures}
                  className="btn btn-ghost btn-sm text-[#cbd5e1] hover:text-white font-mono text-xs"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto p-1 pr-2">
              {visibleFeatures.map(col => {
                const isSelected = selectedFeatures.includes(col.name)
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => toggleFeature(col.name)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                        : 'border-white/10 bg-black/40 text-[#cbd5e1] hover:border-white/25'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-cyan-400 shrink-0" />
                    ) : (
                      <Square className="size-4 text-[#94a3b8] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold truncate text-white">{col.name}</p>
                      <span className="text-[10px] text-[#94a3b8] font-mono">
                        {col.is_numeric ? '🔢 Numeric' : '🔤 Categorical'}
                        {col.sample_values?.[0] ? ` · eg. ${col.sample_values[0]}` : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── STEP 3: ALGORITHM & HYPERPARAMETER PROTOCOL ── */}
      {activeTab === 'single' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Algorithm Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center size-6 rounded-full bg-cyan-400 text-black font-display font-black text-xs">
                  3
                </span>
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                  Select Machine Learning Algorithm ({filteredAlgorithms.length} Available)
                </h3>
              </div>
              <span className="font-mono text-xs text-cyan-400 font-bold uppercase">
                Task: {problemType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredAlgorithms.map((a: AlgorithmMeta) => {
                const meta = ALGORITHM_DETAILS[a.id] || { badge: 'Standard', speed: 'Fast', highlight: a.description }
                const isSelected = algorithm === a.id
                return (
                  <motion.button
                    key={a.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setAlgorithm(a.id)
                      if (modelName) {
                        const dsObj = datasets.find(d => String(d.id) === selectedDatasetId)
                        const dsName = (dsObj?.name || dsObj?.filename || 'model')
                          .replace(/\.[^/.]+$/, '')
                          .replace(/[^a-zA-Z0-9_]/g, '_')
                        setModelName(`${a.id}_${dsName}`)
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                      isSelected
                        ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/20 to-black/60 shadow-[0_0_25px_rgba(0,240,255,0.25)]'
                        : 'border-cyan-500/15 bg-black/40 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                        isSelected ? 'bg-cyan-400 text-black font-black' : 'bg-white/10 text-cyan-300'
                      }`}>
                        {meta.badge}
                      </span>
                      <span className="font-mono text-[10px] text-[#94a3b8]">{meta.speed}</span>
                    </div>

                    <h4 className="font-display text-sm font-bold text-white mb-1 tracking-wide">{a.name}</h4>
                    <p className="font-mono text-xs text-[#cbd5e1] leading-relaxed">{meta.highlight}</p>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Hyperparameter Controls */}
          <div className="cyber-card p-6">
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <Sliders className="size-4 text-cyan-400" />
              <span>Training Protocol & Validation Settings</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="form-label text-[#cbd5e1]">Artifact Save Name</label>
                <input
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="form-input font-mono text-xs text-cyan-300 font-bold bg-[#0a0f1e]"
                  placeholder="e.g. rf_classifier_iris"
                  required
                />
              </div>

              <div>
                <label className="form-label text-[#cbd5e1]">Evaluation Test Split</label>
                <select
                  value={testSize}
                  onChange={e => setTestSize(e.target.value)}
                  className="form-select font-mono text-xs bg-[#0a0f1e] text-white"
                >
                  <option value="0.1" className="bg-[#0a0f1e] text-white">10% Test / 90% Train</option>
                  <option value="0.2" className="bg-[#0a0f1e] text-white">20% Test / 80% Train (Standard)</option>
                  <option value="0.25" className="bg-[#0a0f1e] text-white">25% Test / 75% Train</option>
                  <option value="0.3" className="bg-[#0a0f1e] text-white">30% Test / 70% Train</option>
                </select>
              </div>

              <div>
                <label className="form-label text-[#cbd5e1]">Optimization Preset</label>
                <select
                  value={hyperPreset}
                  onChange={e => setHyperPreset(e.target.value as any)}
                  className="form-select font-mono text-xs bg-[#0a0f1e] text-white"
                >
                  <option value="accuracy" className="bg-[#0a0f1e] text-white">High Accuracy (Deep Ensemble)</option>
                  <option value="standard" className="bg-[#0a0f1e] text-white">Balanced Production</option>
                  <option value="fast" className="bg-[#0a0f1e] text-white">Fast Lightweight Baseline</option>
                </select>
              </div>

              <div>
                <label className="form-label text-[#cbd5e1]">5-Fold Cross Validation</label>
                <button
                  type="button"
                  onClick={() => setCrossValidation(!crossValidation)}
                  className={`w-full p-2.5 rounded-xl border font-mono text-xs font-bold transition-all flex items-center justify-between ${
                    crossValidation
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(0,255,163,0.15)]'
                      : 'border-white/10 bg-black/40 text-[#94a3b8]'
                  }`}
                >
                  <span>{crossValidation ? 'ENABLED (Stratified)' : 'DISABLED'}</span>
                  <CheckCircle className={`size-4 ${crossValidation ? 'opacity-100 text-emerald-400' : 'opacity-25'}`} />
                </button>
              </div>
            </div>

            {/* Launch Action Bar */}
            <div className="mt-6 pt-5 border-t border-cyan-500/15 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#cbd5e1]">
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>Automated median imputation & clean feature scaling guaranteed.</span>
              </div>

              <motion.button
                type="button"
                onClick={() => handleTrain()}
                disabled={training || !selectedDatasetId || !targetColumn || selectedFeatures.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-neon-solid px-8 py-3.5 text-sm w-full sm:w-auto"
              >
                {training ? (
                  <>
                    <div className="size-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>TRAINING {algorithm.toUpperCase()}...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    <span>TRAIN MODEL & EVALUATE</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* ── STEP 5: RESULTS & LIVE INFERENCE TESTER ── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="cyber-card p-6 space-y-6"
              >
                {result.error ? (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-center gap-3">
                    <span className="font-bold text-rose-400">TRAINING NOTICE:</span> {result.error}
                  </div>
                ) : (
                  <>
                    {/* Header Summary Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-cyan-500/15">
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(0,255,163,0.3)]">
                          <CheckCircle className="size-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-300 font-bold bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                              Production Model Ready
                            </span>
                            <span className="font-mono text-xs text-[#cbd5e1]">
                              {result.training_samples} training / {result.test_samples} test records
                            </span>
                          </div>
                          <h3 className="font-display text-2xl font-black text-white tracking-wide">
                            {result.model_name || result.modelName}
                          </h3>
                          <p className="font-mono text-xs text-[#cbd5e1] mt-0.5">
                            Algorithm: <strong className="text-cyan-400 uppercase">{result.algorithm}</strong>
                            {' · '}Target Goal: <strong className="text-white">{result.target_column}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate('/predictions')}
                          className="btn btn-neon btn-sm"
                        >
                          Full Predictions Studio <ArrowRight className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/model-registry')}
                          className="btn btn-secondary btn-sm font-mono text-xs"
                        >
                          Model Registry
                        </button>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    {result.metrics && (
                      <div>
                        <h4 className="font-display text-xs font-bold text-[#cbd5e1] uppercase tracking-wider mb-3 flex items-center gap-2">
                          <BarChart3 className="size-4 text-cyan-400" />
                          <span>Performance Validation Scores</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                          {Object.entries(result.metrics)
                            .filter(([k, v]) => typeof v === 'number' || (typeof v === 'string' && k !== 'confusion_matrix'))
                            .map(([k, v]) => (
                              <div key={k} className="p-4 rounded-2xl bg-black/50 border border-cyan-500/15">
                                <p className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-wider mb-1">
                                  {k.replace(/_/g, ' ')}
                                </p>
                                <p className="font-display text-2xl font-black text-cyan-300">
                                  {typeof v === 'number'
                                    ? ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].includes(k)
                                      ? `${(v * 100).toFixed(1)}%`
                                      : v.toFixed(4)
                                    : String(v)}
                                </p>
                              </div>
                            ))}

                          {result.cv_mean != null && (
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                              <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider mb-1">
                                5-Fold Mean Accuracy
                              </p>
                              <p className="font-display text-2xl font-black text-emerald-300">
                                {(result.cv_mean * 100).toFixed(1)}%
                              </p>
                              {result.cv_std != null && (
                                <span className="font-mono text-[10px] text-[#94a3b8]">±{(result.cv_std * 100).toFixed(1)}% std</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Confusion Matrix Visualization */}
                    {result.metrics?.confusion_matrix && (
                      <div className="p-5 rounded-2xl bg-black/50 border border-cyan-500/15">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Layers className="size-4 text-cyan-400" />
                            <span>Confusion Matrix (Ground Truth vs Prediction)</span>
                          </h4>
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            Diagonal = Correct True Positives
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="font-mono text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="p-2 text-[#94a3b8] text-left">Actual \ Predicted</th>
                                {(result.metrics.class_labels || result.metrics.confusion_matrix.map((_: any, i: number) => `Class ${i}`)).map((label: string) => (
                                  <th key={label} className="p-2 text-cyan-300 text-center font-bold">
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {result.metrics.confusion_matrix.map((row: number[], rowIdx: number) => {
                                const rowLabel = (result.metrics.class_labels && result.metrics.class_labels[rowIdx]) || `Class ${rowIdx}`
                                return (
                                  <tr key={rowIdx}>
                                    <td className="p-2 text-white font-bold">{rowLabel}</td>
                                    {row.map((val: number, colIdx: number) => {
                                      const isDiagonal = rowIdx === colIdx
                                      return (
                                        <td
                                          key={colIdx}
                                          className={`p-3 text-center rounded-lg font-mono font-bold text-sm ${
                                            isDiagonal
                                              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                                              : val > 0
                                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                              : 'bg-black/30 text-[#64748b]'
                                          }`}
                                        >
                                          {val}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Regression Actual vs Predicted Scatter & Residuals */}
                    {problemType === 'regression' && result.metrics?.scatter_preview && (
                      <div className="p-5 rounded-2xl bg-black/50 border border-cyan-500/15 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Layers className="size-4 text-cyan-400" />
                            <span>Regression Fit (Actual vs Predicted Values)</span>
                          </h4>
                          <span className="font-mono text-xs text-cyan-300 font-bold">
                            R² Score: {result.metrics.r2 != null ? result.metrics.r2.toFixed(4) : '—'} · RMSE: {result.metrics.rmse != null ? result.metrics.rmse.toFixed(3) : '—'}
                          </span>
                        </div>
                        <ReactECharts
                          option={{
                            backgroundColor: 'transparent',
                            tooltip: {
                              trigger: 'item',
                              backgroundColor: '#090d16',
                              borderColor: '#1e293b',
                              formatter: (p: any) => `Actual: ${p.value[0]}<br/>Predicted: ${p.value[1]}<br/>Residual Error: ${(p.value[0] - p.value[1]).toFixed(3)}`
                            },
                            grid: { top: 20, bottom: 30, left: 45, right: 20 },
                            xAxis: {
                              type: 'value',
                              name: 'Actual Target',
                              nameTextStyle: { color: '#64748b', fontSize: 10 },
                              axisLabel: { color: '#64748b', fontSize: 10 },
                              splitLine: { lineStyle: { color: '#141e33' } },
                            },
                            yAxis: {
                              type: 'value',
                              name: 'Predicted Target',
                              nameTextStyle: { color: '#64748b', fontSize: 10 },
                              axisLabel: { color: '#64748b', fontSize: 10 },
                              splitLine: { lineStyle: { color: '#141e33' } },
                            },
                            series: [
                              {
                                name: 'Test Samples',
                                type: 'scatter',
                                symbolSize: 10,
                                data: result.metrics.scatter_preview.map((pt: any) => [pt.actual, pt.predicted]),
                                itemStyle: { color: '#06b6d4', shadowBlur: 8, shadowColor: 'rgba(6, 182, 212, 0.5)' },
                              },
                            ],
                          }}
                          style={{ height: 260 }}
                        />
                      </div>
                    )}

                    {/* Feature Importance Bars */}
                    {result.feature_importance && Object.keys(result.feature_importance).length > 0 && (
                      <div>
                        <h4 className="font-display text-xs font-bold text-[#cbd5e1] uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Sparkles className="size-4 text-cyan-400" />
                          <span>Top Predictor Features (Feature Importance)</span>
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(result.feature_importance)
                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                            .slice(0, 8)
                            .map(([feat, imp]) => {
                              const pct = Math.round((imp as number) * 100)
                              return (
                                <div key={feat} className="space-y-1">
                                  <div className="flex justify-between font-mono text-xs">
                                    <span className="text-white font-medium">{feat}</span>
                                    <span className="text-cyan-300 font-bold">{pct}% weight</span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-black/70 overflow-hidden border border-cyan-500/15">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                                      style={{ width: `${Math.max(pct, 4)}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* ── LIVE TEST INFERENCE FORM RIGHT ON THE PAGE ── */}
                    <div className="mt-8 p-6 rounded-2xl bg-black/50 border border-cyan-500/25">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Zap className="size-5 text-cyan-400" />
                          <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                            Interactive Live Prediction Tester
                          </h4>
                        </div>
                        <span className="font-mono text-xs text-[#94a3b8]">
                          Test trained model on arbitrary feature inputs
                        </span>
                      </div>

                      <form onSubmit={handleRunTestPrediction}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                          {selectedFeatures.slice(0, 8).map(f => (
                            <div key={f}>
                              <label className="font-mono text-[11px] text-[#cbd5e1] block mb-1 truncate">{f}</label>
                              <input
                                type="text"
                                value={testInputs[f] || ''}
                                onChange={e => setTestInputs({ ...testInputs, [f]: e.target.value })}
                                className="form-input text-xs font-mono bg-[#0a0f1e] text-white"
                                placeholder="0.0"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="submit"
                            disabled={predicting}
                            className="btn btn-neon-solid btn-sm"
                          >
                            {predicting ? 'RUNNING INFERENCE...' : 'RUN INSTANT PREDICTION'}
                          </button>

                          {predictionResult && (
                            <div className="flex items-center gap-3 font-mono text-xs">
                              {predictionResult.error ? (
                                <span className="text-rose-400">{predictionResult.error}</span>
                              ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40">
                                  <span className="text-[#94a3b8]">Result:</span>
                                  <span className="text-cyan-300 font-bold text-sm">
                                    {predictionResult.predicted_label || predictionResult.prediction}
                                  </span>
                                  {predictionResult.confidence != null && (
                                    <span className="text-emerald-400">
                                      ({(predictionResult.confidence * 100).toFixed(1)}% confidence)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── COMPARE ALL BENCHMARK MODE ── */}
      {activeTab === 'compare' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="cyber-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <GitCompare className="size-5 text-cyan-400" />
                  <span>Automated Multi-Algorithm Benchmark</span>
                </h3>
                <p className="font-mono text-xs text-[#cbd5e1] mt-1">
                  Trains and evaluates Random Forest, Gradient Boosting, Decision Tree, Logistic Regression, KNN, and SVM side-by-side on identical test folds.
                </p>
              </div>

              <motion.button
                type="button"
                onClick={handleCompareAll}
                disabled={comparing || !selectedDatasetId || !targetColumn || selectedFeatures.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-neon-solid px-6 py-3.5 text-sm shrink-0"
              >
                {comparing ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>BENCHMARKING 6 ALGORITHMS...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    <span>RUN MULTI-MODEL BENCHMARK</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Benchmark Results */}
          <AnimatePresence>
            {compareResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="cyber-card p-6"
              >
                {compareResult.error ? (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs">
                    {compareResult.error}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-cyan-500/15 pb-4">
                      <div>
                        <span className="font-mono text-xs text-emerald-400 uppercase tracking-wider font-bold">
                          Multi-Model Benchmark Completed
                        </span>
                        <h3 className="font-display text-lg font-bold text-white mt-0.5">
                          Best Performing Algorithm: <span className="text-cyan-300 uppercase">{compareResult.best_algorithm}</span>
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-[#cbd5e1]">
                        {compareResult.training_samples} training / {compareResult.test_samples} test records
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="data-table font-mono text-xs">
                        <thead>
                          <tr>
                            <th className="text-white">Rank</th>
                            <th className="text-white">Algorithm</th>
                            <th className="text-white">Accuracy / R²</th>
                            <th className="text-white">Precision</th>
                            <th className="text-white">Recall</th>
                            <th className="text-white">F1 Score</th>
                            <th className="text-white">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareResult.comparisons?.map((c: any, idx: number) => {
                            const isBest = idx === 0 && c.status === 'success'
                            const m = c.metrics || {}
                            const primaryMetric = m.accuracy != null ? m.accuracy : m.r2
                            return (
                              <tr key={c.algorithm} className={isBest ? 'bg-cyan-500/15 font-semibold' : ''}>
                                <td>
                                  {isBest ? (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-black font-bold text-[10px]">
                                      #1 BEST
                                    </span>
                                  ) : (
                                    `#${idx + 1}`
                                  )}
                                </td>
                                <td className="font-display text-white uppercase tracking-wider">
                                  {c.algorithm.replace(/_/g, ' ')}
                                </td>
                                <td>
                                  <span className="font-bold text-cyan-300 text-sm">
                                    {primaryMetric != null ? `${(primaryMetric * 100).toFixed(1)}%` : '—'}
                                  </span>
                                </td>
                                <td className="text-[#cbd5e1]">
                                  {m.precision != null ? `${(m.precision * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td className="text-[#cbd5e1]">
                                  {m.recall != null ? `${(m.recall * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td className="text-[#cbd5e1]">
                                  {m.f1 != null ? `${(m.f1 * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td>
                                  <span className={`badge ${c.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
