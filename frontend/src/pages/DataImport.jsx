import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  UploadCloud, FileText, CheckCircle2, AlertTriangle, XCircle,
  Download, RefreshCw, History, ArrowRight, Check, AlertCircle,
  Clock, Database, Eye, X, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

const DATA_TYPES = [
  { id: 'feedback', name: 'Feedback', desc: 'Student ratings & feedback with auto NLP analysis', color: 'indigo' },
  { id: 'transport', name: 'Transport', desc: 'Routes & GPS bus stops with map coordinates', color: 'amber' },
  { id: 'facility_usage', name: 'Facility Usage', desc: 'Campus facilities, labs & capacity metrics', color: 'emerald' },
  { id: 'attendance', name: 'Attendance', desc: 'Student attendance logs & verification', color: 'sky' },
  { id: 'exam_schedule', name: 'Exam Schedule', desc: 'Department exam dates, timings & halls', color: 'purple' },
];

export function DataImport() {
  const [activeTab, setActiveTab] = useState('import'); // 'import' | 'history'
  const [selectedType, setSelectedType] = useState('feedback');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Workflow states
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // History states
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Fetch past imports
  const fetchHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/data-imports?page=${page}&page_size=15`);
      setHistoryItems(res.data.items || []);
      setHistoryPage(res.data.page || 1);
      setHistoryTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error('Failed to load import history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(1);
    }
  }, [activeTab]);

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selected) => {
    setErrorMessage('');
    const ext = selected.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setErrorMessage('Please select a valid .csv or .xlsx file.');
      return;
    }
    setFile(selected);
  };

  // Step 1 & 2: Upload & Validate
  const handleUploadAndValidate = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMessage('');
    setPreviewData(null);
    setReportData(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', selectedType);

    try {
      const res = await api.post('/data-imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data);
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to upload and validate file.');
    } finally {
      setUploading(false);
    }
  };

  // Step 3 & 4: Confirm Import
  const handleConfirmImport = async () => {
    if (!previewData?.import_id) return;
    setConfirming(true);
    setErrorMessage('');

    try {
      const res = await api.post(`/data-imports/${previewData.import_id}/confirm`);
      setReportData(res.data);
      setPreviewData(null);
      setFile(null);
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to confirm import.');
    } finally {
      setConfirming(false);
    }
  };

  // Template download
  const handleDownloadTemplate = async (type) => {
    try {
      const res = await api.get(`/data-imports/templates/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_${type}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download template', err);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewData(null);
    setReportData(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Bulk Data Import System</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Data Import Module</h1>
              <p className="text-slate-400 text-sm mt-1">
                Upload CSV or Excel spreadsheets to populate campus records with automatic validation.
              </p>
            </div>

            {/* Tab switch */}
            <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 self-start sm:self-auto">
              <button
                onClick={() => { setActiveTab('import'); resetForm(); }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'import'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>New Import</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Import History</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start space-x-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: NEW IMPORT WORKFLOW */}
        {activeTab === 'import' && (
          <div className="space-y-8">
            {/* Step 1: Type Selection & File Upload (if no preview and no report) */}
            {!previewData && !reportData && (
              <div className="space-y-6">
                {/* 1. Select Import Type */}
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                    1. Select Data Type
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {DATA_TYPES.map((dt) => {
                      const isSelected = selectedType === dt.id;
                      return (
                        <div
                          key={dt.id}
                          onClick={() => setSelectedType(dt.id)}
                          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                            isSelected
                              ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                              {dt.name}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2">{dt.desc}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadTemplate(dt.id);
                            }}
                            className="mt-3 inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                          >
                            <Download className="w-3 h-3" />
                            <span>Sample CSV</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Upload Area */}
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                    2. Upload Spreadsheet (.csv or .xlsx)
                  </h2>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-500/5'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      {file ? (
                        <div className="space-y-1">
                          <div className="font-bold text-white text-base flex items-center justify-center space-x-2">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            <span>{file.name}</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {(file.size / 1024).toFixed(1)} KB · Ready to validate
                          </p>
                          <button
                            onClick={() => setFile(null)}
                            className="text-xs text-rose-400 hover:underline pt-2 block mx-auto"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label
                            htmlFor="file-upload"
                            className="cursor-pointer inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
                          >
                            <span>Browse Files</span>
                          </label>
                          <p className="text-xs text-slate-400">or drag and drop spreadsheet here</p>
                          <p className="text-[11px] text-slate-500">Supports .CSV, .XLSX, and .XLS files</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action button */}
                {file && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleUploadAndValidate}
                      disabled={uploading}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-xl shadow-indigo-600/20 transition-all"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>{uploading ? 'Validating Rows...' : 'Upload & Validate'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Preview & Validation Results */}
            {previewData && (
              <div className="space-y-6">
                {/* Preview Banner */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="text-xs text-slate-400">Data Import Validation Preview</div>
                      <h2 className="text-xl font-bold text-white mt-0.5 flex items-center space-x-2">
                        <span>{previewData.file_name}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase">
                          {previewData.data_type}
                        </span>
                      </h2>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={resetForm}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmImport}
                        disabled={confirming || previewData.valid_records_count === 0}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>
                          {confirming
                            ? 'Importing...'
                            : `Confirm & Import ${previewData.valid_records_count} Valid Rows`}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-xs text-slate-500 font-semibold uppercase">Total Rows Parsed</div>
                      <div className="text-2xl font-extrabold text-white mt-1">{previewData.total_records}</div>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                      <div className="text-xs text-emerald-400 font-semibold uppercase flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valid Records Ready</span>
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                        {previewData.valid_records_count}
                      </div>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
                      <div className="text-xs text-rose-400 font-semibold uppercase flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Rejected (Skipped)</span>
                      </div>
                      <div className="text-2xl font-extrabold text-rose-400 mt-1">
                        {previewData.invalid_records_count}
                      </div>
                    </div>
                  </div>

                  {previewData.invalid_records_count > 0 && (
                    <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        Note per Section 10: Fault-tolerant import is active. Valid rows will be committed to the database; invalid rows will be skipped and listed in the final report.
                      </span>
                    </div>
                  )}
                </div>

                {/* Validation Errors Inspector */}
                {previewData.errors && previewData.errors.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                    <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                      <XCircle className="w-4 h-4" />
                      <span>Validation Errors Detected ({previewData.errors.length} rows)</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {previewData.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border border-rose-500/20 rounded-xl p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="font-bold text-rose-400">Row #{err.row}</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {JSON.stringify(err.data)}
                            </span>
                          </div>
                          <ul className="text-slate-300 list-disc list-inside space-y-0.5">
                            {err.reasons.map((r, rIdx) => (
                              <li key={rIdx} className="text-rose-300">{r}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Rows Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-white">Parsed Sample Rows Preview</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visual preview of up to 25 rows evaluated by the validation engine
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Row #</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Sample Data Values</th>
                          <th className="py-3 px-4">Validation Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {previewData.sample_rows.map((row, idx) => {
                          const isValid = row.status === 'valid';
                          return (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 font-mono text-slate-400">#{row.row_number}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-semibold text-[10px] border ${
                                    isValid
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  {isValid ? 'Valid' : 'Rejected'}
                                </span>
                              </td>
                              <td className="py-3 px-4 max-w-md">
                                <div className="truncate font-mono text-[11px] text-slate-300">
                                  {Object.entries(row.data)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' · ')}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-400">
                                {isValid ? (
                                  <span className="text-emerald-400">Foreign keys verified</span>
                                ) : (
                                  <span className="text-rose-400 font-medium">
                                    {row.errors.join('; ')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Final Import Report */}
            {reportData && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold text-white">Import Execution Completed</h2>
                  <p className="text-xs text-slate-400">{reportData.message}</p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-left">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Records</div>
                    <div className="text-xl font-bold text-white mt-1">{reportData.total_records}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="text-[11px] text-emerald-400 uppercase font-semibold">Successful</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{reportData.successful_records}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="text-[11px] text-rose-400 uppercase font-semibold">Rejected</div>
                    <div className="text-xl font-bold text-rose-400 mt-1">{reportData.failed_records}</div>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-3 pt-4">
                  <button
                    onClick={resetForm}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Import Another File
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    View All History
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IMPORT HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Import History & Audit Trails</h2>
                <p className="text-xs text-slate-400 mt-0.5">Historical log of all data import jobs per Table 18</p>
              </div>
              <button
                onClick={() => fetchHistory(historyPage)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                title="Refresh history"
              >
                <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span className="text-xs">Loading import history...</span>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No past data imports found. Start your first import above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Data Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Total</th>
                      <th className="py-3 px-4 text-center">Imported</th>
                      <th className="py-3 px-4 text-center">Failed</th>
                      <th className="py-3 px-4">Uploaded By</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {historyItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{item.file_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {item.data_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">{item.total_records ?? '—'}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400">
                          {item.successful_records ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-rose-400">
                          {item.failed_records ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {item.uploader_name || item.uploader_email || 'Admin'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedHistoryItem(item)}
                            className="p-1.5 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors"
                            title="Inspect report"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {historyTotalPages > 1 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Page {historyPage} of {historyTotalPages}</span>
                <div className="space-x-2">
                  <button
                    disabled={historyPage <= 1}
                    onClick={() => fetchHistory(historyPage - 1)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300"
                  >
                    Previous
                  </button>
                  <button
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => fetchHistory(historyPage + 1)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: History Report Inspector */}
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <span className="font-bold text-white text-base">Import Report Inspector</span>
                </div>
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500">File Name</div>
                  <div className="font-bold text-slate-200 truncate">{selectedHistoryItem.file_name}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500">Data Type</div>
                  <div className="font-bold text-slate-200">{selectedHistoryItem.data_type}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500">Successful</div>
                  <div className="font-bold text-emerald-400">{selectedHistoryItem.successful_records ?? 0}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500">Failed</div>
                  <div className="font-bold text-rose-400">{selectedHistoryItem.failed_records ?? 0}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1">Row-Level Error Report (JSONB)</div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedHistoryItem.error_report || { message: 'No error log recorded.' }, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
