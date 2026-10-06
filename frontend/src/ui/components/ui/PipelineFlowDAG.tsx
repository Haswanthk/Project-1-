import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Sliders,
  Layers,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'

export interface PipelineStage {
  id: string
  label: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  status: 'idle' | 'running' | 'completed' | 'error'
  detail: string
  metrics?: Record<string, string | number>
}

interface PipelineFlowDAGProps {
  datasetName: string
  rowCount: number
  featureCount: number
  targetColumn: string
  algorithmName: string
  crossValidation: boolean
  isTraining: boolean
  isCompleted: boolean
  metrics?: {
    accuracy?: number
    f1_score?: number
    r2_score?: number
    rmse?: number
    duration?: number
  }
}

export function PipelineFlowDAG({
  datasetName,
  rowCount,
  featureCount,
  targetColumn,
  algorithmName,
  crossValidation,
  isTraining,
  isCompleted,
  metrics,
}: PipelineFlowDAGProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  // Simulation of stage progression when training is active
  useEffect(() => {
    if (!isTraining) {
      if (isCompleted) {
        setActiveStageIndex(5)
      } else {
        setActiveStageIndex(0)
      }
      return
    }

    const interval = setInterval(() => {
      setActiveStageIndex(prev => (prev < 4 ? prev + 1 : prev))
    }, 600)

    return () => clearInterval(interval)
  }, [isTraining, isCompleted])

  const stages: PipelineStage[] = [
    {
      id: 'ingestion',
      label: 'Ingestion',
      subtitle: `${rowCount > 0 ? rowCount.toLocaleString() : '—'} Samples`,
      icon: Database,
      status: isCompleted ? 'completed' : isTraining && activeStageIndex >= 0 ? (activeStageIndex === 0 ? 'running' : 'completed') : 'idle',
      detail: `Verified raw input schema for ${datasetName || 'dataset'}. Validated column headers.`,
      metrics: { 'Samples': rowCount || 0, 'Target': targetColumn || 'Auto' },
    },
    {
      id: 'cleaning',
      label: 'Imputation',
      subtitle: 'Mean / Mode',
      icon: Sliders,
      status: isCompleted ? 'completed' : isTraining && activeStageIndex >= 1 ? (activeStageIndex === 1 ? 'running' : 'completed') : 'idle',
      detail: 'Null values imputed; zero-variance features verified; categoricals encoded via One-Hot encoding.',
      metrics: { 'Imputer': 'SimpleImputer', 'Encoding': 'OneHot/Standard' },
    },
    {
      id: 'features',
      label: 'Features',
      subtitle: `${featureCount} Predictors`,
      icon: Layers,
      status: isCompleted ? 'completed' : isTraining && activeStageIndex >= 2 ? (activeStageIndex === 2 ? 'running' : 'completed') : 'idle',
      detail: `${featureCount} features transformed into numerical tensor matrices. Identifier leakage filtered.`,
      metrics: { 'Dimensions': featureCount, 'Scaling': 'StandardScaler' },
    },
    {
      id: 'training',
      label: 'Model Fit',
      subtitle: algorithmName.replace(/_/g, ' '),
      icon: Cpu,
      status: isCompleted ? 'completed' : isTraining && activeStageIndex >= 3 ? (activeStageIndex === 3 ? 'running' : 'completed') : 'idle',
      detail: `Gradient loss minimization with hyperparameter optimization on training partition.`,
      metrics: {
        'Algorithm': algorithmName,
        'Duration': metrics?.duration ? `${metrics.duration.toFixed(2)}s` : 'Fast',
      },
    },
    {
      id: 'validation',
      label: 'Validation',
      subtitle: crossValidation ? '5-Fold CV' : 'Holdout Test',
      icon: ShieldCheck,
      status: isCompleted ? 'completed' : isTraining && activeStageIndex >= 4 ? (activeStageIndex === 4 ? 'running' : 'completed') : 'idle',
      detail: crossValidation
        ? '5-Fold cross-validation across stratified partitions to verify out-of-sample generalization.'
        : 'Out-of-sample holdout test partition evaluation.',
      metrics: {
        ...(metrics?.accuracy !== undefined && { 'Accuracy': `${(metrics.accuracy * 100).toFixed(1)}%` }),
        ...(metrics?.f1_score !== undefined && { 'F1': metrics.f1_score.toFixed(3) }),
        ...(metrics?.r2_score !== undefined && { 'R²': metrics.r2_score.toFixed(3) }),
        ...(metrics?.rmse !== undefined && { 'RMSE': metrics.rmse.toFixed(3) }),
      },
    },
    {
      id: 'artifact',
      label: 'Artifact',
      subtitle: 'Pickle & MLflow',
      icon: CheckCircle2,
      status: isCompleted ? 'completed' : 'idle',
      detail: 'Model serialized and logged with parameter metadata. Ready for real-time low-latency inference.',
      metrics: { 'Format': '.pkl / Joblib', 'Status': isCompleted ? 'Production Ready' : 'Pending' },
    },
  ]

  const activeNode = stages.find(s => s.id === selectedNode) || stages[activeStageIndex] || stages[0]

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg-secondary)] p-4 sm:p-5 relative overflow-hidden">
      {/* Background Flow Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--c-accent)]/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[var(--c-accent-light)] text-[var(--c-accent)] border border-[var(--c-accent)]/20">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--c-text-primary)] uppercase tracking-wider font-mono">
              End-to-End Orchestration DAG
            </h4>
            <p className="text-[11px] text-[var(--c-text-muted)]">
              Interactive pipeline topology with live stage execution telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTraining && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-mono font-bold animate-pulse">
              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
              Pipeline Executing...
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
              <CheckCircle2 className="size-3.5" />
              Pipeline Converged
            </div>
          )}
        </div>
      </div>

      {/* DAG Nodes Flow */}
      <div className="relative">
        {/* Animated Connecting Line on Desktop */}
        <div className="hidden lg:block absolute top-[28px] left-8 right-8 h-[2px] bg-[var(--c-border)] z-0">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--c-accent)] via-cyan-400 to-emerald-400"
            animate={{
              width: isCompleted ? '100%' : isTraining ? `${((activeStageIndex + 1) / stages.length) * 100}%` : '20%',
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        {/* Nodes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
          {stages.map((stage) => {
            const Icon = stage.icon
            const isCurrent = isTraining && stage.status === 'running'
            const isDone = stage.status === 'completed'
            const isSelected = selectedNode === stage.id

            return (
              <motion.button
                key={stage.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedNode(stage.id)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                  isSelected
                    ? 'border-[var(--c-accent)] bg-[var(--c-accent-light)] shadow-[var(--shadow-glow)]'
                    : isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                    : isCurrent
                    ? 'border-[var(--c-accent)] bg-[var(--c-bg-tertiary)] ring-2 ring-[var(--c-accent)]/20'
                    : 'border-[var(--c-border)] bg-[var(--c-bg-card)] hover:border-[var(--c-border-strong)]'
                }`}
              >
                {/* Node Top Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${
                    isDone
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-[var(--c-accent)] text-white animate-spin'
                      : 'bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)] border border-[var(--c-border)]'
                  }`}>
                    {isCurrent ? <Clock className="size-3.5" /> : <Icon className="size-3.5" />}
                  </div>

                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    isDone
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : isCurrent
                      ? 'bg-amber-500/15 text-amber-500 animate-pulse'
                      : 'bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)]'
                  }`}>
                    {stage.status}
                  </span>
                </div>

                {/* Node Details */}
                <div>
                  <h5 className="font-mono text-xs font-bold text-[var(--c-text-primary)] truncate">
                    {stage.label}
                  </h5>
                  <p className="font-mono text-[10px] text-[var(--c-text-muted)] truncate mt-0.5">
                    {stage.subtitle}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Node Telemetry Inspection Bar */}
      <AnimatePresence mode="wait">
        {activeNode && (
          <motion.div
            key={activeNode.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 p-3.5 rounded-xl bg-[var(--c-bg-card)] border border-[var(--c-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Info className="size-4 text-[var(--c-accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-mono font-bold text-[var(--c-text-primary)]">
                  {activeNode.label} Inspection:
                </span>
                <p className="text-[var(--c-text-secondary)] mt-0.5 font-mono text-[11px] leading-relaxed">
                  {activeNode.detail}
                </p>
              </div>
            </div>

            {/* Quick Metrics Chips */}
            {activeNode.metrics && Object.keys(activeNode.metrics).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {Object.entries(activeNode.metrics).map(([k, v]) => (
                  <div key={k} className="px-2.5 py-1 rounded-lg bg-[var(--c-bg-secondary)] border border-[var(--c-border)] font-mono text-[11px]">
                    <span className="text-[var(--c-text-muted)] mr-1.5">{k}:</span>
                    <span className="font-bold text-[var(--c-accent)]">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
