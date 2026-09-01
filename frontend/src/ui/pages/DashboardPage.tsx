import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  AlertTriangle,
  Server,
  Database,
  Cpu,
  Clock,
  Zap,
  Box,
  TrendingUp,
  TrendingDown,
  Bell,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { apiClient } from '../lib/api';

// --- Types ---
type StatTrend = 'up' | 'down' | 'neutral';

interface MetricValue {
  value: string | number;
  delta: string;
  trend: StatTrend;
}

interface MetricSummary {
  activePipelines: MetricValue;
  streamingEventsMin: MetricValue;
  uptime: MetricValue;
  apiLatencyP99: MetricValue;
  totalRequests: MetricValue;
  apiErrorRate: MetricValue;
}

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface Model {
  id: string;
  name: string;
  status: 'active' | 'drifting' | 'retired';
}


interface TimeSeries {
  timestamp: string;
  events: number;
  requests: number;
}

interface DashboardData {
  summary: MetricSummary | null;
  timeseries: TimeSeries[];
  alerts: Alert[];
  models: Model[];
  datasetsCount: number;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    summary: null,
    timeseries: [],
    alerts: [],
    models: [],
    datasetsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [summaryRes, tsRes, datasetsRes, modelsRes, alertsRes] = await Promise.allSettled([
        apiClient.get('/monitoring/metrics/summary'),
        apiClient.get('/monitoring/metrics/timeseries'),
        apiClient.get('/datasets/'),
        apiClient.get('/ml/models'),
        apiClient.get('/monitoring/alerts')
      ]);

      const rawSummary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null;
      const rawTimeseries = tsRes.status === 'fulfilled' ? tsRes.value.data : null;
      const toMetric = (value: string | number, delta = 'Current measurement', trend: StatTrend = 'neutral'): MetricValue => ({ value, delta, trend });
      const summary: MetricSummary | null = rawSummary ? {
        activePipelines: toMetric(rawSummary.spark_jobs_active),
        streamingEventsMin: toMetric(rawSummary.streaming_events_per_min),
        uptime: toMetric(`${rawSummary.uptime_percent}%`),
        apiLatencyP99: toMetric(`${rawSummary.api_p99_latency_ms} ms`),
        totalRequests: toMetric(rawSummary.api_requests_total),
        apiErrorRate: toMetric(rawSummary.api_requests_total ? `${((rawSummary.api_errors_total / rawSummary.api_requests_total) * 100).toFixed(2)}%` : '0%'),
      } : null;
      const timeseries: TimeSeries[] = rawTimeseries?.timestamps?.map((timestamp: string, index: number) => ({
        timestamp,
        events: rawTimeseries.events_per_min?.[index] ?? 0,
        requests: rawTimeseries.api_requests?.[index] ?? 0,
      })) ?? [];
      const models: Model[] = modelsRes.status === 'fulfilled' ? modelsRes.value.data.map((model: any) => ({
        id: String(model.name ?? model.model_name),
        name: model.name ?? model.model_name,
        status: model.status === 'drifting' || model.status === 'retired' ? model.status : 'active',
      })) : [];
      const alerts: Alert[] = alertsRes.status === 'fulfilled' ? alertsRes.value.data.map((alert: any) => ({
        id: String(alert.id),
        severity: alert.severity === 'error' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info',
        message: alert.message ?? alert.description ?? alert.title,
        timestamp: alert.timestamp ?? alert.fired_at,
        resolved: alert.resolved,
      })) : [];

