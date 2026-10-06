import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  Brain,
  Play,
  Target,
  LineChart,
  AlertTriangle,
  FileText,
  Settings,
  Sun,
  Moon,
  Upload,
  BarChart2,
  Cpu,
  Radio,
  Folder,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navigation' | 'Actions' | 'Quick Presets'
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  currentTheme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function CommandPalette({ isOpen, onClose, currentTheme, onToggleTheme }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items: CommandItem[] = useMemo(() => [
    // Actions
    {
      id: 'action-theme',
      title: currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      subtitle: 'Instantly toggle workspace visual appearance',
      category: 'Actions',
      icon: currentTheme === 'dark' ? Sun : Moon,
      badge: 'Theme',
      action: () => {
        onToggleTheme()
        onClose()
      },
    },
    {
      id: 'action-quick-train',
      title: 'Run Quick Iris ML Benchmark',
      subtitle: 'Navigate to Training & test Scikit-Learn models',
      category: 'Actions',
      icon: Sparkles,
      badge: 'Quick Action',
      action: () => {
        navigate('/training')
        onClose()
      },
    },
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Dashboard Overview',
      subtitle: 'Operational health, models, and real-time telemetry',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => { navigate('/dashboard'); onClose() },
    },
    {
      id: 'nav-training',
      title: 'ML Engine & Training',
      subtitle: 'Train algorithms, run 5-fold CV, and live predictions',
      category: 'Navigation',
      icon: Play,
      badge: 'Core',
      action: () => { navigate('/training'); onClose() },
    },
    {
      id: 'nav-predictions',
      title: 'Predictions & Inference',
      subtitle: 'Batch inference and real-time scoring',
      category: 'Navigation',
      icon: Target,
      action: () => { navigate('/predictions'); onClose() },
    },
    {
      id: 'nav-models',
      title: 'ML Models & Artifacts',
      subtitle: 'Trained model library and versioning',
      category: 'Navigation',
      icon: Brain,
      action: () => { navigate('/ml-models'); onClose() },
    },
    {
      id: 'nav-analytics',
      title: 'Business Analytics',
      subtitle: 'Revenue, cohorts, and KPI reporting',
      category: 'Navigation',
      icon: BarChart2,
      action: () => { navigate('/analytics'); onClose() },
    },
    {
      id: 'nav-forecast',
      title: 'Time-Series Forecasting',
      subtitle: 'ARIMA, Prophet, and trend predictions',
      category: 'Navigation',
      icon: LineChart,
      action: () => { navigate('/forecast'); onClose() },
    },
    {
      id: 'nav-anomaly',
      title: 'Anomaly Detection',
      subtitle: 'Isolation Forest & outlier monitoring',
      category: 'Navigation',
      icon: AlertTriangle,
      action: () => { navigate('/anomaly'); onClose() },
    },
    {
      id: 'nav-spark',
      title: 'Spark Jobs Orchestrator',
      subtitle: 'Distributed PySpark compute clusters',
      category: 'Navigation',
      icon: Cpu,
      action: () => { navigate('/spark-jobs'); onClose() },
    },
    {
      id: 'nav-streaming',
      title: 'Real-Time Streaming',
      subtitle: 'Kafka & WebSocket event feeds',
      category: 'Navigation',
      icon: Radio,
      action: () => { navigate('/streaming'); onClose() },
    },
    {
      id: 'nav-upload',
      title: 'Dataset Upload',
      subtitle: 'Upload CSV, Parquet, or JSON tabular data',
      category: 'Navigation',
      icon: Upload,
      action: () => { navigate('/dataset-upload'); onClose() },
    },
    {
      id: 'nav-reports',
      title: 'Executive PDF Reports',
      subtitle: 'Download system summaries and metric audits',
      category: 'Navigation',
      icon: FileText,
      action: () => { navigate('/reports'); onClose() },
    },
    {
      id: 'nav-projects',
      title: 'Projects Workspace',
      subtitle: 'Multi-tenant organization and datasets',
      category: 'Navigation',
      icon: Folder,
      action: () => { navigate('/projects'); onClose() },
    },
    {
      id: 'nav-settings',
      title: 'Platform Settings',
      subtitle: 'Security, theme, API keys, and preferences',
      category: 'Navigation',
      icon: Settings,
      action: () => { navigate('/settings'); onClose() },
    },
  ], [currentTheme, navigate, onClose, onToggleTheme])

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [items, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl rounded-2xl bg-[var(--c-bg-elevated)] border border-[var(--c-border-strong)] shadow-[var(--shadow-card)] overflow-hidden flex flex-col max-h-[75vh] z-10"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--c-border)]">
              <Search className="size-5 text-[var(--c-accent)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type a command, search modules, or toggle settings..."
                className="w-full bg-transparent text-sm font-medium text-[var(--c-text-primary)] placeholder-[var(--c-text-muted)] focus:outline-none"
              />
              <kbd className="px-2 py-0.5 rounded bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-[10px] font-mono text-[var(--c-text-muted)] shrink-0">
                ESC
              </kbd>
            </div>

            {/* Command Results List */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--c-text-muted)]">
                  No matching commands found for "{query}".
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-150 ${
                        isSelected
                          ? 'bg-[var(--c-accent-light)] border border-[var(--c-accent)]/30 text-[var(--c-text-primary)]'
                          : 'border border-transparent text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${
                          isSelected
                            ? 'bg-[var(--c-accent)] text-white shadow-sm'
                            : 'bg-[var(--c-bg-secondary)] text-[var(--c-text-muted)] border border-[var(--c-border)]'
                        }`}>
                          <Icon className="size-4 shrink-0" />
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="text-xs font-semibold truncate leading-tight text-[var(--c-text-primary)]">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-[11px] text-[var(--c-text-muted)] truncate mt-0.5 font-normal">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-[var(--c-accent)] font-bold">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--c-text-muted)] uppercase tracking-wider font-mono">
                          {item.category}
                        </span>
                        {isSelected && (
                          <ArrowRight className="size-3.5 text-[var(--c-accent)]" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer Bar */}
            <div className="px-4 py-2.5 border-t border-[var(--c-border)] bg-[var(--c-bg-secondary)] flex items-center justify-between text-[11px] font-mono text-[var(--c-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.2 rounded bg-[var(--c-bg-tertiary)] border border-[var(--c-border)] text-[9px]">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.2 rounded bg-[var(--c-bg-tertiary)] border border-[var(--c-border)] text-[9px]">↵</kbd> Select
                </span>
              </div>
              <span className="text-[10px] text-[var(--c-accent)] font-bold">Enterprise Command Center</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
