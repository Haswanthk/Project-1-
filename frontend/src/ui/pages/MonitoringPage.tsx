import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, Server, AlertCircle, CheckCircle2, Clock, Cpu, HardDrive, ShieldAlert, CheckSquare } from 'lucide-react';
import { apiClient } from '../lib/api';

interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  version: string;
  services: {
    database: string;
    redis: string;
    kafka: string;
    spark: string;
  };
}

interface NodeInfo {
  id: string;
  name: string;
  role: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  cpuUsage: number;
  memoryUsage: number;
  latencyMs: number;
}

interface TimeseriesData {
  timestamps: string[];
  requests: number[];
  errors: number[];
  cpu: number[];
}

interface ModelDrift {
  modelName: string;
  featureDriftScore: number;
  predictionDriftScore: number;
  status: 'STABLE' | 'WARNING' | 'CRITICAL';
  driftedFeatures: string[];
}

interface Alert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  description: string;
  firedAt: string;
  resolved: boolean;
}

export function MonitoringPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [modelDrift, setModelDrift] = useState<ModelDrift[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const { data } = await apiClient.get<Alert[]>('/monitoring/alerts');
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [healthRes, nodesRes, timeseriesRes, driftRes, alertsRes] = await Promise.all([
        apiClient.get<HealthStatus>('/monitoring/health'),
        apiClient.get<NodeInfo[]>('/monitoring/nodes'),
        apiClient.get<TimeseriesData>('/monitoring/metrics/timeseries'),
        apiClient.get<ModelDrift[]>('/monitoring/model-drift'),
        apiClient.get<Alert[]>('/monitoring/alerts')
      ]);

      setHealth(healthRes.data);
      setNodes(nodesRes.data);
      setTimeseries(timeseriesRes.data);
      setModelDrift(driftRes.data);
      setAlerts(alertsRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const alertsInterval = setInterval(() => {
      fetchAlerts();
    }, 20000);

    return () => clearInterval(alertsInterval);
  }, []);

  const resolveAlert = async (id: string) => {
    try {
      await apiClient.patch(`/monitoring/alerts/${id}`, { resolved: true });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-12 w-1/3 rounded"></div>
        <div className="skeleton h-24 w-full rounded"></div>
        <div className="grid grid-cols-4 gap-4">
          <div className="skeleton h-32 rounded"></div>
          <div className="skeleton h-32 rounded"></div>
          <div className="skeleton h-32 rounded"></div>
          <div className="skeleton h-32 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="glass-card p-6 border-l-4 border-[var(--c-error)] flex items-center space-x-3 text-[var(--c-error)]">
          <ShieldAlert className="h-6 w-6" />
          <span>Error loading monitoring data: {error}</span>
        </div>
      </div>
    );
  }

  const totalRequests = timeseries?.requests.reduce((a, b) => a + b, 0) || 0;
  const avgLatency = nodes.length > 0 ? nodes.reduce((acc, n) => acc + n.latencyMs, 0) / nodes.length : 0;
  const activeAlerts = alerts.filter(a => !a.resolved).length;
  const nodesOnline = nodes.filter(n => n.status === 'ONLINE').length;

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: 'var(--c-text-secondary)' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: timeseries?.timestamps || [],
      axisLabel: { color: 'var(--c-text-secondary)' }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Count',
        axisLabel: { color: 'var(--c-text-secondary)' },
        nameTextStyle: { color: 'var(--c-text-secondary)' }
      },
      {
        type: 'value',
        name: 'CPU %',
        max: 100,
        axisLabel: { color: 'var(--c-text-secondary)' },
        nameTextStyle: { color: 'var(--c-text-secondary)' }
      }
    ],
    series: [
      {
        name: 'Requests',
        type: 'line',
        data: timeseries?.requests || [],
        itemStyle: { color: 'var(--c-accent)' }
      },
      {
        name: 'Errors',
        type: 'line',
        data: timeseries?.errors || [],
        itemStyle: { color: 'var(--c-error)' }
      },
      {
        name: 'CPU Usage',
        type: 'line',
        yAxisIndex: 1,
        data: timeseries?.cpu || [],
        itemStyle: { color: 'var(--c-warning)' }
      }
    ]
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      <header>
        <h1 className="section-title text-gradient">Platform Monitoring & Observability</h1>
        <p className="section-subtitle">Real-time system health and performance metrics</p>
      </header>

      {/* System Health Banner */}
      <section className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up stagger-1">
        <div className="flex items-center space-x-4">
          <Activity className={`h-8 w-8 ${health?.status === 'HEALTHY' ? 'text-[var(--c-success)]' : 'text-[var(--c-warning)]'}`} />
          <div>
            <h2 className="text-lg font-semibold text-[var(--c-text-primary)]">System Status: {health?.status}</h2>
            <p className="text-sm text-[var(--c-text-secondary)]">Version: {health?.version}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {health?.services && Object.entries(health.services).map(([service, status]) => (
            <div key={service} className="flex items-center space-x-2 bg-[var(--c-bg-elevated)] px-3 py-1 rounded-full border border-[var(--c-border)]">
              <span className="text-sm font-medium capitalize text-[var(--c-text-primary)]">{service}:</span>
              <span className={`badge ${status === 'UP' ? 'badge-success' : 'badge-error'}`}>{status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stat Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up stagger-2">
        <div className="stat-card glass-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-[var(--c-text-secondary)] font-medium">Total Requests (24h)</p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--c-text-primary)]">{totalRequests.toLocaleString()}</h3>
            </div>
            <Activity className="h-5 w-5 text-[var(--c-accent)]" />
          </div>
        </div>
        <div className="stat-card glass-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-[var(--c-text-secondary)] font-medium">Avg Latency P99</p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--c-text-primary)]">{avgLatency.toFixed(1)} ms</h3>
            </div>
            <Clock className="h-5 w-5 text-[var(--c-info)]" />
          </div>
        </div>
        <div className="stat-card glass-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-[var(--c-text-secondary)] font-medium">Active Alerts</p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--c-text-primary)]">{activeAlerts}</h3>
            </div>
            <AlertCircle className={`h-5 w-5 ${activeAlerts > 0 ? 'text-[var(--c-error)]' : 'text-[var(--c-success)]'}`} />
          </div>
        </div>
        <div className="stat-card glass-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-[var(--c-text-secondary)] font-medium">Nodes Online</p>
              <h3 className="text-2xl font-bold mt-1 text-[var(--c-text-primary)]">{nodesOnline} / {nodes.length}</h3>
            </div>
            <Server className="h-5 w-5 text-[var(--c-success)]" />
          </div>
        </div>
      </section>

      {/* Time-series Chart */}
      <section className="glass-card p-6 animate-fade-in-up stagger-3">
        <h3 className="section-header mb-4">Performance Metrics (24h)</h3>
        <div className="h-80 w-full">
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </section>

      {/* Nodes Grid */}
      <section className="animate-fade-in-up stagger-4">
        <h3 className="section-header mb-4">Infrastructure Nodes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map(node => (
            <div key={node.id} className="glass-card p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--c-border)] pb-3">
                <div className="flex items-center space-x-3">
                  <Server className="h-5 w-5 text-[var(--c-text-secondary)]" />
                  <div>
                    <h4 className="font-semibold text-[var(--c-text-primary)]">{node.name}</h4>
                    <p className="text-xs text-[var(--c-text-secondary)]">{node.role}</p>
                  </div>
                </div>
                <span className={`badge ${node.status === 'ONLINE' ? 'badge-success' : node.status === 'DEGRADED' ? 'badge-warning' : 'badge-error'}`}>
                  {node.status}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--c-text-secondary)] flex items-center"><Cpu className="h-3 w-3 mr-1"/> CPU</span>
                    <span className="text-[var(--c-text-primary)]">{node.cpuUsage}%</span>
                  </div>
                  <div className="progress-bar h-2 bg-[var(--c-bg-tertiary)] rounded-full overflow-hidden">
                    <div 
                      className={`progress-bar-fill h-full ${node.cpuUsage > 80 ? 'bg-[var(--c-error)]' : 'bg-[var(--c-accent)]'}`} 
                      style={{ width: `${node.cpuUsage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--c-text-secondary)] flex items-center"><HardDrive className="h-3 w-3 mr-1"/> Memory</span>
                    <span className="text-[var(--c-text-primary)]">{node.memoryUsage}%</span>
                  </div>
                  <div className="progress-bar h-2 bg-[var(--c-bg-tertiary)] rounded-full overflow-hidden">
                    <div 
                      className={`progress-bar-fill h-full ${node.memoryUsage > 80 ? 'bg-[var(--c-warning)]' : 'bg-[var(--c-info)]'}`} 
                      style={{ width: `${node.memoryUsage}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-[var(--c-text-secondary)] pt-1 flex items-center justify-between">
                  <span>Latency</span>
                  <span className="font-medium text-[var(--c-text-primary)]">{node.latencyMs} ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Model Drift & Alerts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up stagger-5">
        {/* Model Drift Table */}
        <div className="glass-card p-6 overflow-x-auto">
          <h3 className="section-header mb-4">Model Drift Monitoring</h3>
          <table className="data-table w-full text-left">
            <thead>
              <tr className="border-b border-[var(--c-border)] text-[var(--c-text-secondary)] text-sm">
                <th className="pb-3 font-medium">Model</th>
                <th className="pb-3 font-medium">Feature Drift</th>
                <th className="pb-3 font-medium">Prediction Drift</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {modelDrift.map((model, idx) => (
                <tr key={idx} className="border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-bg-elevated)] transition-colors">
                  <td className="py-3 font-medium text-[var(--c-text-primary)]">{model.modelName}</td>
                  <td className={`py-3 ${model.featureDriftScore > 0.05 ? 'text-[var(--c-error)] font-semibold' : 'text-[var(--c-text-secondary)]'}`}>
                    {model.featureDriftScore.toFixed(3)}
                  </td>
                  <td className="py-3 text-[var(--c-text-secondary)]">{model.predictionDriftScore.toFixed(3)}</td>
                  <td className="py-3">
                    <span className={`badge ${model.status === 'STABLE' ? 'badge-success' : model.status === 'WARNING' ? 'badge-warning' : 'badge-error'}`}>
                      {model.status}
                    </span>
                  </td>
                </tr>
              ))}
              {modelDrift.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[var(--c-text-secondary)] text-sm">No models currently tracked.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Alerts Panel */}
        <div className="glass-card p-6 flex flex-col h-full max-h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="section-header">Active Alerts</h3>
            {activeAlerts > 0 && <span className="badge badge-error">{activeAlerts} New</span>}
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {alerts.filter(a => !a.resolved).map(alert => (
              <div key={alert.id} className="bg-[var(--c-bg-elevated)] p-4 rounded-lg border border-[var(--c-border)] flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span className={`badge ${alert.severity === 'CRITICAL' || alert.severity === 'ERROR' ? 'badge-error' : alert.severity === 'WARNING' ? 'badge-warning' : 'badge-info'}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-[var(--c-text-secondary)]">{new Date(alert.firedAt).toLocaleTimeString()}</span>
                  </div>
                  <button 
                    onClick={() => resolveAlert(alert.id)}
                    className="btn btn-ghost text-xs p-1 h-auto text-[var(--c-text-secondary)] hover:text-[var(--c-success)]"
                    title="Resolve Alert"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--c-text-primary)]">{alert.description}</p>
              </div>
            ))}
            {alerts.filter(a => !a.resolved).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-[var(--c-text-secondary)] py-8">
                <CheckCircle2 className="h-12 w-12 text-[var(--c-success)] opacity-50 mb-3" />
                <p>No active alerts. Systems normal.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
