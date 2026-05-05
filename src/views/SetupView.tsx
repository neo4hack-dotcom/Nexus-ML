import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, Database, Settings2, FileSpreadsheet, CheckCircle2, ChevronRight } from 'lucide-react';
import { AppState } from '../types';
import { analyzeDataset } from '../store';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function SetupView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const [dragActive, setDragActive] = useState(false);
  const [oracleConfig, setOracleConfig] = useState({ host: '', port: '1521', user: '', password: '', sid: '' });
  const [showOracle, setShowOracle] = useState(false);

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

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dataset = analyzeDataset(results.data, file.name);
        dispatch({ type: 'SET_DATASET', dataset });
      }
    });
  };

  const handleConnectDb = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate DB connection and fetch
    setTimeout(() => {
      // Create mock dataset from DB
      const mockData = Array.from({ length: 500 }).map((_, i) => ({
        id: i,
        score: Math.random() * 100,
        category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
        isActive: Math.random() > 0.5 ? 'YES' : 'NO',
        revenue: Math.random() * 5000,
      }));
      dispatch({ 
        type: 'SET_DATASET', 
        dataset: analyzeDataset(mockData, `OracleDB: ${oracleConfig.sid || 'ORCL'}`) 
      });
      setShowOracle(false);
    }, 1500);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          Workspace <br/> <span className="font-bold not-italic">Setup.</span>
        </h1>
        <p className="text-xs text-white/40 mb-10 uppercase tracking-widest leading-relaxed">
          Configure your local LLM engine and ingest data to begin the automated pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LLM Config Panel */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <Settings2 className="w-4 h-4 text-white" />
            <h2 className="text-[10px] uppercase tracking-widest font-bold">LLM Engine</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" 
                    checked={state.llmConfig.isSimulated}
                    onChange={(e) => dispatch({ 
                      type: 'UPDATE_LLM_CONFIG', 
                      config: { isSimulated: e.target.checked } 
                    })} 
                  />
                  <div className={cn("block w-10 h-6 rounded-full transition-colors", state.llmConfig.isSimulated ? "bg-amber-500/20" : "bg-emerald-500/20")}></div>
                  <div className={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition", state.llmConfig.isSimulated ? "transform translate-x-4 bg-amber-500" : "bg-emerald-500")}></div>
                </div>
                <div className="ml-3 text-sm font-medium">
                  {state.llmConfig.isSimulated ? 'Simulated Mode' : 'Connect Local LLM'}
                </div>
              </label>
            </div>

            {!state.llmConfig.isSimulated && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">API Base URL (OpenAI Compatible)</label>
                  <input 
                    type="text" 
                    value={state.llmConfig.baseUrl}
                    onChange={(e) => dispatch({ type: 'UPDATE_LLM_CONFIG', config: { baseUrl: e.target.value } })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Model Name</label>
                  <input 
                    type="text" 
                    value={state.llmConfig.modelName}
                    onChange={(e) => dispatch({ type: 'UPDATE_LLM_CONFIG', config: { modelName: e.target.value } })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </motion.div>
            )}
            {state.llmConfig.isSimulated && (
              <div className="text-sm text-muted-foreground bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                Running in simulation mode. No real API calls will be made, perfect for demonstration.
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
                onClick={() => setShowOracle(false)}
                className={cn("px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all", !showOracle && "bg-white text-black")}
              >
                File Upload
              </button>
              <button 
                onClick={() => setShowOracle(true)}
                className={cn("px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all", showOracle && "bg-white text-black")}
              >
                Oracle DB
              </button>
            </div>
          </div>

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
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'chat' })}
                className="mt-8 px-6 py-3 bg-white hover:bg-[#D4D4D4] text-black uppercase tracking-[0.2em] text-xs font-bold transition-colors flex items-center gap-2"
              >
                Start AutoML Process
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : showOracle ? (
            <form onSubmit={handleConnectDb} className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Host</label>
                  <input required placeholder="oracle.network.local" type="text" value={oracleConfig.host} onChange={e=>setOracleConfig({...oracleConfig, host: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Port</label>
                  <input required placeholder="1521" type="text" value={oracleConfig.port} onChange={e=>setOracleConfig({...oracleConfig, port: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Service Name (SID)</label>
                <input required placeholder="ORCL" type="text" value={oracleConfig.sid} onChange={e=>setOracleConfig({...oracleConfig, sid: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Username</label>
                  <input required type="text" value={oracleConfig.user} onChange={e=>setOracleConfig({...oracleConfig, user: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                  <input required type="password" value={oracleConfig.password} onChange={e=>setOracleConfig({...oracleConfig, password: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full py-4 bg-white hover:bg-[#D4D4D4] text-black font-bold uppercase tracking-[0.2em] text-[10px] transition-colors rounded-sm">
                  Connect & Fetch Data
                </button>
              </div>
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
                <FileSpreadsheet className={cn("w-12 h-12 mb-4", dragActive ? "text-primary" : "text-muted-foreground")} />
                <h3 className="text-lg font-medium mb-1">Upload CSV or Excel file</h3>
                <p className="text-sm text-muted-foreground mb-6">Drag and drop your dataset here, or click to browse</p>
                <div className="px-5 py-2 rounded-full bg-white/10 text-sm font-medium hover:bg-white/20 transition-colors">
                  Select File
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Dataset Preview */}
      {state.dataset && (
        <div className="glass-panel p-6">
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