      setData({
        summary,
        timeseries,
        datasetsCount: datasetsRes.status === 'fulfilled' ? datasetsRes.value.data.length : 0,
        models,
        alerts,
      });
      setError([summaryRes, tsRes, datasetsRes, modelsRes, alertsRes].some((result) => result.status === 'rejected') ? 'Some live data sources are unavailable.' : null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Unable to load dashboard data. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = (trend: StatTrend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-gray-400" />;
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'badge badge-error text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'badge badge-warning text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'warning': return 'badge badge-warning text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'info': return 'badge badge-info text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'badge badge-neutral';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'high':
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  // --- Chart Options ---
  const eventsChartOptions = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.timeseries.map(d => d.timestamp),
      axisLabel: { color: '#94a3b8' }
    },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
    series: [{
      data: data.timeseries.map(d => d.events),
      type: 'line',
      smooth: true,
      itemStyle: { color: 'var(--c-accent, #3b82f6)' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ]
        }
      }
    }]
  };

  const requestsChartOptions = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.timeseries.map(d => d.timestamp),
      axisLabel: { color: '#94a3b8' }
    },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
    series: [{
      data: data.timeseries.map(d => d.requests),
      type: 'bar',
      itemStyle: { color: 'var(--c-accent, #6366f1)', borderRadius: [4, 4, 0, 0] }
    }]
  };

  const modelStatusCount = data.models.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const modelHealthOptions = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%', textStyle: { color: '#94a3b8' } },
    series: [{
      name: 'Model Health',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: 'var(--c-bg-elevated, #1e293b)',
        borderWidth: 2
      },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } },
      data: [
        { value: modelStatusCount['active'] || 0, name: 'Active', itemStyle: { color: '#10b981' } },
        { value: modelStatusCount['drifting'] || 0, name: 'Drifting', itemStyle: { color: '#f59e0b' } },
        { value: modelStatusCount['retired'] || 0, name: 'Retired', itemStyle: { color: '#64748b' } }
      ]
    }]
  };

  // --- Renderers ---
  const renderSkeletonCard = () => (
    <div className="stat-card skeleton h-32 rounded-xl border border-[var(--c-border)]"></div>
  );

  const statCardsData = data.summary ? [
    { title: 'Active Pipelines', value: data.summary.activePipelines.value, delta: data.summary.activePipelines.delta, trend: data.summary.activePipelines.trend, icon: <Activity className="w-6 h-6 text-blue-500" />, bg: 'bg-blue-500/10' },
    { title: 'Streaming Events/Min', value: data.summary.streamingEventsMin.value, delta: data.summary.streamingEventsMin.delta, trend: data.summary.streamingEventsMin.trend, icon: <Zap className="w-6 h-6 text-yellow-500" />, bg: 'bg-yellow-500/10' },
    { title: 'Models in Registry', value: data.models.length, delta: '+2 this month', trend: 'up' as StatTrend, icon: <Cpu className="w-6 h-6 text-purple-500" />, bg: 'bg-purple-500/10' },
    { title: 'Platform Uptime', value: data.summary.uptime.value, delta: data.summary.uptime.delta, trend: data.summary.uptime.trend, icon: <Server className="w-6 h-6 text-green-500" />, bg: 'bg-green-500/10' },
    { title: 'Datasets Uploaded', value: data.datasetsCount, delta: '+12 this week', trend: 'up' as StatTrend, icon: <Database className="w-6 h-6 text-indigo-500" />, bg: 'bg-indigo-500/10' },
    { title: 'API P99 Latency', value: data.summary.apiLatencyP99.value, delta: data.summary.apiLatencyP99.delta, trend: data.summary.apiLatencyP99.trend, icon: <Clock className="w-6 h-6 text-orange-500" />, bg: 'bg-orange-500/10' },
    { title: 'Total API Requests', value: data.summary.totalRequests.value, delta: data.summary.totalRequests.delta, trend: data.summary.totalRequests.trend, icon: <Box className="w-6 h-6 text-cyan-500" />, bg: 'bg-cyan-500/10' },
    { title: 'API Error Rate', value: data.summary.apiErrorRate.value, delta: data.summary.apiErrorRate.delta, trend: data.summary.apiErrorRate.trend, icon: <AlertTriangle className="w-6 h-6 text-red-500" />, bg: 'bg-red-500/10' },
  ] : [];

  return (
    <div className="w-full min-h-screen p-6 animate-fade-in text-[var(--c-text-primary)]">
      {/* Header */}
      <header className="mb-8">
        <h1 className="section-title text-3xl font-bold tracking-tight">Enterprise Analytics Command Center</h1>
        <p className="section-subtitle text-[var(--c-text-secondary)] mt-2">Real-time overview of your ML models, pipelines, and infrastructure</p>
      </header>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <React.Fragment key={i}>{renderSkeletonCard()}</React.Fragment>)
          : statCardsData.map((stat, idx) => (
            <div key={stat.title} className={`stat-card bg-[var(--c-bg-elevated)] border border-[var(--c-border)] p-5 rounded-xl shadow-sm animate-fade-in-up stagger-${(idx % 4) + 1}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    {stat.icon}
                  </div>
                  <h3 className="text-sm font-medium text-[var(--c-text-secondary)]">{stat.title}</h3>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {getTrendIcon(stat.trend)}
                  <span className="text-[var(--c-text-secondary)]">{stat.delta}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Line Chart */}
        <div className="glass-card lg:col-span-2 p-6 rounded-xl animate-fade-in-up stagger-2 border border-[var(--c-border)] bg-[var(--c-bg-elevated)] shadow-sm">
          <h3 className="section-header text-lg font-semibold mb-4">Streaming Events (24h)</h3>
          {loading ? (
            <div className="skeleton h-[300px] w-full rounded-lg" />
          ) : (
            <ReactECharts option={eventsChartOptions} style={{ height: '300px', width: '100%' }} />
          )}
        </div>

        {/* Donut Chart */}
        <div className="glass-card p-6 rounded-xl animate-fade-in-up stagger-3 border border-[var(--c-border)] bg-[var(--c-bg-elevated)] shadow-sm">
          <h3 className="section-header text-lg font-semibold mb-4">Model Health</h3>
          {loading ? (
            <div className="skeleton h-[300px] w-full rounded-lg" />
          ) : (
            <ReactECharts option={modelHealthOptions} style={{ height: '300px', width: '100%' }} />
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="glass-card lg:col-span-2 p-6 rounded-xl animate-fade-in-up stagger-4 border border-[var(--c-border)] bg-[var(--c-bg-elevated)] shadow-sm">
          <h3 className="section-header text-lg font-semibold mb-4">API Requests (Hourly)</h3>
          {loading ? (
            <div className="skeleton h-[300px] w-full rounded-lg" />
          ) : (
            <ReactECharts option={requestsChartOptions} style={{ height: '300px', width: '100%' }} />
          )}
        </div>

        {/* Alerts Feed */}
        <div className="glass-card p-6 rounded-xl animate-fade-in-up stagger-5 border border-[var(--c-border)] bg-[var(--c-bg-elevated)] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-header text-lg font-semibold">Active Alerts</h3>
            <span className="badge badge-accent bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full text-xs font-medium">
              {data.alerts.filter(a => !a.resolved).length} New
            </span>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-lg" />)
            ) : data.alerts.length === 0 ? (
              <div className="text-center py-8 text-[var(--c-text-secondary)]">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                <p>No active alerts</p>
              </div>
            ) : (
              data.alerts.filter(a => !a.resolved).map(alert => (
                <div key={alert.id} className="flex gap-4 p-3 rounded-lg bg-[var(--c-bg-body)]/50 border border-[var(--c-border)]">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-[var(--c-text-secondary)]">{alert.timestamp}</span>
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
