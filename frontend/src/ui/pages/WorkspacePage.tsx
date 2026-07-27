import { useState, useEffect, useMemo } from 'react';
import { Database, Search, ChevronLeft, ChevronRight, Download, Info } from 'lucide-react';
import { apiClient } from '../lib/api';

interface Dataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  size_bytes: number;
  upload_date: string;
}

interface PreviewData {
  headers: string[];
  rows: any[][];
  total: number;
}

export function WorkspacePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const response = await apiClient.get('/datasets/');
        setDatasets(response.data);
      } catch (error) {
        console.error('Failed to fetch datasets', error);
      } finally {
        // done;
      }
    };
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) {
      setPreviewData(null);
      return;
    }

    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        // In a real app we might pass pagination params to the API
        const response = await apiClient.get(`/datasets/${selectedDatasetId}/preview?page=${page}&limit=${pageSize}`);
        setPreviewData(response.data);
      } catch (error) {
        console.error('Failed to fetch preview', error);
        setPreviewData(null);
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [selectedDatasetId, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  // Client-side filtering
  const filteredRows = useMemo(() => {
    if (!previewData || !searchTerm) return previewData?.rows || [];
    const lowerTerm = searchTerm.toLowerCase();
    return previewData.rows.filter(row => 
      row.some(cell => String(cell).toLowerCase().includes(lowerTerm))
    );
  }, [previewData, searchTerm]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExport = () => {
    if (!selectedDatasetId) return;
    // Simple redirect/open for download
    window.open(`${apiClient.defaults.baseURL}/datasets/${selectedDatasetId}/download`, '_blank');
  };

  return (
    <div className="animate-fade-in-up stagger-1 p-6 space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <header className="flex-none">
        <h1 className="section-title text-2xl font-bold">Data Workspace</h1>
        <p className="section-subtitle text-sm text-[var(--c-text-secondary)]">Explore, filter, and preview uploaded datasets.</p>
      </header>

      {/* Controls Area */}
      <div className="flex-none glass-card p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between z-10">
        <div className="flex-1 w-full flex items-center gap-4">
          <Database className="w-5 h-5 text-[var(--c-text-secondary)] hidden md:block" />
          <select 
            className="form-select w-full md:max-w-xs p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)]"
            value={selectedDatasetId}
            onChange={(e) => {
              setSelectedDatasetId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">-- Select a Dataset --</option>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {selectedDatasetId && (
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--c-text-secondary)]" />
              <input 
                type="text" 
                placeholder="Search columns..." 
                className="form-input w-full pl-9 p-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        {selectedDatasetId && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={handleExport} className="btn btn-secondary px-3 py-2 rounded-md flex items-center gap-2 text-sm whitespace-nowrap">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
        
        {/* Table View */}
        <div className="flex-1 glass-card rounded-xl border border-[var(--c-border)] flex flex-col min-h-0 overflow-hidden relative">
          {!selectedDatasetId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--c-text-secondary)] p-8 text-center h-full">
              <Database className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No Dataset Selected</p>
              <p className="text-sm opacity-70">Choose a dataset from the dropdown above to view its contents.</p>
            </div>
          ) : loadingPreview ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-[var(--c-accent)] border-t-transparent rounded-full" />
            </div>
          ) : previewData ? (
            <>
              <div className="flex-1 overflow-auto">
                <table className="data-table w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-[var(--c-bg-elevated)] text-[var(--c-text-secondary)] sticky top-0 shadow-sm z-10">
                    <tr>
                      {previewData.headers.map((h, i) => (
                        <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-[var(--c-border)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewData.headers.length} className="px-4 py-8 text-center text-[var(--c-text-secondary)]">
                          No matching records found in preview.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, i) => (
                        <tr key={i} className="border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-bg-elevated)]/50 transition-colors">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2.5 whitespace-nowrap max-w-[200px] truncate" title={String(cell)}>
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="flex-none p-3 border-t border-[var(--c-border)] bg-[var(--c-bg-elevated)] flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
                <div className="text-[var(--c-text-secondary)]">
                  Showing <span className="font-medium text-[var(--c-text)]">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-[var(--c-text)]">{Math.min(page * pageSize, previewData.total)}</span> of <span className="font-medium text-[var(--c-text)]">{previewData.total}</span> entries
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--c-text-secondary)]">Rows:</span>
                    <select 
                      className="p-1 rounded border border-[var(--c-border)] bg-[var(--c-bg)]"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded border border-[var(--c-border)] hover:bg-[var(--c-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-[var(--c-text-secondary)]">Page {page}</span>
                    <button 
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= previewData.total}
                      className="p-1.5 rounded border border-[var(--c-border)] hover:bg-[var(--c-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Info Panel */}
        {selectedDataset && (
          <div className="w-full md:w-64 flex-none flex flex-col gap-4">
            <div className="glass-card p-5 rounded-xl border border-[var(--c-border)]">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-[var(--c-text-secondary)]" />
                Metadata
              </h3>
              
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-[var(--c-text-secondary)] text-xs mb-1">Dataset Name</div>
                  <div className="font-medium truncate" title={selectedDataset.name}>{selectedDataset.name}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[var(--c-text-secondary)] text-xs mb-1">Rows</div>
                    <div className="font-mono">{selectedDataset.rows.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[var(--c-text-secondary)] text-xs mb-1">Columns</div>
                    <div className="font-mono">{selectedDataset.columns}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-[var(--c-text-secondary)] text-xs mb-1">File Size</div>
                  <div>{formatBytes(selectedDataset.size_bytes)}</div>
                </div>
                
                <div>
                  <div className="text-[var(--c-text-secondary)] text-xs mb-1">Uploaded</div>
                  <div>{new Date(selectedDataset.upload_date).toLocaleString()}</div>
                </div>
              </div>
            </div>
            
            <div className="glass-card p-4 rounded-xl border border-[var(--c-border)] bg-[var(--c-accent)]/5 border-[var(--c-accent)]/20">
              <p className="text-xs text-[var(--c-text-secondary)] leading-relaxed">
                <strong className="text-[var(--c-accent)] block mb-1">Tip:</strong>
                Use the search bar to filter rows client-side on the current page, or export the full dataset to analyze it locally.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
