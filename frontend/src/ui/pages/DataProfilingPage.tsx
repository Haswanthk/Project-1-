import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  Database,
  BarChart2,
  Table as TableIcon,
  Activity,
  AlertTriangle,
  FileText,
  Layers,
  Hash,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../lib/api';

interface Dataset {
  id: string;
  name: string;
  profiling_status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  row_count: number;
  column_count: number;
  file_size_bytes: number;
  duplicate_rows: number;
}

interface ColumnStat {
  column_name: string;
  type: string;
  missing_count: number;
  missing_percent: number;
  unique_count: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  histogram?: {
    bins: string[];
    counts: number[];
  };
  class_imbalance?: {
    labels: string[];
    counts: number[];
  };
}

interface ProfileData {
  columns: ColumnStat[];
  correlation_matrix: {
    columns: string[];
    values: number[][];
  };
  outliers: {
    column_name: string;
    outlier_count: number;
  }[];
}

interface PcaData {
  points: { x: number; y: number; label?: string }[];
  explained_variance: number[];
}

type SortConfig = { key: keyof ColumnStat; direction: 'asc' | 'desc' } | null;

export function DataProfilingPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [pcaData, setPcaData] = useState<PcaData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const fetchDatasets = async () => {
    try {
      const response = await apiClient.get('/datasets/');
      setDatasets(response.data);
      if (response.data.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(response.data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch datasets.');
    } finally {
      setLoadingDatasets(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const selectedDataset = useMemo(() => {
    return datasets.find(d => d.id === selectedDatasetId) || null;
  }, [datasets, selectedDatasetId]);

  // Polling for profiling status
  useEffect(() => {
    let pollInterval: ReturnType<typeof setTimeout>;

    if (selectedDataset && ['PENDING', 'PROCESSING'].includes(selectedDataset.profiling_status)) {
      pollInterval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/datasets/`);
          setDatasets(response.data);
        } catch (err) {
          console.error('Failed to poll status', err);
        }
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedDataset]);

  // Fetch profile and pca when dataset is DONE
  useEffect(() => {
    const fetchData = async () => {
      if (selectedDataset && selectedDataset.profiling_status === 'DONE') {
        setLoadingProfile(true);
        setProfileData(null);
        setPcaData(null);
        try {
          const [profileRes, pcaRes] = await Promise.all([
            apiClient.get(`/datasets/${selectedDataset.id}/profile`),
            apiClient.get(`/datasets/${selectedDataset.id}/pca`).catch(() => ({ data: null }))
          ]);
          setProfileData(profileRes.data);
          setPcaData(pcaRes.data);
        } catch (err) {
          setError('Failed to fetch profiling data.');
        } finally {
          setLoadingProfile(false);
        }
      }
    };

    fetchData();
  }, [selectedDataset]);

  const handleSort = (key: keyof ColumnStat) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedColumns = useMemo(() => {
    if (!profileData) return [];
    let sortableItems = [...profileData.columns];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? 0;
        const bValue = b[sortConfig.key] ?? 0;
        
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [profileData, sortConfig]);

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-';
    return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const commonChartOptions = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'inherit', color: 'var(--c-text-secondary)' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  };

  if (loadingDatasets) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-12 w-1/3 rounded"></div>
        <div className="skeleton h-64 w-full rounded"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in-up">
        <div>
          <h1 className="section-title">Data Profiling & Quality Analysis</h1>
          <p className="section-subtitle">Deep dive into dataset statistics, quality metrics, and distributions.</p>
        </div>
        <div className="w-full md:w-64">
          <label className="form-label">Select Dataset</label>
          <div className="relative">
            <select
              className="form-select w-full"
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--c-danger-transparent)] border border-[var(--c-danger)] rounded-lg flex items-center gap-2 text-[var(--c-danger)]">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {selectedDataset && (
        <>
          {/* Status Banner */}
          {selectedDataset.profiling_status !== 'DONE' && (
            <div className={`p-4 rounded-lg flex items-center gap-3 animate-fade-in-up stagger-1 ${
              selectedDataset.profiling_status === 'FAILED' 
                ? 'bg-[var(--c-danger-transparent)] text-[var(--c-danger)]' 
                : 'bg-[var(--c-warning-transparent)] text-[var(--c-warning)]'
            }`}>
              {selectedDataset.profiling_status === 'FAILED' ? <AlertCircle /> : <RefreshCw className="animate-spin" />}
              <div>
                <h3 className="font-semibold">
                  Profiling Status: {selectedDataset.profiling_status}
                </h3>
                <p className="text-sm opacity-80">
                  {selectedDataset.profiling_status === 'FAILED' 
                    ? 'Failed to profile this dataset.' 
                    : 'The dataset is currently being processed. Statistics will appear once complete.'}
                </p>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up stagger-2">
            <div className="stat-card">
              <div className="flex items-center gap-2 text-[var(--c-text-secondary)] mb-2">
                <Layers size={18} /> <span>Rows</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(selectedDataset.row_count)}</div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-[var(--c-text-secondary)] mb-2">
                <TableIcon size={18} /> <span>Columns</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(selectedDataset.column_count)}</div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-[var(--c-text-secondary)] mb-2">
                <FileText size={18} /> <span>Size</span>
              </div>
              <div className="text-2xl font-bold">{formatBytes(selectedDataset.file_size_bytes)}</div>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-[var(--c-text-secondary)] mb-2">
                <Copy size={18} /> <span>Duplicates</span>
              </div>
              <div className="text-2xl font-bold">{formatNumber(selectedDataset.duplicate_rows)}</div>
            </div>
          </div>

          {loadingProfile && selectedDataset.profiling_status === 'DONE' && (
            <div className="space-y-4 animate-fade-in-up stagger-3">
              <div className="skeleton h-10 w-full rounded"></div>
              <div className="skeleton h-64 w-full rounded"></div>
            </div>
          )}

          {profileData && !loadingProfile && (
            <div className="space-y-8 animate-fade-in-up stagger-3">
              
              {/* Column Statistics Table */}
              <div className="glass-card p-6 overflow-hidden">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database size={20} className="text-[var(--c-accent)]" /> 
                  Column Statistics
                </h3>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-left border-collapse">
                    <thead>
                      <tr>
                        {[
                          { key: 'column_name', label: 'Column Name' },
                          { key: 'type', label: 'Type' },
                          { key: 'missing_count', label: 'Missing' },
                          { key: 'missing_percent', label: 'Missing %' },
                          { key: 'unique_count', label: 'Unique' },
                          { key: 'mean', label: 'Mean' },
                          { key: 'min', label: 'Min' },
                          { key: 'max', label: 'Max' },
                        ].map((col) => (
                          <th 
                            key={col.key}
                            className="cursor-pointer hover:bg-[var(--c-bg-hover)] select-none whitespace-nowrap px-4 py-3 border-b border-[var(--c-border)] text-sm font-semibold text-[var(--c-text-secondary)]"
                            onClick={() => handleSort(col.key as keyof ColumnStat)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {sortConfig?.key === col.key && (
                                sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedColumns.map((col) => (
                        <tr key={col.column_name} className="hover:bg-[var(--c-bg-hover)] border-b border-[var(--c-border)] last:border-0 transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--c-text-primary)]">{col.column_name}</td>
                          <td className="px-4 py-3">
                            <span className="badge badge-neutral text-xs">{col.type}</span>
                          </td>
                          <td className="px-4 py-3">{formatNumber(col.missing_count)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{formatNumber(col.missing_percent)}%</span>
                              {col.missing_percent > 0 && (
                                <div className="w-16 h-1.5 bg-[var(--c-bg-tertiary)] rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${col.missing_percent > 20 ? 'bg-[var(--c-danger)]' : 'bg-[var(--c-warning)]'}`} 
                                    style={{ width: `${Math.min(col.missing_percent, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatNumber(col.unique_count)}</td>
                          <td className="px-4 py-3">{formatNumber(col.mean)}</td>
                          <td className="px-4 py-3">{formatNumber(col.min)}</td>
                          <td className="px-4 py-3">{formatNumber(col.max)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Distributions (Histograms) */}
              {profileData.columns.some(c => c.histogram) && (
                <div className="space-y-4">
                  <h3 className="section-title text-xl flex items-center gap-2">
                    <BarChart2 size={24} className="text-[var(--c-accent)]" />
                    Numeric Distributions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {profileData.columns.filter(c => c.histogram).slice(0, 8).map(col => (
                      <div key={col.column_name} className="glass-card p-4">
                        <h4 className="text-sm font-medium mb-2 text-center text-truncate">{col.column_name}</h4>
                        <ReactECharts
                          option={{
                            ...commonChartOptions,
                            grid: { top: 10, right: 10, bottom: 20, left: 40 },
                            xAxis: { type: 'category', data: col.histogram?.bins, axisLabel: { show: false } },
                            yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--c-border)' } } },
                            series: [{
                              data: col.histogram?.counts,
                              type: 'bar',
                              itemStyle: { color: 'var(--c-accent)', borderRadius: [4, 4, 0, 0] }
                            }]
                          }}
                          style={{ height: '180px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced Analytics Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Correlation Heatmap */}
                {profileData.correlation_matrix && profileData.correlation_matrix.columns.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity size={20} className="text-[var(--c-accent)]" />
                      Correlation Matrix
                    </h3>
                    <ReactECharts
                      option={{
                        tooltip: { position: 'top' },
                        grid: { top: '10%', right: '10%', bottom: '20%', left: '20%' },
                        xAxis: {
                          type: 'category',
                          data: profileData.correlation_matrix.columns,
                          splitArea: { show: true },
                          axisLabel: { interval: 0, rotate: 45, color: 'var(--c-text-secondary)' }
                        },
                        yAxis: {
                          type: 'category',
                          data: profileData.correlation_matrix.columns,
                          splitArea: { show: true },
                          axisLabel: { color: 'var(--c-text-secondary)' }
                        },
                        visualMap: {
                          min: -1,
                          max: 1,
                          calculable: true,
                          orient: 'horizontal',
                          left: 'center',
                          bottom: 0,
                          inRange: {
                            color: ['var(--c-danger)', 'var(--c-bg-elevated)', 'var(--c-success)']
                          },
                          textStyle: { color: 'var(--c-text-secondary)' }
                        },
                        series: [{
                          name: 'Correlation',
                          type: 'heatmap',
                          data: profileData.correlation_matrix.columns.flatMap((_, i) => 
                            profileData.correlation_matrix.columns.map((_, j) => [
                              i, j, profileData.correlation_matrix.values[i][j]
                            ])
                          ),
                          label: { show: false },
                          itemStyle: {
                            borderColor: 'var(--c-bg)',
                            borderWidth: 2
                          }
                        }]
                      }}
                      style={{ height: '400px' }}
                    />
                  </div>
                )}

                {/* Outliers & Imbalance */}
                <div className="space-y-6">
                  {/* Outliers */}
                  {profileData.outliers && profileData.outliers.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-[var(--c-warning)]" />
                        Outlier Detection
                      </h3>
                      <ReactECharts
                        option={{
                          ...commonChartOptions,
                          grid: { top: 10, right: 30, bottom: 20, left: 100 },
                          xAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--c-border)' } } },
                          yAxis: { 
                            type: 'category', 
                            data: profileData.outliers.map(o => o.column_name),
                            axisLabel: { color: 'var(--c-text-secondary)' }
                          },
                          series: [{
                            type: 'bar',
                            data: profileData.outliers.map(o => o.outlier_count),
                            itemStyle: { color: 'var(--c-warning)', borderRadius: [0, 4, 4, 0] },
                            label: { show: true, position: 'right', color: 'var(--c-text-primary)' }
                          }]
                        }}
                        style={{ height: '180px' }}
                      />
                    </div>
                  )}

                  {/* Class Imbalance */}
                  {profileData.columns.find(c => c.class_imbalance) && (
                    <div className="glass-card p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Hash size={20} className="text-[var(--c-accent)]" />
                        Categorical Distribution (Top)
                      </h3>
                      {profileData.columns.filter(c => c.class_imbalance).slice(0, 1).map(col => (
                        <div key={col.column_name}>
                          <p className="text-sm text-[var(--c-text-secondary)] mb-2">Column: {col.column_name}</p>
                          <ReactECharts
                            option={{
                              ...commonChartOptions,
                              grid: { top: 10, right: 30, bottom: 20, left: 100 },
                              xAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--c-border)' } } },
                              yAxis: { 
                                type: 'category', 
                                data: col.class_imbalance?.labels,
                                axisLabel: { color: 'var(--c-text-secondary)' }
                              },
                              series: [{
                                type: 'bar',
                                data: col.class_imbalance?.counts,
                                itemStyle: { color: 'var(--c-info)', borderRadius: [0, 4, 4, 0] },
                              }]
                            }}
                            style={{ height: '180px' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* PCA Scatter Plot */}
              {pcaData && pcaData.points && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Activity size={20} className="text-[var(--c-success)]" />
                    Principal Component Analysis (2D Projection)
                  </h3>
                  <p className="text-sm text-[var(--c-text-secondary)] mb-4">
                    Explained Variance: PC1 ({formatNumber(pcaData.explained_variance[0] * 100)}%), PC2 ({formatNumber(pcaData.explained_variance[1] * 100)}%)
                  </p>
                  <ReactECharts
                    option={{
                      ...commonChartOptions,
                      tooltip: {
                        trigger: 'item',
                        formatter: function (params: any) {
                          return `PC1: ${params.value[0].toFixed(2)}<br/>PC2: ${params.value[1].toFixed(2)}${params.data.label ? '<br/>Label: ' + params.data.label : ''}`;
                        }
                      },
                      grid: { top: 20, right: 20, bottom: 40, left: 40 },
                      xAxis: { type: 'value', name: 'PC1', nameLocation: 'middle', nameGap: 25, splitLine: { lineStyle: { color: 'var(--c-border)' } }, axisLabel: { color: 'var(--c-text-secondary)' } },
                      yAxis: { type: 'value', name: 'PC2', nameLocation: 'middle', nameGap: 25, splitLine: { lineStyle: { color: 'var(--c-border)' } }, axisLabel: { color: 'var(--c-text-secondary)' } },
                      series: [{
                        type: 'scatter',
                        symbolSize: 6,
                        data: pcaData.points.map(p => ({
                          value: [p.x, p.y],
                          label: p.label
                        })),
                        itemStyle: { color: 'var(--c-accent)', opacity: 0.7 }
                      }]
                    }}
                    style={{ height: '400px' }}
                  />
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
}
