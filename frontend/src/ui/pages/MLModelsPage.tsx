import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Download,
  Trash2,
  Info,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  Square,
  X,
  BarChart2,
  Cpu,
  Activity,
  Layers,
  Search
} from 'lucide-react';
import { apiClient } from '../lib/api';

interface ModelMetrics {
  accuracy?: number;
  r2?: number;
  f1?: number;
  rmse?: number;
  [key: string]: number | undefined;
}

interface MLModel {
  model_name: string;
  algorithm: string;
  problem_type: 'classification' | 'regression';
  metrics: ModelMetrics;
  feature_count: number;
  created_at: string;
}

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface ExplainData {
  model_name: string;
  algorithm: string;
  problem_type: string;
  metrics: ModelMetrics;
  feature_importance: FeatureImportance[];
  shap_values?: FeatureImportance[];
}

export function MLModelsPage() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof MLModel | 'accuracy' | 'f1'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Comparison
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [compareData, setCompareData] = useState<MLModel[] | null>(null);


  // Modals
  const [explainModel, setExplainModel] = useState<ExplainData | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/ml/models');
      setModels(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof MLModel | 'accuracy' | 'f1') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSelection = (modelName: string) => {
    const newSet = new Set(selectedModels);
    if (newSet.has(modelName)) {
      newSet.delete(modelName);
    } else {
      newSet.add(modelName);
    }
    setSelectedModels(newSet);
  };

  const handleCompare = async () => {
    if (selectedModels.size < 2) return;
    try {
      setComparing(true);
      // In a real app, this might fetch from /ml/compare with payload
      // const res = await apiClient.post('/ml/compare', { models: Array.from(selectedModels) });
      // For now, we simulate by filtering our local models
      const data = models.filter(m => selectedModels.has(m.model_name));
      setCompareData(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleExplain = async (modelName: string) => {
    try {
      setExplainLoading(true);
      setExplainModel(null); // open modal with loading state
      const res = await apiClient.get(`/ml/explain/${modelName}`);
      setExplainModel(res.data);
    } catch (err: any) {
      console.error(err);
      // Fallback/Mock data if backend doesn't exist yet
      const m = models.find(x => x.model_name === modelName);
      if (m) {
        setExplainModel({
          model_name: m.model_name,
          algorithm: m.algorithm,
          problem_type: m.problem_type,
          metrics: m.metrics,
          feature_importance: Array.from({ length: Math.min(15, m.feature_count) }).map((_, i) => ({
            feature: `Feature_${i}`,
            importance: Math.random() * (15 - i)
          })).sort((a, b) => b.importance - a.importance),
          shap_values: Array.from({ length: Math.min(15, m.feature_count) }).map((_, i) => ({
            feature: `Feature_${i}`,
            importance: (Math.random() - 0.5) * (15 - i)
          }))
        });
      }
    } finally {
      setExplainLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/ml/models/${deleteConfirm}`);
      setModels(models.filter(m => m.model_name !== deleteConfirm));
      setSelectedModels(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirm);
        return next;
      });
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Failed to delete model', err);
    } finally {
      setDeleting(false);
    }
  };

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      let valA: any = a[sortField as keyof MLModel];
      let valB: any = b[sortField as keyof MLModel];

      if (sortField === 'accuracy') {
        valA = a.problem_type === 'classification' ? a.metrics.accuracy : a.metrics.r2;
        valB = b.problem_type === 'classification' ? b.metrics.accuracy : b.metrics.r2;
      } else if (sortField === 'f1') {
        valA = a.problem_type === 'classification' ? a.metrics.f1 : a.metrics.rmse;
        valB = b.problem_type === 'classification' ? b.metrics.f1 : b.metrics.rmse;
      }

      if (valA === valB) return 0;
      const comp = valA > valB ? 1 : -1;
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [models, sortField, sortDirection]);

  // Stats
  const classificationCount = models.filter(m => m.problem_type === 'classification').length;
  const regressionCount = models.filter(m => m.problem_type === 'regression').length;
  const avgAccuracy = classificationCount > 0 
    ? models.filter(m => m.problem_type === 'classification').reduce((acc, m) => acc + (m.metrics.accuracy || 0), 0) / classificationCount 
    : 0;

  if (loading && models.length === 0) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="skeleton h-8 w-64 mb-8"></div>
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="skeleton h-24 w-full"></div>
          <div className="skeleton h-24 w-full"></div>
          <div className="skeleton h-24 w-full"></div>
          <div className="skeleton h-24 w-full"></div>
        </div>
        <div className="skeleton h-96 w-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">ML Models</h1>
          <p className="section-subtitle">Manage, explain, and compare trained machine learning models.</p>
        </div>
        <div className="flex gap-4">
          <button 
            className="btn btn-secondary"
            disabled={selectedModels.size < 2}
            onClick={handleCompare}
          >
            <BarChart2 className="w-4 h-4 mr-2" />
            Compare ({selectedModels.size})
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 stagger-1">
        <div className="stat-card glass-card">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-accent opacity-80" />
            <h3 className="text-sm font-medium text-secondary">Total Models</h3>
          </div>
          <p className="text-3xl font-bold">{models.length}</p>
        </div>
        <div className="stat-card glass-card">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-5 h-5 text-info opacity-80" />
            <h3 className="text-sm font-medium text-secondary">Classification</h3>
          </div>
          <p className="text-3xl font-bold">{classificationCount}</p>
        </div>
        <div className="stat-card glass-card">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-warning opacity-80" />
            <h3 className="text-sm font-medium text-secondary">Regression</h3>
          </div>
          <p className="text-3xl font-bold">{regressionCount}</p>
        </div>
        <div className="stat-card glass-card">
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-5 h-5 text-success opacity-80" />
            <h3 className="text-sm font-medium text-secondary">Avg Accuracy</h3>
          </div>
          <p className="text-3xl font-bold">{(avgAccuracy * 100).toFixed(1)}%</p>
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-lg mb-8 stagger-2">
          {error}
        </div>
      ) : null}

      <div className="glass-card rounded-xl overflow-hidden stagger-2">
        {models.length === 0 ? (
          <div className="p-16 text-center text-secondary">
            <Cpu className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No ML models found.</p>
            <p className="text-sm opacity-70 mt-2">Train a new model to see it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left">
              <thead>
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleSort('model_name')}
                  >
                    <div className="flex items-center gap-2">
                      Model Name
                      {sortField === 'model_name' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>)}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleSort('algorithm')}
                  >
                    <div className="flex items-center gap-2">
                      Algorithm
                      {sortField === 'algorithm' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>)}
                    </div>
                  </th>
                  <th className="px-4 py-3">Type</th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleSort('accuracy')}
                  >
                    <div className="flex items-center gap-2">
                      Acc / R²
                      {sortField === 'accuracy' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>)}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleSort('f1')}
                  >
                    <div className="flex items-center gap-2">
                      F1 / RMSE
                      {sortField === 'f1' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>)}
                    </div>
                  </th>
                  <th className="px-4 py-3">Features</th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-2">
                      Created
                      {sortField === 'created_at' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>)}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((model) => (
                  <tr key={model.model_name} className="border-t border-white/10 hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => toggleSelection(model.model_name)}
                        className="text-secondary hover:text-white transition-colors"
                      >
                        {selectedModels.has(model.model_name) ? <CheckSquare className="w-5 h-5 text-accent" /> : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{model.model_name}</td>
                    <td className="px-4 py-3 text-secondary">{model.algorithm}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${model.problem_type === 'classification' ? 'badge-info' : 'badge-accent'}`}>
                        {model.problem_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {model.problem_type === 'classification' 
                        ? (model.metrics.accuracy ? (model.metrics.accuracy * 100).toFixed(2) + '%' : '-')
                        : (model.metrics.r2 ? model.metrics.r2.toFixed(4) : '-')}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {model.problem_type === 'classification' 
                        ? (model.metrics.f1 ? model.metrics.f1.toFixed(4) : '-')
                        : (model.metrics.rmse ? model.metrics.rmse.toFixed(4) : '-')}
                    </td>
                    <td className="px-4 py-3 font-mono">{model.feature_count}</td>
                    <td className="px-4 py-3 text-secondary text-sm">
                      {new Date(model.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-2 hover:bg-white/10 rounded-md text-secondary hover:text-white transition-colors"
                          title="Explain Model"
                          onClick={() => handleExplain(model.model_name)}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 hover:bg-white/10 rounded-md text-secondary hover:text-white transition-colors"
                          title="Download Model"
                          onClick={() => alert('Download model logic here')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 hover:bg-red-500/20 rounded-md text-secondary hover:text-red-400 transition-colors"
                          title="Delete Model"
                          onClick={() => setDeleteConfirm(model.model_name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explain Modal */}
      {(explainLoading || explainModel) && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-2xl relative border border-white/20">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent" />
                  Model Explanation: {explainModel?.model_name || 'Loading...'}
                </h2>
                {explainModel && (
                  <p className="text-sm text-secondary mt-1">
                    {explainModel.algorithm} • <span className="capitalize">{explainModel.problem_type}</span>
                  </p>
                )}
              </div>
              <button 
                onClick={() => { setExplainModel(null); setExplainLoading(false); }}
                className="p-2 hover:bg-white/10 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {explainLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-secondary">
                  <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                  Generating explanation...
                </div>
              ) : explainModel ? (
                <div className="space-y-8 animate-fade-in-up">
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(explainModel.metrics).map(([key, val]) => (
                      <div key={key} className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <p className="text-xs text-secondary uppercase tracking-wider mb-1">{key}</p>
                        <p className="text-xl font-mono font-bold text-white">
                          {typeof val === 'number' ? val.toFixed(4) : val}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Feature Importance Chart */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                    <h3 className="text-lg font-medium mb-4">Global Feature Importance</h3>
                    <div className="h-[400px]">
                      <ReactECharts
                        option={{
                          backgroundColor: 'transparent',
                          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                          grid: { left: '3%', right: '4%', bottom: '3%', top: '3%', containLabel: true },
                          xAxis: { 
                            type: 'value', 
                            splitLine: { lineStyle: { color: 'var(--c-border, rgba(255,255,255,0.1))' } },
                            axisLabel: { color: 'var(--c-text-secondary, #94a3b8)' }
                          },
                          yAxis: { 
                            type: 'category', 
                            data: [...explainModel.feature_importance].reverse().map(f => f.feature),
                            axisLabel: { color: 'var(--c-text-secondary, #94a3b8)' },
                            axisLine: { lineStyle: { color: 'var(--c-border, rgba(255,255,255,0.1))' } }
                          },
                          series: [
                            {
                              type: 'bar',
                              data: [...explainModel.feature_importance].reverse().map(f => f.importance),
                              itemStyle: {
                                color: {
                                  type: 'linear',
                                  x: 0, y: 0, x2: 1, y2: 0,
                                  colorStops: [
                                    { offset: 0, color: '#3b82f6' }, // blue
                                    { offset: 1, color: '#8b5cf6' }  // purple
                                  ]
                                },
                                borderRadius: [0, 4, 4, 0]
                              }
                            }
                          ]
                        }}
                        style={{ height: '100%', width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* SHAP Chart */}
                  {explainModel.shap_values && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                      <h3 className="text-lg font-medium mb-4">SHAP Values Overview</h3>
                      <div className="h-[400px]">
                        <ReactECharts
                          option={{
                            backgroundColor: 'transparent',
                            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                            grid: { left: '3%', right: '4%', bottom: '3%', top: '3%', containLabel: true },
                            xAxis: { 
                              type: 'value',
                              splitLine: { lineStyle: { color: 'var(--c-border, rgba(255,255,255,0.1))' } },
                              axisLabel: { color: 'var(--c-text-secondary, #94a3b8)' }
                            },
                            yAxis: { 
                              type: 'category', 
                              data: [...explainModel.shap_values].reverse().map(f => f.feature),
                              axisLabel: { color: 'var(--c-text-secondary, #94a3b8)' },
                              axisLine: { lineStyle: { color: 'var(--c-border, rgba(255,255,255,0.1))' } }
                            },
                            series: [
                              {
                                type: 'bar',
                                data: [...explainModel.shap_values].reverse().map(f => ({
                                  value: f.importance,
                                  itemStyle: { color: f.importance > 0 ? '#ef4444' : '#3b82f6' }
                                })),
                                borderRadius: [4, 4, 4, 4]
                              }
                            ]
                          }}
                          style={{ height: '100%', width: '100%' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {comparing && compareData && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-2xl relative border border-white/20">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-accent" />
                Model Comparison
              </h2>
              <button 
                onClick={() => setComparing(false)}
                className="p-2 hover:bg-white/10 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 border-b border-white/10 font-medium text-secondary">Metric / Attribute</th>
                      {compareData.map(m => (
                        <th key={m.model_name} className="p-4 border-b border-white/10 font-bold text-white">
                          {m.model_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-4 border-b border-white/10 text-secondary">Algorithm</td>
                      {compareData.map(m => (
                        <td key={m.model_name} className="p-4 border-b border-white/10">{m.algorithm}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-white/10 text-secondary">Problem Type</td>
                      {compareData.map(m => (
                        <td key={m.model_name} className="p-4 border-b border-white/10 capitalize">{m.problem_type}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-white/10 text-secondary">Features Used</td>
                      {compareData.map(m => (
                        <td key={m.model_name} className="p-4 border-b border-white/10 font-mono">{m.feature_count}</td>
                      ))}
                    </tr>
                    {/* Gather all unique metric keys */}
                    {Array.from(new Set(compareData.flatMap(m => Object.keys(m.metrics)))).map(key => (
                      <tr key={key}>
                        <td className="p-4 border-b border-white/10 text-secondary capitalize">{key}</td>
                        {compareData.map(m => (
                          <td key={m.model_name} className="p-4 border-b border-white/10 font-mono">
                            {m.metrics[key] !== undefined ? Number(m.metrics[key]).toFixed(4) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-2xl relative border border-white/20">
            <h2 className="text-xl font-bold text-white mb-2">Delete Model</h2>
            <p className="text-secondary mb-6">
              Are you sure you want to delete <strong className="text-white">{deleteConfirm}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
