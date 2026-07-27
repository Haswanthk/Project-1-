import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../lib/api';
import ReactECharts from 'echarts-for-react';
import { 
  Play, 
  Database, 
  Settings, 
  Target, 
  List, 
  AlertCircle, 
  CheckCircle,
  Copy,
  ChevronRight,
  TrendingUp,
  Cpu,
  Loader,
  BarChart2,
  Activity
} from 'lucide-react';

interface DatasetSchema {
  columns: { name: string; type: string }[];
}

interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  schema?: DatasetSchema;
}

interface Algorithm {
  id: string;
  name: string;
  description: string;
  problemTypes: string[];
  defaultHyperparameters: Record<string, any>;
}

interface TrainingResult {
  modelId: string;
  modelName: string;
  metrics: Record<string, number>;
  cvScores?: number[];
  featuresUsed: string[];
}

export function TrainingPage() {
  // Data State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [datasetId, setDatasetId] = useState<string>('');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [featureColumns, setFeatureColumns] = useState<string[]>([]);
  const [algorithmId, setAlgorithmId] = useState<string>('');
  const [problemType, setProblemType] = useState<'classification' | 'regression'>('classification');
  const [testSize, setTestSize] = useState<number>(0.2);
  const [crossValidation, setCrossValidation] = useState<boolean>(false);
  const [hyperparameters, setHyperparameters] = useState<string>('{}');

  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStep, setTrainingStep] = useState(0);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      setError(null);
      try {
        const [datasetsRes, algorithmsRes] = await Promise.all([
          apiClient.get('/datasets/'),
          apiClient.get('/ml/algorithms')
        ]);
        setDatasets(datasetsRes.data || []);
        setAlgorithms(algorithmsRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load initial data.');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const selectedDataset = useMemo(() => 
    datasets.find(d => d.id === datasetId), [datasets, datasetId]
  );

  const availableColumns = useMemo(() => {
    return selectedDataset?.schema?.columns.map(c => c.name) || [];
  }, [selectedDataset]);

  // Update feature columns when target changes
  useEffect(() => {
    if (availableColumns.length > 0 && targetColumn) {
      setFeatureColumns(availableColumns.filter(c => c !== targetColumn));
    }
  }, [targetColumn, availableColumns]);

  // Set default hyperparameters when algorithm changes
  useEffect(() => {
    const algo = algorithms.find(a => a.id === algorithmId);
    if (algo) {
      setHyperparameters(JSON.stringify(algo.defaultHyperparameters || {}, null, 2));
      if (algo.problemTypes.length === 1) {
        setProblemType(algo.problemTypes[0].toLowerCase() as any);
      }
    }
  }, [algorithmId, algorithms]);

  const handleFeatureToggle = (col: string) => {
    setFeatureColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleTrain = async () => {
    if (!datasetId || !targetColumn || !algorithmId || featureColumns.length === 0) {
      setError("Please fill in all required fields (Dataset, Target, Features, Algorithm).");
      return;
    }

    let parsedHp = {};
    try {
      parsedHp = JSON.parse(hyperparameters);
    } catch (e) {
      setError("Invalid Hyperparameters JSON.");
      return;
    }

    setIsTraining(true);
    setResult(null);
    setError(null);
    setTrainingStep(1);

    // Simulate training steps
    const interval = setInterval(() => {
      setTrainingStep(prev => prev < 4 ? prev + 1 : prev);
    }, 1500);

    try {
      const res = await apiClient.post('/ml/train', {
        datasetId,
        targetColumn,
        featureColumns,
        algorithmId,
        problemType,
        testSize,
        crossValidation,
        hyperparameters: parsedHp
      });
      clearInterval(interval);
      setTrainingStep(5);
      setResult(res.data);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Training failed.');
    } finally {
      setIsTraining(false);
    }
  };

  const getCvChartOption = () => {
    if (!result?.cvScores) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: result.cvScores.map((_, i) => `Fold ${i + 1}`),
        axisLabel: { color: 'var(--c-text-secondary)' }
      },
      yAxis: {
        type: 'value',
        min: 'dataMin',
        axisLabel: { color: 'var(--c-text-secondary)' },
        splitLine: { lineStyle: { color: 'var(--c-border-subtle)' } }
      },
      series: [{
        data: result.cvScores,
        type: 'bar',
        itemStyle: { color: 'var(--c-accent)' },
        label: { show: true, position: 'top', color: 'var(--c-text-primary)' }
      }]
    };
  };

  const copyModelName = () => {
    if (result) {
      navigator.clipboard.writeText(result.modelName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoadingData) {
    return (
      <div className="p-8 space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-1/4 rounded"></div>
        <div className="skeleton h-64 rounded"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <header>
        <h1 className="section-title flex items-center gap-3">
          <Cpu className="text-accent w-8 h-8" />
          Train New Model
        </h1>
        <p className="section-subtitle">Configure data and algorithms to train predictive models.</p>
      </header>

      {error && (
        <div className="glass-card p-4 border-l-4 border-l-danger flex items-center gap-3 text-danger">
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration Form */}
      {!result && !isTraining && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-lg font-medium flex items-center gap-2 mb-4 text-text-primary">
                <Database className="w-5 h-5" /> Data Selection
              </h2>
              
              <div>
                <label className="form-label">Dataset</label>
                <select 
                  className="form-select w-full"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.rows} rows, {d.columns} cols)
                    </option>
                  ))}
                </select>
              </div>

              {datasetId && availableColumns.length > 0 && (
                <>
                  <div>
                    <label className="form-label flex items-center gap-2">
                      <Target className="w-4 h-4" /> Target Column
                    </label>
                    <select 
                      className="form-select w-full"
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                    >
                      <option value="">Select target to predict...</option>
                      {availableColumns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label flex items-center gap-2">
                      <List className="w-4 h-4" /> Feature Columns
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-border-subtle rounded p-2 bg-bg-elevated space-y-1">
                      {availableColumns.filter(c => c !== targetColumn).map(col => (
                        <label key={col} className="flex items-center gap-2 p-1 hover:bg-bg-hover rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={featureColumns.includes(col)}
                            onChange={() => handleFeatureToggle(col)}
                            className="rounded border-border-subtle text-accent focus:ring-accent"
                          />
                          <span className="text-sm text-text-secondary">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-medium flex items-center gap-2 mb-4 text-text-primary">
                <Cpu className="w-5 h-5" /> Algorithm
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {algorithms.map(algo => (
                  <div 
                    key={algo.id}
                    onClick={() => setAlgorithmId(algo.id)}
                    className={`p-4 rounded border cursor-pointer transition-all ${
                      algorithmId === algo.id 
                        ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                        : 'border-border-subtle hover:border-accent/50 bg-bg-elevated'
                    }`}
                  >
                    <h3 className="font-medium text-text-primary mb-1">{algo.name}</h3>
                    <p className="text-sm text-text-secondary mb-3">{algo.description}</p>
                    <div className="flex gap-2">
                      {algo.problemTypes.map(pt => (
                        <span key={pt} className="badge badge-neutral text-xs">
                          {pt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {algorithmId && (
                <div className="space-y-6 animate-fade-in border-t border-border-subtle pt-6">
                  <h2 className="text-lg font-medium flex items-center gap-2 text-text-primary">
                    <Settings className="w-5 h-5" /> Configuration
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="form-label">Problem Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="problemType" value="classification" checked={problemType === 'classification'} onChange={() => setProblemType('classification')} />
                          Classification
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="problemType" value="regression" checked={problemType === 'regression'} onChange={() => setProblemType('regression')} />
                          Regression
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="form-label flex justify-between">
                        Test Size Split
                        <span className="text-accent">{testSize * 100}% Test</span>
                      </label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="0.4" 
                        step="0.05"
                        value={testSize}
                        onChange={(e) => setTestSize(parseFloat(e.target.value))}
                        className="w-full accent-accent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={crossValidation}
                          onChange={(e) => setCrossValidation(e.target.checked)}
                          className="rounded border-border-subtle text-accent focus:ring-accent"
                        />
                        <span className="text-text-primary">Enable Cross-Validation (5-fold)</span>
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="form-label">Hyperparameters (JSON)</label>
                      <textarea 
                        className="form-input w-full font-mono text-sm h-32"
                        value={hyperparameters}
                        onChange={(e) => setHyperparameters(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button onClick={handleTrain} className="btn btn-primary flex items-center gap-2">
                      <Play className="w-4 h-4" /> Start Training
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Training State */}
      {isTraining && (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in min-h-[400px]">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping"></div>
            <div className="relative bg-bg-elevated border-2 border-accent rounded-full p-6 text-accent">
              <Loader className="w-12 h-12 animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary text-gradient">Training Model...</h2>
          
          <div className="w-full max-w-md space-y-4 text-left mt-8">
            {[
              "Initializing environment...",
              "Preprocessing features...",
              "Fitting algorithm...",
              "Evaluating performance...",
              "Finalizing model..."
            ].map((step, idx) => (
              <div key={idx} className={`flex items-center gap-3 transition-opacity duration-300 ${
                trainingStep > idx ? 'text-success' : trainingStep === idx ? 'text-accent font-medium' : 'text-text-muted opacity-50'
              }`}>
                {trainingStep > idx ? <CheckCircle className="w-5 h-5" /> : trainingStep === idx ? <Loader className="w-5 h-5 animate-spin" /> : <div className="w-5 h-5 rounded-full border-2 border-text-muted" />}
                {step}
              </div>
            ))}
            <div className="w-full bg-bg-elevated rounded-full h-2 mt-4 overflow-hidden">
              <div className="progress-bar-fill h-full bg-accent transition-all duration-500" style={{ width: `${(trainingStep / 4) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {result && !isTraining && (
        <div className="glass-card p-8 space-y-8 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-8 h-8 text-success" />
                <h2 className="text-2xl font-semibold text-text-primary">Training Complete</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Model Name:</span>
                <code className="px-2 py-1 bg-bg-elevated rounded text-accent font-mono">{result.modelName}</code>
                <button onClick={copyModelName} className="text-text-secondary hover:text-accent p-1" title="Copy">
                  {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex items-center gap-2">
                Go to Models <ChevronRight className="w-4 h-4" />
              </button>
              <button className="btn btn-primary flex items-center gap-2">
                Make Predictions <TrendingUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card md:col-span-3 lg:col-span-1">
              <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Performance Metrics
              </h3>
              <div className="space-y-4">
                {Object.entries(result.metrics).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-primary capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-mono text-accent">{val.toFixed(4)}</span>
                    </div>
                    <div className="w-full bg-bg-elevated rounded-full h-1.5">
                      <div className="progress-bar-fill h-full bg-accent rounded-full" style={{ width: `${Math.min(val * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <span className="badge badge-info">
                  {result.featuresUsed.length} Features Used
                </span>
              </div>
            </div>

            {crossValidation && result.cvScores && (
              <div className="stat-card md:col-span-3 lg:col-span-2">
                <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" /> Cross-Validation Scores
                </h3>
                <div className="h-64">
                  <ReactECharts option={getCvChartOption()} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => {
                setResult(null);
                setTrainingStep(0);
              }} 
              className="btn btn-ghost"
            >
              Train Another Model
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

