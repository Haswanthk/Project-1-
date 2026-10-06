import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import {
  Play, Cpu, Zap, CheckSquare, Square, ArrowRight,
  CheckCircle, GitCompare, BarChart3, Sliders, Layers, Sparkles,
  RefreshCw, Eye, EyeOff, Search, ShieldCheck, Lightbulb, Info,
  AlertTriangle, Award, Clock
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { PipelineFlowDAG } from '../components/ui/PipelineFlowDAG'
import { LiveInferencePlayground } from '../components/ui/LiveInferencePlayground'
import { AnimatedCounter } from '../components/ui/AnimatedCounter'

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

// ═══════════════════════════════════════════════
// SMART RECOMMENDATION ENGINE
// Provides context-aware suggestions based on
export function isHighRiskFeature(name: string, col?: ColumnInfo): boolean {
  const lower = name.toLowerCase().trim()
  if (/^(id|_id|uuid|guid|row_id|index|created_at|updated_at|timestamp|date|unnamed)/.test(lower)) return true
  if (col?.unique_values && col.unique_values === 1) return true
  return false
}

interface Recommendation {
  type: 'algorithm' | 'split' | 'preset' | 'cv' | 'general'
  title: string
  message: string
  icon: 'tip' | 'warning' | 'info' | 'success'
  priority: number
}

function getSmartRecommendations(
  problemType: 'classification' | 'regression',
  rowCount: number | undefined,
  colCount: number | undefined,
  targetColumn: string,
  selectedFeatures: string[],
  selectedAlgorithm: string,
  testSize: string,
  hyperPreset: string,
  crossValidation: boolean,
  columns: ColumnInfo[]
): Recommendation[] {
  const recs: Recommendation[] = []
  const rows = rowCount || 0
  const cols = colCount || selectedFeatures.length

  // ── Algorithm Recommendations Based on Data Size ──
  if (rows > 0 && rows < 100) {
    recs.push({
      type: 'algorithm',
      title: 'Small Dataset Detected',
      message: `With only ~${rows} samples, use simpler models like Logistic Regression or Decision Tree to avoid overfitting. Ensemble methods (Random Forest, XGBoost) may memorize noise.`,
      icon: 'warning',
      priority: 10,
    })
    if (['random_forest', 'gradient_boosting', 'xgboost'].includes(selectedAlgorithm)) {
      recs.push({
        type: 'algorithm',
        title: 'Consider Simpler Model',
        message: `${selectedAlgorithm.replace(/_/g, ' ')} may overfit on ${rows} samples. Try Logistic Regression or KNN for better generalization.`,
        icon: 'warning',
        priority: 9,
      })
    }
  } else if (rows >= 100 && rows < 1000) {
    recs.push({
      type: 'algorithm',
      title: 'Medium Dataset — Good for Most Models',
      message: `${rows} samples works well with Random Forest or Gradient Boosting. Cross-validation is essential at this scale for reliable metrics.`,
      icon: 'tip',
      priority: 5,
    })
  } else if (rows >= 1000 && rows < 10000) {
    recs.push({
      type: 'algorithm',
      title: 'Solid Dataset Size',
      message: `${rows.toLocaleString()} samples gives enough signal for ensemble methods. XGBoost or Gradient Boosting will likely outperform simpler models.`,
      icon: 'success',
      priority: 4,
    })
  } else if (rows >= 10000) {
    recs.push({
      type: 'algorithm',
      title: 'Large Dataset — Consider Speed Trade-offs',
      message: `With ${rows.toLocaleString()} samples, XGBoost is recommended for speed+accuracy. SVM will be very slow. Consider "Fast" preset for initial runs.`,
      icon: 'info',
      priority: 6,
    })
    if (selectedAlgorithm === 'svm') {
      recs.push({
        type: 'algorithm',
        title: 'SVM May Be Very Slow',
        message: `SVM has O(n²) to O(n³) time complexity. With ${rows.toLocaleString()} rows, training could take minutes to hours. Switch to XGBoost for 10-100x faster training.`,
        icon: 'warning',
        priority: 10,
      })
    }
  }

  // ── Problem Type Specific Recommendations ──
  if (problemType === 'classification') {
    const targetCol = columns.find(c => c.name === targetColumn)
    if (targetCol?.unique_values && targetCol.unique_values > 10) {
      recs.push({
        type: 'general',
        title: 'Many Classes Detected',
        message: `Target "${targetColumn}" has ${targetCol.unique_values} unique classes. Random Forest or Gradient Boosting handle multi-class well. Logistic Regression with "one-vs-rest" also works.`,
        icon: 'info',
        priority: 7,
      })
    }
    if (targetCol?.unique_values === 2) {
      recs.push({
        type: 'general',
        title: 'Binary Classification',
        message: `Two-class problem detected. All algorithms work well here. Logistic Regression gives probability scores + fast baseline. XGBoost/Random Forest for max accuracy.`,
        icon: 'tip',
        priority: 3,
      })
    }

    if (selectedAlgorithm === 'linear_regression') {
      recs.push({
        type: 'algorithm',
        title: 'Wrong Algorithm for Classification',
        message: `Linear Regression predicts continuous values, not categories. Switch to Logistic Regression for classification tasks.`,
        icon: 'warning',
        priority: 10,
      })
    }
  }

  if (problemType === 'regression') {
    if (selectedAlgorithm === 'logistic_regression') {
      recs.push({
        type: 'algorithm',
        title: 'Wrong Algorithm for Regression',
        message: `Logistic Regression is for classification (categories). Use Linear Regression, Random Forest, or XGBoost for continuous predictions.`,
        icon: 'warning',
        priority: 10,
      })
    }
    recs.push({
      type: 'general',
      title: 'Regression Best Practices',
      message: `For regression: check R² (closer to 1.0 = better), RMSE (lower = better). Random Forest handles non-linear relationships; Linear Regression assumes linearity.`,
      icon: 'tip',
      priority: 2,
    })
  }

  // ── Feature Count Recommendations ──
  if (selectedFeatures.length > 0 && cols > 0) {
    if (selectedFeatures.length === 1) {
      recs.push({
        type: 'general',
        title: 'Single Feature Selected',
        message: `Training with just 1 feature limits model power. Select additional features for better predictions unless you're testing a specific hypothesis.`,
        icon: 'warning',
        priority: 8,
      })
    }
    if (rows > 0 && selectedFeatures.length > rows / 5) {
      recs.push({
        type: 'general',
        title: 'High Feature-to-Sample Ratio',
        message: `${selectedFeatures.length} features vs ${rows} samples risks overfitting. Consider reducing features or using regularized models (Logistic Regression, XGBoost).`,
        icon: 'warning',
        priority: 8,
      })
    }

    // Check for ID / timestamp leakage
    const leakageSelected = selectedFeatures.filter(f => isHighRiskFeature(f, columns.find(c => c.name === f)))
    if (leakageSelected.length > 0) {
      recs.push({
        type: 'general',
        title: 'Target Leakage / ID Columns Selected',
        message: `Columns [${leakageSelected.join(', ')}] appear to be identifiers or timestamps. Including them causes memorization instead of real learning. Click "Auto-Select Best Features" to exclude them.`,
        icon: 'warning',
        priority: 10,
      })
    }

    // Model & Feature Synergy
    if (['random_forest', 'xgboost', 'gradient_boosting'].includes(selectedAlgorithm)) {
      recs.push({
        type: 'algorithm',
        title: `Feature Synergy: ${selectedAlgorithm.replace(/_/g, ' ').toUpperCase()}`,
        message: `Tree ensembles will naturally capture non-linear interactions across your ${selectedFeatures.length} features without requiring one-hot scale tuning.`,
        icon: 'success',
        priority: 3,
      })
    } else if (['logistic_regression', 'linear_regression'].includes(selectedAlgorithm)) {
      recs.push({
        type: 'algorithm',
        title: `Feature Synergy: Linear Formulation`,
        message: `Will compute explicit feature weights (coefficients) for your ${selectedFeatures.length} features, giving you direct interpretable impact metrics.`,
        icon: 'tip',
        priority: 3,
      })
    }
  } else if (selectedFeatures.length === 0) {
    recs.push({
      type: 'general',
      title: 'No Features Selected',
      message: 'You have not selected any input features. Choose features below or click "Auto-Select Best Features" to train your model.',
      icon: 'warning',
      priority: 10,
    })
  }
  const testSizeNum = parseFloat(testSize)
  if (rows > 0 && rows < 200 && testSizeNum > 0.2) {
    recs.push({
      type: 'split',
      title: 'Reduce Test Split for Small Data',
      message: `With only ${rows} samples, a ${Math.round(testSizeNum * 100)}% test split leaves very few training examples. Use 10-20% test split and rely on cross-validation instead.`,
      icon: 'tip',
      priority: 7,
    })
  }
  if (rows > 10000 && testSizeNum < 0.2) {
    recs.push({
      type: 'split',
      title: 'Test Split is Fine',
      message: `With ${rows.toLocaleString()} samples, even a 10% test split gives ${Math.round(rows * testSizeNum).toLocaleString()} test records — statistically reliable.`,
      icon: 'success',
      priority: 1,
    })
  }

  // ── Hyperparameter Preset Recommendations ──
  if (hyperPreset === 'accuracy' && rows > 10000) {
    recs.push({
      type: 'preset',
      title: 'High Accuracy Preset on Large Data',
      message: `"High Accuracy" doubles tree count and depth. On ${rows.toLocaleString()} rows this will be slower. Consider "Balanced" for initial exploration, then "High Accuracy" for final model.`,
      icon: 'info',
      priority: 5,
    })
  }
  if (hyperPreset === 'fast' && rows < 500) {
    recs.push({
      type: 'preset',
      title: 'No Need for Fast Preset',
      message: `Your dataset is small enough that even "High Accuracy" preset will train in seconds. Switch to "High Accuracy" for better results at no time cost.`,
      icon: 'tip',
      priority: 6,
    })
  }

  // ── Cross-Validation Recommendations ──
  if (!crossValidation && rows < 500) {
    recs.push({
      type: 'cv',
      title: 'Enable Cross-Validation',
      message: `With ${rows || 'few'} samples, a single train/test split can be unreliable. 5-fold CV gives much more stable metrics — strongly recommended.`,
      icon: 'warning',
      priority: 9,
    })
  }
  if (crossValidation && rows > 50000) {
    recs.push({
      type: 'cv',
      title: 'CV on Large Data — Be Patient',
      message: `5-fold CV on ${rows.toLocaleString()} rows means training 5 separate models. This is thorough but will take 5x longer. Consider disabling for quick iteration.`,
      icon: 'info',
      priority: 4,
    })
  }

  // Sort by priority (highest first)
  return recs.sort((a, b) => b.priority - a.priority)
}

function getAlgorithmRecommendation(
  problemType: 'classification' | 'regression',
  rowCount: number | undefined,
  _colCount: number | undefined
): { id: string; reason: string } {
  const rows = rowCount || 0

  if (problemType === 'classification') {
    if (rows < 100) return { id: 'logistic_regression', reason: 'Best for small datasets — low overfitting risk, fast, interpretable' }
    if (rows < 1000) return { id: 'random_forest', reason: 'Excellent accuracy on medium datasets with minimal tuning needed' }
    if (rows < 10000) return { id: 'gradient_boosting', reason: 'Top-tier tabular performance for medium-large datasets' }
    return { id: 'xgboost', reason: 'Production-optimized for large datasets — fastest ensemble method' }
  } else {
    if (rows < 100) return { id: 'linear_regression', reason: 'Simple, interpretable, low-variance for small samples' }
    if (rows < 1000) return { id: 'random_forest', reason: 'Handles non-linear patterns well without feature engineering' }
    return { id: 'xgboost', reason: 'Best regression performance on medium-large tabular data' }
  }
}

// ═══════════════════════════════════════════════
// Recommendation Display Component
// ═══════════════════════════════════════════════

function RecommendationPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null

  const iconMap = {
    tip: <Lightbulb className="size-4 text-amber-500 shrink-0" />,
    warning: <AlertTriangle className="size-4 text-rose-500 shrink-0" />,
    info: <Info className="size-4 text-blue-500 shrink-0" />,
    success: <CheckCircle className="size-4 text-emerald-500 shrink-0" />,
  }

  const bgMap = {
    tip: 'bg-amber-500/8 border-amber-500/20',
    warning: 'bg-rose-500/8 border-rose-500/20',
    info: 'bg-blue-500/8 border-blue-500/20',
    success: 'bg-emerald-500/8 border-emerald-500/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-[var(--c-accent)]" />
        <span className="font-display text-xs font-bold text-[var(--c-text-primary)] uppercase tracking-wider">
          AI Recommendations ({recommendations.length})
        </span>
      </div>
      {recommendations.slice(0, 4).map((rec, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className={`p-3 rounded-xl border ${bgMap[rec.icon]} flex items-start gap-3`}
        >
          {iconMap[rec.icon]}
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-[var(--c-text-primary)]">{rec.title}</p>
            <p className="font-mono text-[11px] text-[var(--c-text-secondary)] mt-0.5 leading-relaxed">{rec.message}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════
// MAIN TRAINING PAGE COMPONENT
// ═══════════════════════════════════════════════

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

  // ── Smart Recommendations ──
  const recommendations = useMemo(() =>
    getSmartRecommendations(
      problemType, datasetMeta?.row_count, datasetMeta?.column_count,
      targetColumn, selectedFeatures, algorithm, testSize, hyperPreset,
      crossValidation, columns
    ),
    [problemType, datasetMeta, targetColumn, selectedFeatures, algorithm, testSize, hyperPreset, crossValidation, columns]
  )

  const algoRecommendation = useMemo(() =>
    getAlgorithmRecommendation(problemType, datasetMeta?.row_count, datasetMeta?.column_count),
    [problemType, datasetMeta]
  )

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

        // Features default to recommended columns (excluding target and high-risk ID/leakage columns)
        const recommended = cleanCols
          .filter(c => c.name !== defaultTarget && !isHighRiskFeature(c.name, c))
          .map(c => c.name)
        const defaultFeatures = recommended.length > 0
          ? recommended
          : cleanCols.map(c => c.name).filter(c => c !== defaultTarget)
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

  const selectRecommendedFeatures = () => {
    const recs = columns
      .filter(c => c.name !== targetColumn && !isHighRiskFeature(c.name, c))
      .map(c => c.name)
    setSelectedFeatures(recs.length > 0 ? recs : columns.map(c => c.name).filter(c => c !== targetColumn))
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

  const filteredAlgorithms = algorithms.filter(a => {
    if (!a.problem_types || a.problem_types.length === 0) return true
    return a.problem_types.includes(problemType)
  })

  const availableFeatures = columns.filter(c => c.name !== targetColumn)
  const visibleFeatures = featureSearch
    ? availableFeatures.filter(c => c.name.toLowerCase().includes(featureSearch.toLowerCase()))
    : availableFeatures

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="ML Engine & Model Training"
        subtitle="Automated end-to-end model training, hyperparameter presets, 5-fold cross-validation, and live inference testing"
        icon={<Cpu className="size-6 text-[var(--c-accent)]" />}
      />

      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--c-border)] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`btn btn-sm ${activeTab === 'single' ? 'btn-neon-solid' : 'btn-ghost'}`}
          >
            <Play className="size-3.5" />
            <span>Single Model Training</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`btn btn-sm ${activeTab === 'compare' ? 'btn-neon-solid' : 'btn-ghost'}`}
          >
            <GitCompare className="size-3.5" />
            <span>Benchmark & Compare All</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[var(--c-text-muted)]">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Scikit-Learn & MLflow Orchestration Active</span>
        </div>
      </div>

      {/* Mode Advisory Guidance Banner */}
      <div className="p-3.5 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] flex items-start gap-3">
        <Sparkles className="size-4 text-[var(--c-accent)] shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-[var(--c-text-primary)]">
            {activeTab === 'single' ? 'Single Model Optimization Mode' : 'Automated Benchmark & Leaderboard Mode'}
          </span>
          <p className="text-[var(--c-text-secondary)] mt-0.5 leading-relaxed">
            {activeTab === 'single'
              ? `Configured to train and tune ${ALGORITHM_DETAILS[algorithm]?.badge || algorithm} on ${selectedFeatures.length} features. Includes 5-fold cross-validation, confusion/residual diagnostics, and immediate live inference.`
              : `Enterprise Auto-Benchmark will train all ${filteredAlgorithms.length} candidate algorithms concurrently on your ${selectedFeatures.length} features and generate an enterprise leaderboard ranked by test performance.`}
          </p>
        </div>
      </div>

      {/* ── SMART RECOMMENDATIONS PANEL ── */}
      <AnimatePresence>
        {recommendations.length > 0 && selectedDatasetId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="cyber-card p-5"
          >
            <RecommendationPanel recommendations={recommendations} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 1: DATASET SELECTION & INSTANT PRESETS ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="cyber-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center size-6 rounded-full bg-[var(--c-accent)] text-white font-display font-black text-xs">
              1
            </span>
            <h3 className="font-display text-sm font-bold text-[var(--c-text-primary)] uppercase tracking-wider">
              Select Dataset & Explore Data
            </h3>
          </div>

          {/* Instant Quick-Pick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--c-text-muted)] uppercase">Quick Presets:</span>
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
                      ? 'border-[var(--c-accent)] bg-[var(--c-accent-light)] text-[var(--c-accent)] font-bold'
                      : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)] text-[var(--c-text-secondary)] hover:border-[var(--c-accent)]/30'
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
            <label className="form-label">
              Active Dataset in Repository <span className="text-[var(--c-accent)]">*</span>
            </label>
            <select
              value={selectedDatasetId}
              onChange={e => handleDatasetChange(e.target.value)}
              className="form-select font-mono text-xs"
              required
            >
              <option value="">Select dataset...</option>
              {datasets.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.filename} — ({(d.row_count ?? d.rows)?.toLocaleString() || '?'} rows × {d.column_count || '?'} cols)
                </option>
              ))}
            </select>
            {datasetMeta && (
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--c-text-muted)]">
                <span>Total Samples: <strong className="text-[var(--c-accent)]">{datasetMeta.row_count?.toLocaleString() || '?'}</strong></span>
                <span>•</span>
                <span>Features: <strong className="text-[var(--c-accent)]">{datasetMeta.column_count || columns.length}</strong></span>
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
                {showPreview ? <EyeOff className="size-3.5 text-[var(--c-accent)]" /> : <Eye className="size-3.5 text-[var(--c-accent)]" />}
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
              className="mt-4 p-4 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] overflow-x-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[var(--c-accent)]">Sample Records (First 5 Rows):</span>
                <span className="font-mono text-[10px] text-[var(--c-text-muted)]">Verified Cleaned Headers</span>
              </div>
              <table className="data-table text-xs font-mono">
                <thead>
                  <tr>
                    {Object.keys(previewRows[0] || {}).map(k => (
                      <th key={k} className="text-[var(--c-accent)] font-bold">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx}>{String(val)}</td>
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
            <span className="flex items-center justify-center size-6 rounded-full bg-[var(--c-accent)] text-white font-display font-black text-xs">
              2
            </span>
            <h3 className="font-display text-sm font-bold text-[var(--c-text-primary)] uppercase tracking-wider">
              Target Prediction Column & Input Features
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[var(--c-text-muted)]">Task Type:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--c-accent-light)] border border-[var(--c-accent)]/40 text-[var(--c-accent)] font-bold uppercase">
              {problemType}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Target Column Selector */}
          <div>
            <label className="form-label">
              Target Prediction Column (What to predict) <span className="text-[var(--c-accent)]">*</span>
            </label>
            {loadingCols ? (
              <div className="form-input flex items-center gap-2 text-xs text-[var(--c-text-muted)]">
                <div className="size-3 border-2 border-[var(--c-accent)] border-t-transparent rounded-full animate-spin" />
                Analyzing column types...
              </div>
            ) : (
              <select
                value={targetColumn}
                onChange={e => handleTargetChange(e.target.value)}
                className="form-select font-bold text-sm"
                disabled={!selectedDatasetId || columns.length === 0}
                required
              >
                <option value="">Select target column...</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {c.dtype ? `[${c.dtype}${c.unique_values ? `, ${c.unique_values} classes` : ''}]` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="font-mono text-[11px] text-[var(--c-text-muted)] mt-1.5">
              The target column is excluded from inputs and used as ground truth for supervised learning.
            </p>
          </div>

          {/* Task Type Explicit Override */}
          <div>
            <label className="form-label">Learning Task Formulation</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
              <button
                type="button"
                onClick={() => setProblemType('classification')}
                className={`py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                  problemType === 'classification'
                    ? 'bg-[var(--c-accent)] text-white shadow-md'
                    : 'text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)]'
                }`}
              >
                Classification (Categories)
              </button>
              <button
                type="button"
                onClick={() => setProblemType('regression')}
                className={`py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                  problemType === 'regression'
                    ? 'bg-[var(--c-accent)] text-white shadow-md'
                    : 'text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)]'
                }`}
              >
                Regression (Numbers)
              </button>
            </div>
            <p className="font-mono text-[11px] text-[var(--c-text-muted)] mt-1.5">
              {problemType === 'classification'
                ? 'Classification computes Accuracy, Precision, Recall, F1, and Confusion Matrix.'
                : 'Regression computes R², RMSE, MSE, and MAE continuous prediction metrics.'}
            </p>
          </div>
        </div>

        {/* Feature Columns Selection */}
        {selectedDatasetId && availableFeatures.length > 0 && (
          <div className="pt-5 border-t border-[var(--c-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label className="form-label !mb-0">Feature Columns (Model Inputs)</label>
                <p className="font-mono text-xs text-[var(--c-accent)]">
                  {selectedFeatures.length} of {availableFeatures.length} features selected
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectRecommendedFeatures}
                  className="btn btn-sm btn-neon-solid font-mono text-xs flex items-center gap-1.5 shadow-sm"
                  title="Auto-select optimal predictor features while excluding identifier and timestamp columns"
                >
                  <Sparkles className="size-3.5" />
                  <span>Auto-Select Best Features</span>
                </button>
                <div className="relative">
                  <Search className="size-3.5 text-[var(--c-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={featureSearch}
                    onChange={e => setFeatureSearch(e.target.value)}
                    placeholder="Search features..."
                    className="form-input pl-8 pr-3 py-1 text-xs font-mono !w-auto"
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAllFeatures}
                  className="btn btn-ghost btn-sm text-[var(--c-accent)] font-mono text-xs"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllFeatures}
                  className="btn btn-ghost btn-sm font-mono text-xs"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[240px] overflow-y-auto p-1 pr-2">
              {visibleFeatures.map(col => {
                const isSelected = selectedFeatures.includes(col.name)
                const isRisk = isHighRiskFeature(col.name, col)
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => toggleFeature(col.name)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent-light)] text-[var(--c-text-primary)]'
                        : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)] text-[var(--c-text-secondary)] hover:border-[var(--c-border-strong)]'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-[var(--c-accent)] shrink-0" />
                    ) : (
                      <Square className="size-4 text-[var(--c-text-muted)] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="font-mono text-xs font-semibold truncate">{col.name}</p>
                        {isRisk ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold shrink-0">
                            ID/Leak
                          </span>
                        ) : col.is_numeric ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                            ★ Signal
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-[var(--c-text-muted)] font-mono">
                        {col.is_numeric ? '🔢 Numeric' : '🔤 Categorical'}
                        {col.sample_values?.[0] ? ` · eg. ${col.sample_values[0]}` : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Feature recommendation advisory banner */}
            <div className="mt-3 p-3 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--c-text-secondary)]">
                <Lightbulb className="size-4 text-amber-500 shrink-0" />
                <span>
                  <strong className="text-[var(--c-text-primary)]">Feature Advice:</strong> Auto-Select filters out IDs and timestamps to prevent target leakage, while keeping high-signal predictive columns.
                </span>
              </div>
              <button
                type="button"
                onClick={selectRecommendedFeatures}
                className="text-[var(--c-accent)] hover:underline font-mono text-xs font-semibold shrink-0"
              >
                Apply Recommended Selection →
              </button>
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
                <span className="flex items-center justify-center size-6 rounded-full bg-[var(--c-accent)] text-white font-display font-black text-xs">
                  3
                </span>
                <h3 className="font-display text-sm font-bold text-[var(--c-text-primary)] uppercase tracking-wider">
                  Select Machine Learning Algorithm ({filteredAlgorithms.length} Available)
                </h3>
              </div>
              <span className="font-mono text-xs text-[var(--c-accent)] font-bold uppercase">
                Task: {problemType}
              </span>
            </div>

            {/* Recommended Algorithm Banner */}
            {algoRecommendation && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 flex items-start gap-3">
                <Award className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Recommended: {algoRecommendation.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--c-text-secondary)] mt-0.5">{algoRecommendation.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAlgorithm(algoRecommendation.id)
                    const dsObj = datasets.find(d => String(d.id) === selectedDatasetId)
                    const dsName = (dsObj?.name || dsObj?.filename || 'model')
                      .replace(/\.[^/.]+$/, '')
                      .replace(/[^a-zA-Z0-9_]/g, '_')
                    setModelName(`${algoRecommendation.id}_${dsName}`)
                  }}
                  className="btn btn-sm btn-success shrink-0 ml-auto"
                >
                  Use This
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredAlgorithms.map((a: AlgorithmMeta) => {
                const meta = ALGORITHM_DETAILS[a.id] || { badge: 'Standard', speed: 'Fast', highlight: a.description }
                const isSelected = algorithm === a.id
                const isRecommended = a.id === algoRecommendation?.id
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
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent-light)] shadow-[var(--shadow-glow)]'
                        : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)] hover:border-[var(--c-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                        isSelected ? 'bg-[var(--c-accent)] text-white font-black' : 'bg-[var(--c-bg-tertiary)] text-[var(--c-accent)]'
                      }`}>
                        {meta.badge}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isRecommended && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold uppercase">★ Best</span>
                        )}
                        <span className="font-mono text-[10px] text-[var(--c-text-muted)] flex items-center gap-1">
                          <Clock className="size-3" />{meta.speed}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-display text-sm font-bold text-[var(--c-text-primary)] mb-1 tracking-wide">{a.name}</h4>
                    <p className="font-mono text-xs text-[var(--c-text-secondary)] leading-relaxed">{meta.highlight}</p>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Hyperparameter Controls */}
          <div className="cyber-card p-6">
            <h3 className="font-display text-sm font-bold text-[var(--c-text-primary)] uppercase tracking-wider mb-5 flex items-center gap-2">
              <Sliders className="size-4 text-[var(--c-accent)]" />
              <span>Training Protocol & Validation Settings</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="form-label">Artifact Save Name</label>
                <input
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="form-input font-mono text-xs font-bold"
                  placeholder="e.g. rf_classifier_iris"
                  required
                />
              </div>

              <div>
                <label className="form-label">Evaluation Test Split</label>
                <select
                  value={testSize}
                  onChange={e => setTestSize(e.target.value)}
                  className="form-select font-mono text-xs"
                >
                  <option value="0.1">10% Test / 90% Train</option>
                  <option value="0.2">20% Test / 80% Train (Standard)</option>
                  <option value="0.25">25% Test / 75% Train</option>
                  <option value="0.3">30% Test / 70% Train</option>
                </select>
              </div>

              <div>
                <label className="form-label">Optimization Preset</label>
                <select
                  value={hyperPreset}
                  onChange={e => setHyperPreset(e.target.value as any)}
                  className="form-select font-mono text-xs"
                >
                  <option value="accuracy">High Accuracy (Deep Ensemble)</option>
                  <option value="standard">Balanced Production</option>
                  <option value="fast">Fast Lightweight Baseline</option>
                </select>
              </div>

              <div>
                <label className="form-label">5-Fold Cross Validation</label>
                <button
                  type="button"
                  onClick={() => setCrossValidation(!crossValidation)}
                  className={`w-full p-2.5 rounded-xl border font-mono text-xs font-bold transition-all flex items-center justify-between ${
                    crossValidation
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)]'
                  }`}
                >
                  <span>{crossValidation ? 'ENABLED (Stratified)' : 'DISABLED'}</span>
                  <CheckCircle className={`size-4 ${crossValidation ? 'opacity-100 text-emerald-500' : 'opacity-25'}`} />
                </button>
              </div>
            </div>

            {/* Launch Action Bar */}
            <div className="mt-6 pt-5 border-t border-[var(--c-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--c-text-secondary)]">
                <ShieldCheck className="size-4 text-emerald-500" />
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
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

            {/* ── ORCHESTRATION PIPELINE DAG ── */}
            <div className="mt-6 pt-5 border-t border-[var(--c-border)]">
              <PipelineFlowDAG
                datasetName={datasets.find(d => String(d.id) === selectedDatasetId)?.name || 'Dataset'}
                rowCount={datasetMeta?.row_count || 150}
                featureCount={selectedFeatures.length}
                targetColumn={targetColumn}
                algorithmName={ALGORITHM_DETAILS[algorithm]?.badge || algorithm}
                crossValidation={crossValidation}
                isTraining={training}
                isCompleted={!!result && !result.error}
                metrics={result?.metrics ? {
                  accuracy: result.metrics.accuracy,
                  f1_score: result.metrics.f1,
                  r2_score: result.metrics.r2,
                  rmse: result.metrics.rmse,
                  duration: result.training_time_seconds,
                } : undefined}
              />
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
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 font-mono text-xs flex items-center gap-3">
                    <span className="font-bold">TRAINING NOTICE:</span> {result.error}
                  </div>
                ) : (
                  <>
                    {/* Header Summary Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--c-border)]">
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                          <CheckCircle className="size-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                              Production Model Ready
                            </span>
                            <span className="font-mono text-xs text-[var(--c-text-secondary)]">
                              {result.training_samples} training / {result.test_samples} test records
                            </span>
                          </div>
                          <h3 className="font-display text-2xl font-black text-[var(--c-text-primary)] tracking-wide">
                            {result.model_name || result.modelName}
                          </h3>
                          <p className="font-mono text-xs text-[var(--c-text-secondary)] mt-0.5">
                            Algorithm: <strong className="text-[var(--c-accent)] uppercase">{result.algorithm}</strong>
                            {' · '}Target Goal: <strong className="text-[var(--c-text-primary)]">{result.target_column}</strong>
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
                        <h4 className="font-display text-xs font-bold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                          <BarChart3 className="size-4 text-[var(--c-accent)]" />
                          <span>Performance Validation Scores</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                          {Object.entries(result.metrics)
                            .filter(([k, v]) => typeof v === 'number' || (typeof v === 'string' && k !== 'confusion_matrix'))
                            .map(([k, v]) => (
                              <div key={k} className="p-4 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
                                <p className="font-mono text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider mb-1">
                                  {k.replace(/_/g, ' ')}
                                </p>
                                <p className="font-display text-2xl font-black text-[var(--c-accent)]">
                                  {typeof v === 'number' ? (
                                    ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].includes(k) ? (
                                      <AnimatedCounter value={v * 100} decimals={1} suffix="%" />
                                    ) : (
                                      <AnimatedCounter value={v} decimals={4} />
                                    )
                                  ) : (
                                    String(v)
                                  )}
                                </p>
                              </div>
                            ))}

                          {result.cv_mean != null && (
                            <div className="p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
                              <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                                5-Fold Mean Accuracy
                              </p>
                              <p className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                <AnimatedCounter value={result.cv_mean * 100} decimals={1} suffix="%" />
                              </p>
                              {result.cv_std != null && (
                                <span className="font-mono text-[10px] text-[var(--c-text-muted)]">±{(result.cv_std * 100).toFixed(1)}% std</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Confusion Matrix Visualization */}
                    {result.metrics?.confusion_matrix && (
                      <div className="p-5 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-display text-xs font-bold text-[var(--c-text-primary)] uppercase tracking-wider flex items-center gap-2">
                            <Layers className="size-4 text-[var(--c-accent)]" />
                            <span>Confusion Matrix (Ground Truth vs Prediction)</span>
                          </h4>
                          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            Diagonal = Correct True Positives
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="font-mono text-xs border-collapse">
                            <thead>
                              <tr>
                                <th className="p-2 text-[var(--c-text-muted)] text-left">Actual \ Predicted</th>
                                {(result.metrics.class_labels || result.metrics.confusion_matrix.map((_: any, i: number) => `Class ${i}`)).map((label: string) => (
                                  <th key={label} className="p-2 text-[var(--c-accent)] text-center font-bold">
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
                                    <td className="p-2 text-[var(--c-text-primary)] font-bold">{rowLabel}</td>
                                    {row.map((val: number, colIdx: number) => {
                                      const isDiagonal = rowIdx === colIdx
                                      return (
                                        <td
                                          key={colIdx}
                                          className={`p-3 text-center rounded-lg font-mono font-bold text-sm ${
                                            isDiagonal
                                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                                              : val > 0
                                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                                              : 'bg-[var(--c-bg-tertiary)] text-[var(--c-text-muted)]'
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
                      <div className="p-5 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-xs font-bold text-[var(--c-text-primary)] uppercase tracking-wider flex items-center gap-2">
                            <Layers className="size-4 text-[var(--c-accent)]" />
                            <span>Regression Fit (Actual vs Predicted Values)</span>
                          </h4>
                          <span className="font-mono text-xs text-[var(--c-accent)] font-bold">
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
                        <h4 className="font-display text-xs font-bold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Sparkles className="size-4 text-[var(--c-accent)]" />
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
                                    <span className="text-[var(--c-text-primary)] font-medium">{feat}</span>
                                    <span className="text-[var(--c-accent)] font-bold">{pct}% weight</span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-[var(--c-bg-tertiary)] overflow-hidden border border-[var(--c-border)]">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                      style={{ width: `${Math.max(pct, 4)}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* ── INTERACTIVE LIVE INFERENCE PLAYGROUND ── */}
                    <LiveInferencePlayground
                      modelName={result.model_name || result.modelName || `${algorithm}_model`}
                      algorithmName={ALGORITHM_DETAILS[algorithm]?.badge || algorithm}
                      problemType={problemType}
                      features={selectedFeatures}
                      columns={columns}
                      initialInputs={testInputs}
                    />
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
                <h3 className="font-display text-lg font-bold text-[var(--c-text-primary)] tracking-wide flex items-center gap-2">
                  <GitCompare className="size-5 text-[var(--c-accent)]" />
                  <span>Automated Multi-Algorithm Benchmark</span>
                </h3>
                <p className="font-mono text-xs text-[var(--c-text-secondary)] mt-1">
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
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 font-mono text-xs">
                    {compareResult.error}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-4">
                      <div>
                        <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold">
                          Multi-Model Benchmark Completed
                        </span>
                        <h3 className="font-display text-lg font-bold text-[var(--c-text-primary)] mt-0.5">
                          Best Performing Algorithm: <span className="text-[var(--c-accent)] uppercase">{compareResult.best_algorithm}</span>
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-[var(--c-text-secondary)]">
                        {compareResult.training_samples} training / {compareResult.test_samples} test records
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="data-table font-mono text-xs">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Algorithm</th>
                            <th>Accuracy / R²</th>
                            <th>Precision</th>
                            <th>Recall</th>
                            <th>F1 Score</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareResult.comparisons?.map((c: any, idx: number) => {
                            const isBest = idx === 0 && c.status === 'success'
                            const m = c.metrics || {}
                            const primaryMetric = m.accuracy != null ? m.accuracy : m.r2
                            return (
                              <tr key={c.algorithm} className={isBest ? 'bg-[var(--c-accent-light)] font-semibold' : ''}>
                                <td>
                                  {isBest ? (
                                    <span className="px-2 py-0.5 rounded-full bg-[var(--c-accent)] text-white font-bold text-[10px]">
                                      #1 BEST
                                    </span>
                                  ) : (
                                    `#${idx + 1}`
                                  )}
                                </td>
                                <td className="font-display text-[var(--c-text-primary)] uppercase tracking-wider">
                                  {c.algorithm.replace(/_/g, ' ')}
                                </td>
                                <td>
                                  <span className="font-bold text-[var(--c-accent)] text-sm">
                                    {primaryMetric != null ? `${(primaryMetric * 100).toFixed(1)}%` : '—'}
                                  </span>
                                </td>
                                <td className="text-[var(--c-text-secondary)]">
                                  {m.precision != null ? `${(m.precision * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td className="text-[var(--c-text-secondary)]">
                                  {m.recall != null ? `${(m.recall * 100).toFixed(1)}%` : '—'}
                                </td>
                                <td className="text-[var(--c-text-secondary)]">
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
