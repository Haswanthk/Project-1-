import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  AlertTriangle, AlertOctagon, Info, CheckCircle2,
  RefreshCw, Filter, Sparkles, X, ChevronRight,
} from 'lucide-react';
import { apiClient } from '../lib/api';

type Severity = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type Status = 'ALL' | 'open' | 'investigating' | 'resolved';

interface Anomaly {
  id: string;
  metric: string;
  dataset: string;
  timestamp: string;
  value: number;
  expected_value: number;
  z_score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'open' | 'investigating' | 'resolved';
  description: string;
  root_cause: string;
  affected_service: string;
}

interface Summary {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  last_detected: string | null;
}

interface Explanation {
  explanation: string;
  severity: string;
  provider: string;
  grounded_on: string;
}

const SEV_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'bg-red-500/10',    border: 'border-red-500/30',    badge: 'badge-error',   icon: <AlertOctagon  className="w-4 h-4" /> },
  HIGH:     { color: '#f59e0b', bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  badge: 'badge-warning', icon: <AlertTriangle className="w-4 h-4" /> },
  MEDIUM:   { color: '#3b82f6', bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   badge: 'badge-info',    icon: <Info          className="w-4 h-4" /> },
  LOW:      { color: '#10b981', bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',badge: 'badge-success', icon: <CheckCircle2  className="w-4 h-4" /> },
} as const;

const STATUS_CONFIG = {
  open:          { badge: 'badge-error',   label: 'Open' },
  investigating: { badge: 'badge-warning', label: 'Investigating' },
  resolved:      { badge: 'badge-success', label: 'Resolved' },
};

