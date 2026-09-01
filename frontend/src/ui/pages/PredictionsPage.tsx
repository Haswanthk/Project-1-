import { useState, useEffect } from 'react';
import { Play, Upload, History, FileDown, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../lib/api';

interface Model {
  id: string;
  name: string;
  algorithm: string;
  problem_type: string;
  features: string[];
}

interface PredictionResult {
  prediction: any;
  probabilities?: Record<string, number>;
}

interface PredictionHistoryItem {
  id: string;
  modelName: string;
  inputs: Record<string, any>;
  result: PredictionResult;
  timestamp: Date;
}

export function PredictionsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(true);
  
  const [featureInputs, setFeatureInputs] = useState<Record<string, string>>({});
  const [predicting, setPredicting] = useState(false);
  const [currentResult, setCurrentResult] = useState<PredictionResult | null>(null);
  
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await apiClient.get('/ml/models');
        setModels(response.data);
      } catch (error) {
        console.error('Failed to fetch models', error);
      } finally {
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, []);

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    setCurrentResult(null);
    
    const model = models.find(m => m.id === modelId);
    if (model) {
      const initialInputs: Record<string, string> = {};
      model.features.forEach(f => {
        initialInputs[f] = '';
      });
      setFeatureInputs(initialInputs);
    }
  };

  const handleFeatureInputChange = (feature: string, value: string) => {
    setFeatureInputs(prev => ({
      ...prev,
      [feature]: value
    }));
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) return;
    
    setPredicting(true);
    setCurrentResult(null);
    
    try {
      // Parse inputs as numbers where possible
      const parsedInputs: Record<string, any> = {};
      Object.entries(featureInputs).forEach(([k, v]) => {
        const num = Number(v);
        parsedInputs[k] = isNaN(num) ? v : num;
      });

      const response = await apiClient.post('/ml/predict', {
        model_id: selectedModel,
        features: parsedInputs
      });
      
      const result = response.data as PredictionResult;
      setCurrentResult(result);
      
      const modelName = models.find(m => m.id === selectedModel)?.name || 'Unknown Model';
      
      setHistory(prev => {
        const newHistory = [
          {
            id: Date.now().toString(),
            modelName,
            inputs: parsedInputs,
            result,
            timestamp: new Date()
          },
          ...prev
        ];
        return newHistory.slice(0, 20); // Keep last 20
      });
      
    } catch (error) {
      console.error('Prediction failed', error);
    } finally {
      setPredicting(false);
    }
  };

  const model = models.find(m => m.id === selectedModel);

  return (
    <div className="animate-fade-in-up stagger-1 p-6 space-y-6">
      <header className="mb-6">
        <h1 className="section-title text-2xl font-bold">Predictions</h1>
        <p className="section-subtitle text-sm text-[var(--c-text-secondary)]">Run real-time and batch predictions using deployed models.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Prediction Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4">Single Prediction</h2>
            
            {loadingModels ? (
              <div className="skeleton h-10 w-full rounded-md mb-4"></div>
            ) : (
              <div className="mb-6">
                <label className="form-label block text-sm font-medium mb-1">Select Model</label>
                <select 
                  className="form-select w-full p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)]"
                  value={selectedModel}
                  onChange={handleModelSelect}
                >
                  <option value="">-- Choose a model --</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.algorithm}) - {m.problem_type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {model && (
              <form onSubmit={handlePredict} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {model.features.map(feature => (
                    <div key={feature}>
                      <label className="form-label block text-sm font-medium mb-1 capitalize">
                        {feature.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input w-full p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] focus:ring focus:ring-[var(--c-accent)]"
                        value={featureInputs[feature] || ''}
                        onChange={(e) => handleFeatureInputChange(feature, e.target.value)}
                        placeholder={`Enter ${feature}`}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={predicting}
                    className="btn btn-primary flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {predicting ? (
                      <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run Prediction
                  </button>
                </div>
              </form>
            )}

            {currentResult && (
              <div className="mt-8 p-4 rounded-lg bg-[var(--c-bg-elevated)] border border-[var(--c-border)] animate-fade-in">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Prediction Result
                </h3>
                
                <div className="text-3xl font-bold text-gradient mb-6">
                  {String(currentResult.prediction)}
                </div>

                {currentResult.probabilities && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-[var(--c-text-secondary)]">Class Probabilities</h4>
                    {Object.entries(currentResult.probabilities).map(([className, prob]) => (
                      <div key={className} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{className}</span>
                          <span className="font-mono">{(prob * 100).toFixed(1)}%</span>
                        </div>
                        <div className="progress-bar w-full h-2 bg-[var(--c-bg)] rounded-full overflow-hidden">
                          <div 
                            className="progress-bar-fill h-full bg-[var(--c-accent)] transition-all duration-1000"
                            style={{ width: `${prob * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Batch Prediction */}
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[var(--c-text-secondary)]" />
              Batch Prediction
            </h2>
            <p className="text-sm text-[var(--c-text-secondary)] mb-4">
              Upload a CSV file containing multiple records for batch processing. The file must contain columns matching the selected model's features.
            </p>
            
            <div className="border-2 border-dashed border-[var(--c-border)] rounded-xl p-8 text-center flex flex-col items-center justify-center relative overflow-hidden bg-[var(--c-bg)]">
              <div className="absolute inset-0 bg-white/5 flex items-center justify-center backdrop-blur-[1px] z-10">
                <span className="px-3 py-1 bg-[var(--c-bg-elevated)] border border-[var(--c-border)] rounded-full text-sm font-medium shadow-sm">
                  Coming Soon
                </span>
              </div>
              <FileDown className="w-10 h-10 text-[var(--c-text-secondary)] mb-3 opacity-50" />
              <p className="text-sm font-medium opacity-50">Drag & drop CSV file here</p>
              <p className="text-xs text-[var(--c-text-secondary)] mt-1 opacity-50">Max size 10MB</p>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 rounded-xl h-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--c-text-secondary)]" />
              Recent History
            </h2>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-[var(--c-text-secondary)] text-sm">
                  No recent predictions in this session.
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-bg)] hover:bg-[var(--c-bg-elevated)] transition-colors text-sm animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium truncate pr-2">{item.modelName}</span>
                      <span className="text-xs text-[var(--c-text-secondary)] whitespace-nowrap">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--c-text-secondary)]">Result</span>
                      <div className="font-bold text-[var(--c-accent)]">{String(item.result.prediction)}</div>
                    </div>
                    <div className="text-xs text-[var(--c-text-secondary)] truncate">
                      Inputs: {JSON.stringify(item.inputs).replace(/["{}]/g, '').substring(0, 50)}...
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

