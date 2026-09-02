import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { LineChart, Play, BarChart3 } from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { ChartSkeleton } from '../components/ui/LoadingSkeleton'

export function ForecastPage() {
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [selectedAlgo, setSelectedAlgo] = useState('linear')
  const [metric, setMetric] = useState('revenue')
  const [periods, setPeriods] = useState(12)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [algoLoading, setAlgoLoading] = useState(true)

  useEffect(() => {
    apiClient.get('/forecast/algorithms').then(r => { setAlgorithms(r.data); setAlgoLoading(false) }).catch(() => setAlgoLoading(false))
  }, [])

  const runForecast = async () => {
    setLoading(true)
    try {
      const r = await apiClient.post('/forecast/run', { metric, periods, algorithm: selectedAlgo })
      setResult(r.data)
    } catch {}
    setLoading(false)
  }

  const forecastChart = result ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0f172a', borderColor: '#1e293b', textStyle: { color: '#e2e8f0' } },
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category' as const, data: [...(result.historical_dates || []), ...(result.forecast_dates || [])], axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Historical', data: [...(result.historical_values || []), ...Array(result.forecast_values?.length || 0).fill(null)], type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#6366f1', width: 2.5 }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.2)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } } },
      { name: 'Forecast', data: [...Array(result.historical_values?.length || 0).fill(null), ...(result.forecast_values || [])], type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { color: '#f59e0b', width: 2.5, type: 'dashed' as const }, areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.15)' }, { offset: 1, color: 'rgba(245,158,11,0)' }] } } },
      { name: 'Upper CI', data: [...Array(result.historical_values?.length || 0).fill(null), ...(result.confidence_upper || [])], type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      { name: 'Lower CI', data: [...Array(result.historical_values?.length || 0).fill(null), ...(result.confidence_lower || [])], type: 'line' as const, smooth: true, symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(245,158,11,0.06)' } },
    ],
  } : null

  return (
    <div className="p-6 space-y-7">
      <PageHeader title="Forecasting" subtitle="Time-series forecasting with multiple algorithms" icon={<LineChart className="size-6" />} />

      {/* Config Panel */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4">Forecast Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Metric</label>
            <select value={metric} onChange={e => setMetric(e.target.value)} className="form-select">
              <option value="revenue">Revenue</option>
              <option value="users">Active Users</option>
              <option value="orders">Orders</option>
              <option value="churn">Churn Rate</option>
            </select>
          </div>
          <div>
            <label className="form-label">Algorithm</label>
            <select value={selectedAlgo} onChange={e => setSelectedAlgo(e.target.value)} className="form-select">
              {algoLoading ? <option>Loading...</option> : algorithms.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Forecast Periods</label>
            <input type="number" value={periods} onChange={e => setPeriods(+e.target.value)} min={1} max={52} className="form-input" />
          </div>
          <div className="flex items-end">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={runForecast} disabled={loading} className="btn btn-primary w-full">
              {loading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="size-4" />}
              {loading ? 'Running...' : 'Run Forecast'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Algorithms */}
      {!algoLoading && algorithms.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {algorithms.map((a: any) => (
            <div key={a.id} onClick={() => setSelectedAlgo(a.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedAlgo === a.id ? 'border-indigo-500/30 bg-indigo-500/8 shadow-sm shadow-indigo-500/10' : 'border-[var(--c-border)] bg-[var(--c-bg-elevated)] hover:border-[var(--c-border-strong)]'}`}>
              <div className="flex items-center gap-2 mb-2"><BarChart3 className="size-4 text-indigo-400" /><span className="text-sm font-semibold">{a.name}</span></div>
              <p className="text-xs text-[var(--c-text-secondary)]">{a.description}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Result Chart */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Forecast Results</h3>
            <div className="flex items-center gap-3 text-xs text-[var(--c-text-secondary)]">
              {result.metrics && Object.entries(result.metrics).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded-lg bg-[var(--c-bg-secondary)]">{k}: <strong>{typeof v === 'number' ? v.toFixed(3) : String(v)}</strong></span>
              ))}
            </div>
          </div>
          {forecastChart ? <ReactECharts option={forecastChart} style={{ height: 400 }} /> : <ChartSkeleton height="400px" />}
        </motion.div>
      )}
    </div>
  )
}