export function AnomalyPage() {
  const [anomalies, setAnomalies]     = useState<Anomaly[]>([]);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [selected, setSelected]       = useState<Anomaly | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [severity, setSeverity]       = useState<Severity>('ALL');
  const [status, setStatus]           = useState<Status>('ALL');
  const [loading, setLoading]         = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severity !== 'ALL') params.set('severity', severity);
      if (status   !== 'ALL') params.set('status', status);
      const [anRes, sumRes] = await Promise.all([
        apiClient.get(`/anomalies/?${params.toString()}`),
        apiClient.get('/anomalies/summary'),
      ]);
      setAnomalies(anRes.data);
      setSummary(sumRes.data);
    } catch (e) {
      console.error('Anomaly fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExplanation = async (id: string) => {
    setExplainLoading(true);
    setExplanation(null);
    try {
      const res = await apiClient.get(`/anomalies/${id}/explain`);
      setExplanation(res.data);
    } catch (e) {
      console.error('Explain failed', e);
    } finally {
      setExplainLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [severity, status]);

  const handleSelect = (a: Anomaly) => {
    setSelected(a);
    fetchExplanation(a.id);
  };

  // Z-score scatter chart
  const scatterOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const a = anomalies[p.dataIndex];
        return `<b>${a?.metric}</b><br/>Z-score: ${p.value[1].toFixed(1)}<br/>Value: ${a?.value?.toLocaleString()}`;
      },
    },
    grid: { left: '3%', right: '5%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: {
      name: 'Anomaly #',
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    yAxis: {
      name: 'Z-Score (σ)',
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'scatter',
      symbolSize: (d: number[]) => Math.min(Math.abs(d[1]) * 5 + 10, 30),
      data: anomalies.map((a, i) => [i + 1, a.z_score]),
      itemStyle: {
        color: (p: any) => {
          const a = anomalies[p.dataIndex];
          return SEV_CONFIG[a?.severity]?.color ?? '#6366f1';
        },
        opacity: 0.85,
      },
    }],
  };

  const summaryCards = summary ? [
    { label: 'Total Detected', value: summary.total, color: 'text-white', bg: 'bg-white/5' },
    { label: 'Critical',  value: summary.by_severity.CRITICAL  ?? 0, color: 'text-red-400',    bg: 'bg-red-500/10' },
    { label: 'High',      value: summary.by_severity.HIGH      ?? 0, color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    { label: 'Open',      value: summary.by_status.open        ?? 0, color: 'text-red-400',    bg: 'bg-red-500/10' },
    { label: 'Investigating', value: summary.by_status.investigating ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Resolved',  value: summary.by_status.resolved    ?? 0, color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  ] : [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Anomaly Detection</h1>
          <p className="section-subtitle">AI-powered detection with statistical significance analysis</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {!loading && summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {summaryCards.map(c => (
            <div key={c.label} className={`rounded-xl p-3 ${c.bg} border border-white/6 text-center`}>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Scatter Chart */}
      <div className="glass-card p-6">
        <h3 className="section-header mb-4">Anomaly Z-Score Distribution</h3>
        {loading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : (
          <ReactECharts option={scatterOption} style={{ height: '200px' }} />
        )}
        <p className="text-xs text-slate-500 mt-2 text-center">Bubble size = statistical significance · Color = severity · Click a row below for AI explanation</p>
      </div>

      {/* Filters + Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-white/8 flex flex-wrap items-center gap-4">
          <h3 className="section-header mr-auto">Detected Anomalies</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {/* Severity filter */}
            <select
              className="form-select text-xs py-1.5"
              value={severity}
              onChange={e => setSeverity(e.target.value as Severity)}
            >
              {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {/* Status filter */}
            <select
              className="form-select text-xs py-1.5"
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
            >
              {(['ALL', 'open', 'investigating', 'resolved'] as Status[]).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Metric</th>
                <th>Observed</th>
                <th>Expected</th>
                <th>Z-Score</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Service</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/40" />
                    No anomalies match the current filters.
                  </td>
                </tr>
              ) : (
                anomalies.map(a => {
                  const sc = SEV_CONFIG[a.severity];
                  const st = STATUS_CONFIG[a.status];
                  const isSelected = selected?.id === a.id;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => handleSelect(a)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10' : ''}`}
                      style={{ borderLeft: isSelected ? `3px solid ${sc.color}` : '3px solid transparent' }}
                    >
                      <td>
                        <span className={`badge ${sc.badge} gap-1`}>
                          {sc.icon} {a.severity}
                        </span>
                      </td>
                      <td className="font-medium text-sm">{a.metric}</td>
                      <td className="font-mono text-sm text-right">{a.value.toLocaleString()}</td>
                      <td className="font-mono text-sm text-right text-slate-500">{a.expected_value.toLocaleString()}</td>
                      <td>
                        <span className={`font-mono font-bold text-sm ${Math.abs(a.z_score) > 5 ? 'text-red-400' : Math.abs(a.z_score) > 3 ? 'text-amber-400' : 'text-blue-400'}`}>
                          {a.z_score > 0 ? '+' : ''}{a.z_score.toFixed(1)}σ
                        </span>
                      </td>
                      <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                      <td className="text-slate-500 text-xs">{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="text-slate-500 text-xs font-mono">{a.affected_service}</td>
                      <td><ChevronRight className="w-4 h-4 text-slate-600" /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Explanation Panel */}
      {selected && (
        <div className={`glass-card p-6 border ${SEV_CONFIG[selected.severity].border} animate-fade-in-up`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${SEV_CONFIG[selected.severity].bg}`}>
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">AI Root Cause Analysis</h3>
                <p className="text-xs text-slate-500">{selected.metric} · {selected.dataset} · Internal Analytics Engine</p>
              </div>
            </div>
            <button onClick={() => { setSelected(null); setExplanation(null); }} className="btn btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {explainLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-4/6 rounded" />
            </div>
          ) : explanation ? (
            <div
              className="text-sm text-slate-300 leading-relaxed whitespace-pre-line"
              dangerouslySetInnerHTML={{
                __html: explanation.explanation
                  .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
                  .replace(/\n/g, '<br/>'),
              }}
            />
          ) : (
            <p className="text-slate-500 text-sm">Failed to load explanation.</p>
          )}
        </div>
      )}
    </div>
  );
}
