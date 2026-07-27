import React, { useState, useEffect } from 'react';
import {
  FileText, FileSpreadsheet, FileJson, FileCode,
  Download, Trash2, Plus, Play, Clock, Calendar, CheckCircle, AlertCircle, Loader2,
  File
} from 'lucide-react';
import { apiClient } from '../lib/api';

interface Report {
  id: string;
  title: string;
  format: 'PDF' | 'Excel' | 'HTML' | 'JSON';
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  createdAt: string;
}

interface Schedule {
  id: string;
  title: string;
  cronExpression: string;
  format: 'PDF' | 'Excel' | 'HTML' | 'JSON';
  recipients: string;
  active: boolean;
}

interface Dataset {
  id: string;
  name: string;
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'reports' | 'schedules'>('reports');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [reports, setReports] = useState<Report[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  // Forms
  const [reportForm, setReportForm] = useState({
    title: '',
    format: 'PDF',
    datasetIds: [] as string[],
    sections: {
      executiveSummary: false,
      dataProfiling: false,
      mlMetrics: false
    }
  });

  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    cronExpression: '',
    format: 'PDF',
    recipients: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, schedulesRes, datasetsRes] = await Promise.all([
        apiClient.get('/reports/').catch(() => ({ data: [] })),
        apiClient.get('/reports/schedules').catch(() => ({ data: [] })),
        apiClient.get('/datasets/').catch(() => ({ data: [] }))
      ]);
      setReports(reportsRes.data || []);
      setSchedules(schedulesRes.data || []);
      setDatasets(datasetsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await apiClient.post('/reports/generate', {
        title: reportForm.title,
        format: reportForm.format,
        datasetIds: reportForm.datasetIds,
        sections: Object.entries(reportForm.sections)
          .filter(([_, value]) => value)
          .map(([key]) => key)
      });
      // Assuming it returns the new report
      setReports([res.data, ...reports]);
      setReportForm({
        title: '',
        format: 'PDF',
        datasetIds: [],
        sections: { executiveSummary: false, dataProfiling: false, mlMetrics: false }
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSchedule(true);
    try {
      const res = await apiClient.post('/reports/schedules', {
        ...scheduleForm,
        recipients: scheduleForm.recipients.split(',').map(e => e.trim())
      });
      setSchedules([res.data, ...schedules]);
      setScheduleForm({ title: '', cronExpression: '', format: 'PDF', recipients: '' });
    } catch (error) {
      console.error('Error creating schedule:', error);
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  const downloadReport = async (id: string) => {
    try {
      const res = await apiClient.get(`/reports/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${id}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await apiClient.delete(`/reports/${id}`);
      setReports(reports.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await apiClient.delete(`/reports/schedules/${id}`);
      setSchedules(schedules.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const toggleScheduleActive = async (schedule: Schedule) => {
    try {
      const res = await apiClient.put(`/reports/schedules/${schedule.id}`, {
        ...schedule,
        active: !schedule.active
      });
      setSchedules(schedules.map(s => s.id === schedule.id ? res.data : s));
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  const getFormatBadgeClass = (format: string) => {
    switch (format) {
      case 'PDF': return 'badge-error';
      case 'Excel': return 'badge-success';
      case 'HTML': return 'badge-info';
      case 'JSON': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'PDF': return <FileText size={16} className="mr-2" />;
      case 'Excel': return <FileSpreadsheet size={16} className="mr-2" />;
      case 'HTML': return <FileCode size={16} className="mr-2" />;
      case 'JSON': return <FileJson size={16} className="mr-2" />;
      default: return <File size={16} className="mr-2" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h1 className="section-title">Reports & Schedules</h1>
        <p className="section-subtitle">Generate ad-hoc reports or schedule automated deliveries.</p>
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={18} className="mr-2" />
          Reports
        </button>
        <button
          className={`btn ${activeTab === 'schedules' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('schedules')}
        >
          <Clock size={18} className="mr-2" />
          Schedules
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-32 w-full rounded-xl"></div>
          <div className="skeleton h-64 w-full rounded-xl"></div>
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-8 stagger-1">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center" style={{ color: 'var(--c-text-primary)' }}>
              <Plus size={20} className="mr-2" />
              Generate New Report
            </h2>
            
            <form onSubmit={handleGenerateReport} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Report Title</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={reportForm.title}
                    onChange={e => setReportForm({ ...reportForm, title: e.target.value })}
                    placeholder="e.g., Q3 Monthly Analytics"
                  />
                </div>
                <div>
                  <label className="form-label">Export Format</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['PDF', 'Excel', 'HTML', 'JSON'].map((fmt) => (
                      <button
                        type="button"
                        key={fmt}
                        onClick={() => setReportForm({ ...reportForm, format: fmt })}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                          reportForm.format === fmt
                            ? 'border-[var(--c-accent)] bg-[var(--c-accent)] bg-opacity-10 text-[var(--c-accent)]'
                            : 'border-[var(--c-border)] hover:bg-[var(--c-bg-hover)]'
                        }`}
                      >
                        {getFormatIcon(fmt)}
                        <span className="text-sm mt-2">{fmt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Include Datasets</label>
                <select
                  multiple
                  className="form-select h-32"
                  value={reportForm.datasetIds}
                  onChange={e => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setReportForm({ ...reportForm, datasetIds: values });
                  }}
                >
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-secondary)' }}>Hold Ctrl/Cmd to select multiple datasets.</p>
              </div>

              <div>
                <label className="form-label mb-3 block">Report Sections</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                      checked={reportForm.sections.executiveSummary}
                      onChange={e => setReportForm({ ...reportForm, sections: { ...reportForm.sections, executiveSummary: e.target.checked } })}
                    />
                    <span style={{ color: 'var(--c-text-secondary)' }}>Executive Summary</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                      checked={reportForm.sections.dataProfiling}
                      onChange={e => setReportForm({ ...reportForm, sections: { ...reportForm.sections, dataProfiling: e.target.checked } })}
                    />
                    <span style={{ color: 'var(--c-text-secondary)' }}>Data Profiling Charts</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                      checked={reportForm.sections.mlMetrics}
                      onChange={e => setReportForm({ ...reportForm, sections: { ...reportForm.sections, mlMetrics: e.target.checked } })}
                    />
                    <span style={{ color: 'var(--c-text-secondary)' }}>ML Metrics</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="animate-spin mr-2" size={18} /> : <Play size={18} className="mr-2" />}
                  Generate Report
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--c-border)]">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--c-text-primary)' }}>Recent Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Format</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="font-medium" style={{ color: 'var(--c-text-primary)' }}>{report.title}</td>
                      <td>
                        <span className={`badge ${getFormatBadgeClass(report.format)}`}>
                          {report.format}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          report.status === 'COMPLETED' ? 'badge-success' :
                          report.status === 'PROCESSING' ? 'badge-warning' : 'badge-error'
                        }`}>
                          {report.status === 'COMPLETED' && <CheckCircle size={14} className="mr-1" />}
                          {report.status === 'PROCESSING' && <Loader2 size={14} className="animate-spin mr-1" />}
                          {report.status === 'FAILED' && <AlertCircle size={14} className="mr-1" />}
                          {report.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--c-text-secondary)' }}>
                        {new Date(report.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => downloadReport(report.id)}
                            disabled={report.status !== 'COMPLETED'}
                            className="btn btn-ghost p-2"
                            title="Download"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => deleteReport(report.id)}
                            className="btn btn-ghost text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8" style={{ color: 'var(--c-text-secondary)' }}>
                        No reports found. Generate one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 stagger-2">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center" style={{ color: 'var(--c-text-primary)' }}>
              <Calendar size={20} className="mr-2" />
              Create Schedule
            </h2>
            
            <form onSubmit={handleCreateSchedule} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Schedule Title</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={scheduleForm.title}
                    onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                    placeholder="e.g., Weekly Summary"
                  />
                </div>
                <div>
                  <label className="form-label">Cron Expression</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={scheduleForm.cronExpression}
                    onChange={e => setScheduleForm({ ...scheduleForm, cronExpression: e.target.value })}
                    placeholder="0 0 * * 0 (Every Sunday)"
                  />
                </div>
                <div>
                  <label className="form-label">Format</label>
                  <select
                    className="form-select"
                    value={scheduleForm.format}
                    onChange={e => setScheduleForm({ ...scheduleForm, format: e.target.value as any })}
                  >
                    <option value="PDF">PDF</option>
                    <option value="Excel">Excel</option>
                    <option value="HTML">HTML</option>
                    <option value="JSON">JSON</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Recipients (comma-separated)</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={scheduleForm.recipients}
                    onChange={e => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                    placeholder="team@example.com, boss@example.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={isCreatingSchedule}>
                  {isCreatingSchedule ? <Loader2 className="animate-spin mr-2" size={18} /> : <Plus size={18} className="mr-2" />}
                  Create Schedule
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--c-border)]">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--c-text-primary)' }}>Active Schedules</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Cron</th>
                    <th>Format</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="font-medium" style={{ color: 'var(--c-text-primary)' }}>{schedule.title}</td>
                      <td className="font-mono text-sm">{schedule.cronExpression}</td>
                      <td>
                        <span className={`badge ${getFormatBadgeClass(schedule.format)}`}>
                          {schedule.format}
                        </span>
                      </td>
                      <td className="truncate max-w-[200px]" title={schedule.recipients}>
                        {schedule.recipients}
                      </td>
                      <td>
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              className="sr-only" 
                              checked={schedule.active}
                              onChange={() => toggleScheduleActive(schedule)}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${schedule.active ? 'bg-[var(--c-success)]' : 'bg-gray-400'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${schedule.active ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                          <span className="ml-3 text-sm" style={{ color: 'var(--c-text-secondary)' }}>
                            {schedule.active ? 'Active' : 'Paused'}
                          </span>
                        </label>
                      </td>
                      <td>
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => deleteSchedule(schedule.id)}
                            className="btn btn-ghost text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8" style={{ color: 'var(--c-text-secondary)' }}>
                        No schedules found. Create one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
