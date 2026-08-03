import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  TrendingUp, BarChart2, RefreshCw, Brain, Info,
} from 'lucide-react';
import { apiClient } from '../lib/api';

interface ForecastMetric {
  key: string;
  label: string;
  unit: string;
  algorithm: string;
}

interface ForecastData {
  metric: string;
  label: string;
  unit: string;
  algorithm: string;
  model_performance: { mape: number; mae: number };
  historical: { timestamps: string[]; values: number[] };
  forecast: {
    timestamps: string[];
    values: number[];
    lower_bound: number[];
    upper_bound: number[];
  };
  summary: {
    direction: string;
    horizon_days: number;
    projected_change_pct: number;
    confidence_level: number;
  };
}

const HORIZONS = [
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
];

function fmt(n: number, unit: string) {
  if (unit === '$') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }
  if (unit === '%') return `${(n * 100).toFixed(2)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function ForecastPage() {
  const [metrics, setMetrics]   = useState<ForecastMetric[]>([]);
  const [metric, setMetric]     = useState<string>('revenue');
  const [horizon, setHorizon]   = useState<number>(90);
  const [data, setData]         = useState<ForecastData | null>(null);
  const [loading, setLoading]   = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await apiClient.get('/forecast/metrics');
      setMetrics(res.data);
    } catch (e) {
      console.error('Metrics list failed', e);
    }
  };

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/forecast/?metric=${metric}&horizon=${horizon}`);
      setData(res.data);
    } catch (e) {
      console.error('Forecast fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);
  useEffect(() => { fetchForecast(); }, [metric, horizon]);

  const buildChartOption = (d: ForecastData) => {
    const allTs   = [...d.historical.timestamps, ...d.forecast.timestamps];
    const histLen = d.historical.timestamps.length;
    // Pad historical with nulls for forecast positions and vice versa
    const histSeries = [
      ...d.historical.values,
      ...Array(d.forecast.timestamps.length).fill(null),
    ];
    const fcValues = [
      ...Array(histLen - 1).fill(null),
      d.historical.values[histLen - 1], // join point
      ...d.forecast.values,
    ];
    const fcLower = [
      ...Array(histLen - 1).fill(null),
      d.historical.values[histLen - 1],
      ...d.forecast.lower_bound,
    ];
    const fcUpper = [
      ...Array(histLen - 1).fill(null),
      d.historical.values[histLen - 1],
      ...d.forecast.upper_bound,
    ];

    const labelFmt = (v: number) => fmt(v, d.unit);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const ts = params[0]?.name ?? '';
          const lines = params
            .filter(p => p.value != null)
            .map(p => `${p.seriesName}: <b>${labelFmt(p.value)}</b>`)
            .join('<br/>');
          return `<span style="color:#94a3b8;font-size:11px">${ts}</span><br/>${lines}`;
        },
      },
      legend: {
        data: ['Historical', 'Forecast', 'Confidence Band'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        bottom: 0,
      },
      grid: { left: '3%', right: '3%', bottom: '14%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: allTs,
        axisLabel: {
          color: '#64748b', fontSize: 10,
          formatter: (v: string) => v.slice(5), // MM-DD
          interval: Math.floor(allTs.length / 8),
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 11, formatter: (v: number) => labelFmt(v) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: 'Historical',
          type: 'line',
          data: histSeries,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#6366f1', width: 2 },
          itemStyle: { color: '#6366f1' },
        },
        {
          name: 'Forecast',
          type: 'line',
          data: fcValues,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#f59e0b', width: 2.5, type: 'dashed' },
          itemStyle: { color: '#f59e0b' },
        },
        // Upper confidence
        {
          name: 'Confidence Band',
          type: 'line',
          data: fcUpper,
          smooth: true,
          symbol: 'none',
          lineStyle: { opacity: 0 },
          itemStyle: { color: 'transparent' },
          stack: 'confidence',
          areaStyle: { opacity: 0 },
          silent: true,
          legendHoverLink: false,
        },
        {
          name: 'Confidence Band',
          type: 'line',
          data: fcLower,
          smooth: true,
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: 'rgba(245,158,11,0.12)',
          },
          itemStyle: { color: 'rgba(245,158,11,0.5)' },
          stack: 'confidence',
        },
      ],
    };
  };

  const currentMetricCfg = metrics.find(m => m.key === metric);
  const lastHistValue = data?.historical.values[data.historical.values.length - 1] ?? 0;
  const lastFcValue = data?.forecast.values[data.forecast.values.length - 1] ?? 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Forecasting & Projections</h1>
          <p className="section-subtitle">AI-driven time-series forecasting with confidence intervals</p>
        </div>
        <button onClick={fetchForecast} className="btn btn-secondary gap-2">
          <RefreshCw className="w-4 h-4" /> Recalculate
        </button>
      </div>

      {/* Controls */}
      <div className="glass-card p-5 flex flex-wrap gap-6 items-center">
        {/* Metric selector */}
        <div className="flex-1 min-w-[200px]">
          <p className="form-label">Forecast Metric</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {metrics.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  metric === m.key
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizon selector */}
        <div>
          <p className="form-label">Horizon</p>
          <div className="flex gap-2 mt-1">
            {HORIZONS.map(h => (
              <button
                key={h.value}
                onClick={() => setHorizon(h.value)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  horizon === h.value
                    ? 'bg-amber-600/80 border-amber-500/80 text-white'
                    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {data && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="stat-card p-5">
            <p className="text-xs text-slate-400 mb-1">Current Value</p>
            <p className="text-xl font-bold text-white">{fmt(lastHistValue, data.unit)}</p>
            <p className="text-xs text-slate-500 mt-1">{data.label}</p>
          </div>
          <div className="stat-card p-5">
            <p className="text-xs text-slate-400 mb-1">{data.summary.horizon_days}-Day Projection</p>
            <p className="text-xl font-bold text-amber-400">{fmt(lastFcValue, data.unit)}</p>
            <p className="text-xs text-emerald-400 mt-1">
              {data.summary.projected_change_pct >= 0 ? '+' : ''}{data.summary.projected_change_pct.toFixed(1)}% change
            </p>
          </div>
          <div className="stat-card p-5">
            <p className="text-xs text-slate-400 mb-1">Model</p>
            <p className="text-sm font-semibold text-white leading-tight">{data.algorithm}</p>
            <p className="text-xs text-slate-500 mt-1">MAPE: {data.model_performance.mape}%</p>
          </div>
          <div className="stat-card p-5">
            <p className="text-xs text-slate-400 mb-1">Confidence</p>
            <p className="text-xl font-bold text-indigo-400">{data.summary.confidence_level}%</p>
            <p className={`text-xs mt-1 font-medium ${data.summary.direction === 'upward' ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.summary.direction === 'upward' ? '↑' : '↓'} {data.summary.direction} trend
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-amber-500/15">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="section-header">{currentMetricCfg?.label ?? 'Forecast'} — {horizon}-Day Projection</h3>
            <p className="text-xs text-slate-500">
              <span className="inline-block w-4 h-0.5 bg-indigo-500 mr-1 align-middle" />Historical &nbsp;
              <span className="inline-block w-4 h-0.5 bg-amber-400 mr-1 align-middle border-dashed" />Forecast &nbsp;
              <span className="inline-block w-4 h-2 bg-amber-500/20 rounded mr-1 align-middle" />95% CI
            </p>
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-80 rounded-xl" />
        ) : data ? (
          <ReactECharts option={buildChartOption(data)} style={{ height: '360px' }} />
        ) : null}
      </div>

      {/* Model Info */}
      {data && !loading && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h3 className="section-header">Model Information</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Algorithm</p>
              <p className="font-semibold text-white">{data.algorithm}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">MAPE</p>
              <p className="font-semibold text-white">{data.model_performance.mape}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">MAE</p>
              <p className="font-semibold text-white">{fmt(data.model_performance.mae, data.unit)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Confidence Level</p>
              <p className="font-semibold text-white">{data.summary.confidence_level}%</p>
            </div>
          </div>
          <div className="mt-5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Forecast generated using <strong className="text-white">{data.algorithm}</strong> on 30 days of historical data.
              The <strong className="text-white">95% confidence interval</strong> widens over the horizon as uncertainty compounds.
              Model accuracy: <strong className="text-white">MAPE = {data.model_performance.mape}%</strong>.
              {data.summary.direction === 'upward'
                ? ` Positive trend detected — projected ${data.summary.projected_change_pct.toFixed(1)}% growth over ${data.summary.horizon_days} days.`
                : ` Declining trend detected — monitor closely for intervention opportunities.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
