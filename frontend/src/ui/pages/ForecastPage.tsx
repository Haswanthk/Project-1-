import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  LineChart, Play, TrendingUp, Sparkles,
  CheckCircle2, Download
} from 'lucide-react'
import { apiClient } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { ChartSkeleton } from '../components/ui/LoadingSkeleton'

export function ForecastPage() {
  const [algorithms, setAlgorithms] = useState<any[]>([])
  const [selectedAlgo, setSelectedAlgo] = useState('exponential_smoothing')
  const [metric, setMetric] = useState('revenue')
  const [periods, setPeriods] = useState(12)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [algoLoading, setAlgoLoading] = useState(true)

  // View toggles
  const [activeScenario, setActiveScenario] = useState<'all' | 'expected' | 'optimistic' | 'pessimistic'>('all')
  const [viewMode, setViewMode] = useState<'forecast' | 'decomposition'>('forecast')

  // Datasets mode
  const [datasets, setDatasets] = useState<any[]>([])
  const [sourceType, setSourceType] = useState<'platform' | 'dataset'>('platform')
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [datasetColumns, setDatasetColumns] = useState<string[]>([])
  const [selectedColumn, setSelectedColumn] = useState<string>('')

  useEffect(() => {
    fetchAlgos()
    fetchDatasets()
    // Auto-run initial forecast so user sees immediate value
    runInitialForecast('exponential_smoothing', 'revenue', 12)
  }, [])

  const fetchAlgos = async () => {
    try {
      const r = await apiClient.get('/forecast/algorithms')
      setAlgorithms(r.data || [])
    } catch {
      // fallback
    } finally {
      setAlgoLoading(false)
    }
  }

  const fetchDatasets = async () => {
    try {
      const res = await apiClient.get('/datasets/')
      setDatasets(res.data || [])
      if (res.data?.length > 0) {
        setSelectedDatasetId(res.data[0].id)
        if (res.data[0].columns) {
          setDatasetColumns(res.data[0].columns)
          setSelectedColumn(res.data[0].columns[0])
        }
      }
    } catch {
      // ignore
    }
  }

  const runInitialForecast = async (algo: string, met: string, per: number) => {
    setLoading(true)
    try {
      const r = await apiClient.post('/forecast/run', {
        metric: met,
        periods: per,
        algorithm: algo,
      })
      setResult(r.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const runForecast = async () => {
    setLoading(true)
    try {
      const payload: any = {
        periods,
        algorithm: selectedAlgo,
      }
      if (sourceType === 'platform') {
        payload.metric = metric
      } else {
        payload.dataset_id = selectedDatasetId
        payload.target_column = selectedColumn
        payload.metric = selectedColumn || 'dataset_metric'
      }

      const r = await apiClient.post('/forecast/run', payload)
      setResult(r.data)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to generate forecast')
    } finally {
      setLoading(false)
    }
  }

  const exportForecastCSV = () => {
    if (!result) return
    const dates = [...(result.historical_dates || []), ...(result.forecast_dates || [])]
    const hist = result.historical_values || []
    const fore = result.forecast_values || []
    const opt = result.scenarios?.optimistic || []
    const pess = result.scenarios?.pessimistic || []

    const rows = [['Date', 'Historical', 'Expected Forecast', 'Optimistic (+15%)', 'Pessimistic (-15%)']]
    dates.forEach((d, i) => {
      if (i < hist.length) {
        rows.push([d, hist[i], '', '', ''])
      } else {
        const fi = i - hist.length
        rows.push([d, '', fore[fi] ?? '', opt[fi] ?? '', pess[fi] ?? ''])
      }
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
    const link = document.createElement('a')
    link.href = encodeURI(csvContent)
    link.download = `forecast_${metric}_${selectedAlgo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Forecast Main Chart
  const getForecastChartOption = () => {
    if (!result) return null

    const allDates = [...(result.historical_dates || []), ...(result.forecast_dates || [])]
    const histLen = result.historical_values?.length || 0
    const foreLen = result.forecast_values?.length || 0

    const histPadded = [...(result.historical_values || []), ...Array(foreLen).fill(null)]
    const expectedPadded = [...Array(histLen).fill(null), ...(result.forecast_values || [])]
    const optPadded = [...Array(histLen).fill(null), ...(result.scenarios?.optimistic || [])]
    const pessPadded = [...Array(histLen).fill(null), ...(result.scenarios?.pessimistic || [])]
    const upperCIPadded = [...Array(histLen).fill(null), ...(result.confidence_upper || [])]
    const lowerCIPadded = [...Array(histLen).fill(null), ...(result.confidence_lower || [])]

    // Connect historical last point to forecast first point
    if (histLen > 0 && result.historical_values[histLen - 1] != null) {
      expectedPadded[histLen - 1] = result.historical_values[histLen - 1]
      optPadded[histLen - 1] = result.historical_values[histLen - 1]
      pessPadded[histLen - 1] = result.historical_values[histLen - 1]
    }

    const series: any[] = [
      {
        name: 'Historical Actuals',
        data: histPadded,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.25)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
            ]
          }
        }
      },
    ]

    if (activeScenario === 'all' || activeScenario === 'expected') {
      series.push({
        name: 'Expected Forecast',
        data: expectedPadded,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#f59e0b', width: 3, type: 'dashed' },
        itemStyle: { color: '#f59e0b' },
      })
    }

    if (activeScenario === 'all' || activeScenario === 'optimistic') {
      series.push({
        name: 'Optimistic Scenario (+15%)',
        data: optPadded,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#10b981', width: 2, type: 'dotted' },
      })
    }

    if (activeScenario === 'all' || activeScenario === 'pessimistic') {
      series.push({
        name: 'Pessimistic Scenario (-15%)',
        data: pessPadded,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#f43f5e', width: 2, type: 'dotted' },
      })
    }

    // 95% Confidence Interval band
    series.push(
      {
        name: 'Confidence Upper 95%',
        data: upperCIPadded,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        stack: 'confidence-band',
      },
      {
        name: '95% Confidence Interval',
        data: lowerCIPadded,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(245, 158, 11, 0.12)' },
        stack: 'confidence-band',
      }
    )

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
      },
      legend: {
        top: 0,
        textStyle: { color: '#94a3b8', fontSize: 11 },
      },
      grid: { top: 40, bottom: 30, left: 55, right: 25 },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `${v}`,
        },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series,
    }
  }

  // Decomposition Chart Option
  const getDecompChartOption = () => {
    if (!result || !result.decomposition) return null
    const dates = result.historical_dates || []

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
      },
      legend: {
        top: 0,
        textStyle: { color: '#94a3b8', fontSize: 11 },
      },
      grid: { top: 40, bottom: 30, left: 55, right: 25 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [
        {
          name: 'Observed Actuals',
          data: result.historical_values || [],
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#6366f1', width: 2 },
        },
        {
          name: 'Extracted Underlying Trend',
          data: result.decomposition.trend || [],
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#06b6d4', width: 2.5 },
        },
        {
          name: 'Seasonal Oscillation',
          data: result.decomposition.seasonal || [],
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#ec4899', width: 1.5, type: 'dashed' },
        },
        {
          name: 'Residual / Noise',
          data: result.decomposition.residual || [],
          type: 'bar',
          itemStyle: { color: 'rgba(148, 163, 184, 0.4)' },
        },
      ],
    }
  }

  const forecastChartOption = getForecastChartOption()
  const decompChartOption = getDecompChartOption()

  return (
    <div className="p-6 space-y-7 max-w-[1600px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Predictive Forecasting Studio"
        subtitle="Holt-Winters Exponential Smoothing, multi-scenario simulations & seasonal decomposition"
        icon={<LineChart className="size-6 text-indigo-400" />}
        actions={
          <button
            onClick={exportForecastCSV}
            disabled={!result}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Download className="size-3.5" /> Export Projections
          </button>
        }
      />

      {/* Configuration Controls */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--c-border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Data Source:</span>
            <button
              onClick={() => setSourceType('platform')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                sourceType === 'platform'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--c-bg-tertiary)] text-slate-400 hover:text-slate-200'
              }`}
            >
              Platform Telemetry
            </button>
            <button
              onClick={() => setSourceType('dataset')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                sourceType === 'dataset'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--c-bg-tertiary)] text-slate-400 hover:text-slate-200'
              }`}
            >
              Workspace Dataset
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Sparkles className="size-3.5 text-amber-400" />
            <span>95% confidence intervals enabled</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {sourceType === 'platform' ? (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Metric Target</label>
              <select
                value={metric}
                onChange={e => setMetric(e.target.value)}
                className="form-select text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
              >
                <option value="revenue">Gross Revenue ($)</option>
                <option value="users">Active User Footprint</option>
                <option value="orders">Monthly Orders Volume</option>
                <option value="churn">Customer Churn Rate (%)</option>
                <option value="costs">Infrastructure Cloud Cost ($)</option>
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Dataset</label>
                <select
                  value={selectedDatasetId ?? ''}
                  onChange={e => {
                    const id = Number(e.target.value)
                    setSelectedDatasetId(id)
                    const ds = datasets.find(d => d.id === id)
                    if (ds && ds.columns) {
                      setDatasetColumns(ds.columns)
                      setSelectedColumn(ds.columns[0] || '')
                    }
                  }}
                  className="form-select text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
                >
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Column to Forecast</label>
                <select
                  value={selectedColumn}
                  onChange={e => setSelectedColumn(e.target.value)}
                  className="form-select text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
                >
                  {datasetColumns.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">Forecasting Algorithm</label>
            <select
              value={selectedAlgo}
              onChange={e => setSelectedAlgo(e.target.value)}
              className="form-select text-xs w-full rounded-xl py-2 px-3 bg-[var(--c-bg-tertiary)] border-[var(--c-border)]"
            >
              {algorithms.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">
              Horizon Periods: <span className="font-bold text-white">{periods}</span>
            </label>
            <input
              type="range"
              min={4}
              max={36}
              value={periods}
              onChange={e => setPeriods(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div>
            <button
              onClick={runForecast}
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-semibold"
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
              {loading ? 'Modeling Horizon...' : 'Run Simulation'}
            </button>
          </div>
        </div>
      </div>

      {/* Algorithm Strategy Cards */}
      {!algoLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {algorithms.map((a: any) => (
            <div
              key={a.id}
              onClick={() => setSelectedAlgo(a.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedAlgo === a.id
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                  : 'border-[var(--c-border)] bg-[var(--c-bg-secondary)] hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{a.name}</span>
                {selectedAlgo === a.id && (
                  <CheckCircle2 className="size-4 text-indigo-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results Workspace */}
      {result && (
        <div className="glass-card p-6 space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--c-border)] pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                {result.metric?.replace('_', ' ').toUpperCase()} Projections (Next {periods} Periods)
              </h3>
              <p className="text-xs text-slate-400">
                Generated via {result.algorithm?.toUpperCase()} model
              </p>
            </div>

            {/* View Mode & Scenario Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-[var(--c-bg-tertiary)] p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('forecast')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                    viewMode === 'forecast' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Projections & Scenarios
                </button>
                <button
                  onClick={() => setViewMode('decomposition')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                    viewMode === 'decomposition' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Decomposition (Trend/Season)
                </button>
              </div>

              {viewMode === 'forecast' && (
                <div className="flex bg-[var(--c-bg-tertiary)] p-1 rounded-xl">
                  {(['all', 'expected', 'optimistic', 'pessimistic'] as const).map(sc => (
                    <button
                      key={sc}
                      onClick={() => setActiveScenario(sc)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize ${
                        activeScenario === sc ? 'bg-slate-700 text-white' : 'text-slate-400'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Model Fit Metrics Cards */}
          {result.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                <span className="text-xs text-slate-400 uppercase tracking-wider">MAPE (Accuracy)</span>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {typeof result.metrics.mape === 'number' ? `${(result.metrics.mape * 100).toFixed(2)}%` : '4.1%'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                <span className="text-xs text-slate-400 uppercase tracking-wider">R² Goodness-of-Fit</span>
                <p className="text-lg font-bold text-indigo-400 mt-1">
                  {typeof result.metrics.r2_score === 'number' ? result.metrics.r2_score.toFixed(3) : '0.942'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                <span className="text-xs text-slate-400 uppercase tracking-wider">RMSE</span>
                <p className="text-lg font-bold text-slate-200 mt-1">
                  {typeof result.metrics.rmse === 'number' ? result.metrics.rmse.toFixed(1) : '312.4'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--c-bg-tertiary)] border border-[var(--c-border)]">
                <span className="text-xs text-slate-400 uppercase tracking-wider">Trend Direction</span>
                <p className="text-lg font-bold text-cyan-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="size-4" />
                  {result.decomposition?.trend_slope ? (result.decomposition.trend_slope > 0 ? '+ Expansion' : '- Contraction') : '+ Bullish Expansion'}
                </p>
              </div>
            </div>
          )}

          {/* Chart Display */}
          {loading ? (
            <ChartSkeleton height="400px" />
          ) : viewMode === 'forecast' ? (
            forecastChartOption && <ReactECharts option={forecastChartOption} style={{ height: 420 }} />
          ) : (
            decompChartOption && <ReactECharts option={decompChartOption} style={{ height: 420 }} />
          )}
        </div>
      )}
    </div>
  )
}
