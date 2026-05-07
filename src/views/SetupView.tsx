import React, { useEffect, useState } from 'react';
import { Database, FileSpreadsheet, CheckCircle2, ChevronRight, ServerCog, Loader2, FlaskConical, ShieldCheck, SlidersHorizontal, Play, AlertCircle } from 'lucide-react';
import { AppState } from '../types';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

type IngestMode = 'file' | 'demo' | 'oracle';

export function SetupView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const [dragActive, setDragActive] = useState(false);
  const [ingestMode, setIngestMode] = useState<IngestMode>('file');
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oracleSql, setOracleSql] = useState('SELECT * FROM my_table WHERE ROWNUM <= 10000');

  useEffect(() => {
    api.health()
      .then((health) => {
        dispatch({
          type: 'UPDATE_BACKEND_CONFIG',
          config: { status: 'online', engine: health.engine, baseUrl: api.baseUrl },
        });
        return api.registry();
      })
      .then((registry) => {
        if (registry) {
          dispatch({ type: 'SET_REGISTRY', datasets: registry.datasets, models: registry.models });
        }
      })
      .catch(() => {
        dispatch({
          type: 'UPDATE_BACKEND_CONFIG',
          config: { status: 'offline', baseUrl: api.baseUrl },
        });
      });
  }, [dispatch]);

  useEffect(() => {
    if (state.dataset && !state.targetColumn) {
      const fallback = state.dataset.columns[state.dataset.columns.length - 1];
      if (fallback) {
        dispatch({
          type: 'SET_TARGET',
          target: fallback.name,
          problemType: fallback.type === 'numeric' ? 'regression' : 'classification',
        });
      }
    }
  }, [state.dataset, state.targetColumn, dispatch]);

  const handleTargetChange = (targetName: string) => {
    const target = state.dataset?.columns.find((column) => column.name === targetName);
    dispatch({
      type: 'SET_TARGET',
      target: targetName,
      problemType: target?.type === 'numeric' ? 'regression' : 'classification',
    });
  };

  const toggleExcludedColumn = (columnName: string) => {
    const next = state.excludedColumns.includes(columnName)
      ? state.excludedColumns.filter((column) => column !== columnName)
      : [...state.excludedColumns, columnName];
    dispatch({ type: 'SET_EXCLUDED_COLUMNS', columns: next });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsLoadingDataset(true);
    try {
      const dataset = await api.uploadDataset(file);
      dispatch({ type: 'SET_DATASET', dataset });
      dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'online' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dataset upload failed');
      dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'offline' } });
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleCreateDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoadingDataset(true);
    try {
      const dataset = await api.createDemoDataset();
      dispatch({ type: 'SET_DATASET', dataset });
      setIngestMode('file');
      dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'online' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create demo dataset');
      dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'offline' } });
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleOracleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoadingDataset(true);
    try {
      const dataset = await api.oracleQuery(oracleSql);
      dispatch({ type: 'SET_DATASET', dataset });
      dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'online' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oracle query failed');
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const oracleConfigured = Boolean(state.oracleConfig.dsnValue && state.oracleConfig.username);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          Workspace <br/> <span className="font-bold not-italic">Setup.</span>
        </h1>
        <p className="text-xs text-white/40 mb-10 uppercase tracking-widest leading-relaxed">
          Connect the Python ML backend and ingest data to begin the automated pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Python Engine Panel */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <ServerCog className="w-4 h-4 text-white" />
            <h2 className="text-[10px] uppercase tracking-widest font-bold">Python ML Engine</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "h-3 w-3 rounded-full",
                state.backendConfig.status === 'online' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" :
                state.backendConfig.status === 'checking' ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" :
                "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
              )} />
              <div>
                <div className="text-sm font-bold uppercase tracking-widest">
                  {state.backendConfig.status === 'online' ? 'Backend Online' : state.backendConfig.status === 'checking' ? 'Checking Backend' : 'Backend Offline'}
                </div>
                <div className="text-[10px] text-white/40 font-mono">{state.backendConfig.baseUrl}</div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-emerald-500/10 p-3 rounded-sm border border-emerald-500/20 leading-relaxed">
              {state.backendConfig.engine}. Datasets are profiled in pandas, models are trained in scikit-learn, and inference uses serialized Python pipelines.
            </div>

            {state.backendConfig.status === 'offline' && (
              <div className="text-sm text-red-200 bg-red-500/10 p-3 rounded-sm border border-red-500/20">
                Start the backend with <span className="font-mono">python3 -m backend</span>, then refresh this screen.
              </div>
            )}
          </div>
        </div>

        {/* Data Ingestion Panel */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-white" />
              <h2 className="text-[10px] uppercase tracking-widest font-bold">Data Ingestion</h2>
            </div>
            <div className="flex bg-black p-1 rounded-sm border border-white/10">
              <button
                onClick={() => setIngestMode('file')}
                className={cn("px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all", ingestMode === 'file' && "bg-white text-black")}
              >
                File Upload
              </button>
              <button
                onClick={() => setIngestMode('oracle')}
                className={cn("px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5", ingestMode === 'oracle' && "bg-white text-black")}
              >
                <Database className="w-3 h-3" />
                Oracle
              </button>
              <button
                onClick={() => setIngestMode('demo')}
                className={cn("px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all", ingestMode === 'demo' && "bg-white text-black")}
              >
                Demo
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {state.dataset ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-medium mb-2">{state.dataset.filename}</h3>
              <p className="text-muted-foreground text-sm flex gap-4">
                <span>Rows: {state.dataset.rowCount.toLocaleString()}</span>
                <span>Columns: {state.dataset.colCount}</span>
              </p>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: state.targetColumn ? 'pipeline' : 'chat' })}
                className="mt-8 px-6 py-3 bg-white hover:bg-[#D4D4D4] text-black uppercase tracking-[0.2em] text-xs font-bold transition-colors flex items-center gap-2"
              >
                {state.targetColumn ? 'Run Guided Pipeline' : 'Start AutoML Process'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : ingestMode === 'demo' ? (
            <form onSubmit={handleCreateDemo} className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-10">
              <FlaskConical className="w-12 h-12 text-emerald-400" />
              <div>
                <h3 className="text-xl font-medium mb-2">Generate a Python Demo Dataset</h3>
                <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                  The backend will generate a classification dataset with scikit-learn, profile it with pandas, and return it to the app.
                </p>
              </div>
              <button type="submit" disabled={isLoadingDataset} className="px-6 py-4 bg-white hover:bg-[#D4D4D4] text-black font-bold uppercase tracking-[0.2em] text-[10px] transition-colors rounded-sm flex items-center gap-3 disabled:opacity-50">
                {isLoadingDataset && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Demo Dataset
              </button>
            </form>
          ) : ingestMode === 'oracle' ? (
            <form onSubmit={handleOracleQuery} className="flex-1 flex flex-col gap-5 py-2">
              {!oracleConfigured && (
                <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    La connexion Oracle n'est pas configurée.{' '}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_VIEW', view: 'config' })}
                      className="underline hover:no-underline font-bold"
                    >
                      Configurer maintenant →
                    </button>
                  </span>
                </div>
              )}

              {oracleConfigured && (
                <div className="flex items-center gap-3 border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-[10px] uppercase tracking-widest text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Connecté à {state.oracleConfig.username}@{state.oracleConfig.host}:{state.oracleConfig.port}
                    {' '}({state.oracleConfig.dsnType === 'service_name' ? 'service' : 'SID'}: {state.oracleConfig.dsnValue})
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 flex-1">
                <label className="text-[9px] uppercase tracking-widest text-white/40">Requête SQL (SELECT uniquement)</label>
                <textarea
                  value={oracleSql}
                  onChange={(e) => setOracleSql(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full flex-1 bg-[#020202] border border-white/10 p-4 text-sm font-mono focus:outline-none focus:border-white/40 resize-none leading-relaxed"
                  placeholder="SELECT col1, col2, target FROM schema.table WHERE condition = 'value'"
                />
                <p className="text-[9px] text-white/25 uppercase tracking-widest">
                  Les données seront récupérées localement et traitées exactement comme un fichier importé.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoadingDataset || !oracleSql.trim() || !oracleConfigured}
                className="self-start px-6 py-3 bg-white text-black hover:bg-[#D4D4D4] font-bold uppercase tracking-[0.2em] text-[10px] transition-colors flex items-center gap-3 disabled:opacity-50"
              >
                {isLoadingDataset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isLoadingDataset ? 'Exécution…' : 'Exécuter la requête'}
              </button>
            </form>
          ) : (
            <div
              className={cn(
                "flex-1 border border-dashed flex flex-col items-center justify-center p-8 text-center transition-all cursor-pointer rounded-sm",
                dragActive ? "border-white bg-white/5" : "border-white/20 hover:border-white/40 hover:bg-white/5"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input type="file" id="file-upload" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleChange} />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center flex-1 w-full justify-center">
                {isLoadingDataset ? <Loader2 className="w-12 h-12 mb-4 animate-spin text-white" /> : <FileSpreadsheet className={cn("w-12 h-12 mb-4", dragActive ? "text-primary" : "text-muted-foreground")} />}
                <h3 className="text-lg font-medium mb-1">Upload CSV or Excel file</h3>
                <p className="text-sm text-muted-foreground mb-6">The file is parsed and profiled by the FastAPI backend</p>
                <div className="px-5 py-2 rounded-full bg-white/10 text-sm font-medium hover:bg-white/20 transition-colors">
                  {isLoadingDataset ? 'Uploading...' : 'Select File'}
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Dataset Preview */}
      {state.dataset && (
        <div className="glass-panel p-6 space-y-8">
          {state.dataset.qualityReport && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-[10px] uppercase tracking-widest font-bold">Data Quality</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Missing Cells</div>
                  <div className="text-2xl font-mono mt-2">{state.dataset.qualityReport.missingCells}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Missing Rate</div>
                  <div className="text-2xl font-mono mt-2">{(state.dataset.qualityReport.missingRate * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Duplicates</div>
                  <div className="text-2xl font-mono mt-2">{state.dataset.qualityReport.duplicateRows}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Warnings</div>
                  <div className="text-2xl font-mono mt-2">{state.dataset.qualityReport.warnings.length}</div>
                </div>
              </div>
              {state.dataset.qualityReport.warnings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {state.dataset.qualityReport.warnings.slice(0, 6).map((warning, index) => (
                    <div key={index} className={cn(
                      "border px-3 py-2 text-[11px]",
                      warning.severity === 'high' ? "border-red-500/30 bg-red-500/10 text-red-100" :
                      warning.severity === 'medium' ? "border-amber-500/30 bg-amber-500/10 text-amber-100" :
                      "border-white/10 bg-white/5 text-white/60"
                    )}>
                      {warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-white" />
              <h2 className="text-[10px] uppercase tracking-widest font-bold">Modeling Objective</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Target Column</label>
                <select
                  value={state.targetColumn || ''}
                  onChange={(event) => handleTargetChange(event.target.value)}
                  className="w-full bg-[#020202] border border-white/10 text-white text-xs uppercase tracking-widest p-3 outline-none font-bold"
                >
                  {state.dataset.columns.map((column) => (
                    <option key={column.name} value={column.name}>{column.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Problem Type</label>
                <select
                  value={state.problemType || 'classification'}
                  onChange={(event) => dispatch({ type: 'SET_TARGET', target: state.targetColumn || state.dataset!.columns[0].name, problemType: event.target.value as 'classification' | 'regression' })}
                  className="w-full bg-[#020202] border border-white/10 text-white text-xs uppercase tracking-widest p-3 outline-none font-bold"
                >
                  <option value="classification">Classification</option>
                  <option value="regression">Regression</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', view: 'pipeline' })}
                  disabled={!state.targetColumn}
                  className="w-full py-3 bg-white hover:bg-[#D4D4D4] text-black uppercase tracking-[0.2em] text-[10px] font-bold transition-colors disabled:opacity-50"
                >
                  Train with Python
                </button>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[9px] uppercase tracking-widest text-white/40 mb-2">Exclude Features</div>
              <div className="flex flex-wrap gap-2">
                {state.dataset.columns.filter((column) => column.name !== state.targetColumn).map((column) => (
                  <button
                    key={column.name}
                    onClick={() => toggleExcludedColumn(column.name)}
                    className={cn(
                      "px-3 py-1.5 border text-[9px] uppercase tracking-widest transition-colors",
                      state.excludedColumns.includes(column.name)
                        ? "border-red-400 bg-red-500/10 text-red-200"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                    )}
                  >
                    {column.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] uppercase tracking-widest font-bold">Data Profiling</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-white/5 uppercase">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Column</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Missing</th>
                  <th className="px-4 py-3">Unique</th>
                  <th className="px-4 py-3 rounded-tr-lg">Sample Values</th>
                </tr>
              </thead>
              <tbody>
                {state.dataset.columns.map((col, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{col.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-mono",
                        col.type === 'numeric' ? "bg-blue-500/20 text-blue-300" :
                        col.type === 'categorical' ? "bg-purple-500/20 text-purple-300" :
                        "bg-zinc-500/20 text-zinc-300"
                      )}>
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{col.missingCount} <span className="text-muted-foreground text-xs">({((col.missingCount/state.dataset!.rowCount)*100).toFixed(1)}%)</span></td>
                    <td className="px-4 py-3">{col.uniqueCount}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{col.sampleValues.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
