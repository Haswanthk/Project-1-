import React, { useState, useEffect } from 'react';
import { Plus, Database, Link as LinkIcon, FileJson, Trash2, Activity, PlaySquare } from 'lucide-react';
import { apiClient } from '../lib/api';

interface Connector {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'error' | 'pending';
  last_tested?: string;
  description?: string;
}

export function DataConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConnector, setNewConnector] = useState({
    name: '',
    type: 'postgres',
    description: '',
    config: ''
  });
  
  const [testResults, setTestResults] = useState<Record<string, { status: string, message?: string }>>({});
  const [previewData, setPreviewData] = useState<{ headers: string[], rows: any[][] } | null>(null);


  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchConnectors = async () => {
    try {
      const response = await apiClient.get('/connectors/');
      setConnectors(response.data);
    } catch (error) {
      console.error('Failed to fetch connectors', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestResults(prev => ({ ...prev, [id]: { status: 'testing' } }));
    try {
      const res = await apiClient.post(`/connectors/${id}/test`);
      setTestResults(prev => ({ 
        ...prev, 
        [id]: { status: res.data.success ? 'success' : 'error', message: res.data.message } 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [id]: { status: 'error', message: 'Network or server error' } 
      }));
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const res = await apiClient.get(`/connectors/${id}/preview`);
      setPreviewData(res.data);
    } catch (error) {
      console.error('Preview failed', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this connector?')) return;
    try {
      await apiClient.delete(`/connectors/${id}`);
      setConnectors(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: newConnector.name,
        type: newConnector.type,
        description: newConnector.description
      };
      
      if (['postgres', 'mysql'].includes(newConnector.type)) {
        payload.connection_string = newConnector.config;
      } else if (newConnector.type === 'rest') {
        payload.base_url = newConnector.config;
      } else {
        payload.url = newConnector.config;
      }
      
      const res = await apiClient.post('/connectors/', payload);
      setConnectors(prev => [...prev, res.data]);
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add connector', error);
    }
  };

  const getTypeIcon = (type: string) => {
    if (['postgres', 'mysql'].includes(type)) return <Database className="w-4 h-4" />;
    if (['csv_url', 'json_url'].includes(type)) return <FileJson className="w-4 h-4" />;
    return <LinkIcon className="w-4 h-4" />;
  };
  
  const getTypeBadgeClass = (type: string) => {
    if (['postgres', 'mysql'].includes(type)) return 'badge-info';
    if (type === 'rest') return 'badge-accent';
    return 'badge-neutral';
  };

  return (
    <div className="animate-fade-in-up stagger-1 p-6 space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="section-title text-2xl font-bold">Data Connectors</h1>
          <p className="section-subtitle text-sm text-[var(--c-text-secondary)]">Manage integrations with external data sources and APIs.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary px-4 py-2 rounded-md flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Connector
        </button>
      </header>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="skeleton h-12 w-full rounded"></div>
            <div className="skeleton h-12 w-full rounded"></div>
            <div className="skeleton h-12 w-full rounded"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm text-left">
              <thead className="text-xs uppercase bg-[var(--c-bg-elevated)] text-[var(--c-text-secondary)] border-b border-[var(--c-border)]">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Last Tested</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connectors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--c-text-secondary)]">
                      No data connectors found. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  connectors.map(connector => (
                    <tr key={connector.id} className="border-b border-[var(--c-border)] hover:bg-[var(--c-bg-elevated)] transition-colors">
                      <td className="px-6 py-4 font-medium">{connector.name}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${getTypeBadgeClass(connector.type)} px-2.5 py-0.5 rounded-full text-xs flex w-fit items-center gap-1.5`}>
                          {getTypeIcon(connector.type)}
                          {connector.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            connector.status === 'active' ? 'bg-green-500' :
                            connector.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></span>
                          <span className="capitalize">{connector.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--c-text-secondary)]">
                        {connector.last_tested ? new Date(connector.last_tested).toLocaleDateString() : 'Never'}
                        
                        {testResults[connector.id] && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                            testResults[connector.id].status === 'success' ? 'bg-green-500/10 text-green-500' :
                            testResults[connector.id].status === 'testing' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {testResults[connector.id].status === 'testing' ? 'Testing...' : testResults[connector.id].status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 flex justify-end gap-2">
                        <button 
                          onClick={() => handleTest(connector.id)}
                          className="p-1.5 text-[var(--c-text-secondary)] hover:text-blue-500 rounded bg-[var(--c-bg)] border border-[var(--c-border)] transition-colors"
                          title="Test Connection"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePreview(connector.id)}
                          className="p-1.5 text-[var(--c-text-secondary)] hover:text-[var(--c-accent)] rounded bg-[var(--c-bg)] border border-[var(--c-border)] transition-colors"
                          title="Preview Data"
                        >
                          <PlaySquare className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(connector.id)}
                          className="p-1.5 text-[var(--c-text-secondary)] hover:text-red-500 rounded bg-[var(--c-bg)] border border-[var(--c-border)] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {previewData && (
        <div className="glass-card p-6 rounded-xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Data Preview</h3>
            <button onClick={() => setPreviewData(null)} className="text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)]">Close</button>
          </div>
          <div className="overflow-x-auto border border-[var(--c-border)] rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-[var(--c-bg-elevated)] border-b border-[var(--c-border)]">
                <tr>
                  {previewData.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-bg-elevated)]/50">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3">{String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="glass-card bg-[var(--c-bg)] w-full max-w-md rounded-xl shadow-2xl border border-[var(--c-border)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--c-border)] flex justify-between items-center bg-[var(--c-bg-elevated)]">
              <h2 className="text-lg font-bold">Add Data Connector</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--c-text-secondary)] hover:text-[var(--c-text)]">&times;</button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                  required 
                  className="form-input w-full p-2 border border-[var(--c-border)] rounded bg-transparent" 
                  value={newConnector.name}
                  onChange={e => setNewConnector({...newConnector, name: e.target.value})}
                  placeholder="e.g. Production Analytics DB"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select 
                  className="form-input w-full p-2 border border-[var(--c-border)] rounded bg-[var(--c-bg)]"
                  value={newConnector.type}
                  onChange={e => setNewConnector({...newConnector, type: e.target.value, config: ''})}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="rest">REST API</option>
                  <option value="csv_url">CSV (URL)</option>
                  <option value="json_url">JSON (URL)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {['postgres', 'mysql'].includes(newConnector.type) ? 'Connection String' : 'URL / Base URL'}
                </label>
                <input 
                  required 
                  className="form-input w-full p-2 border border-[var(--c-border)] rounded bg-transparent font-mono text-sm" 
                  value={newConnector.config}
                  onChange={e => setNewConnector({...newConnector, config: e.target.value})}
                  placeholder={['postgres', 'mysql'].includes(newConnector.type) ? "postgresql://user:pass@localhost:5432/db" : "https://api.example.com/data"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea 
                  className="form-input w-full p-2 border border-[var(--c-border)] rounded bg-transparent text-sm" 
                  rows={2}
                  value={newConnector.description}
                  onChange={e => setNewConnector({...newConnector, description: e.target.value})}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm border border-[var(--c-border)] rounded hover:bg-[var(--c-bg-elevated)] transition-colors">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 text-sm rounded transition-colors">
                  Save Connector
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
