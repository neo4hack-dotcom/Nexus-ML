import React, { useState } from 'react';
import { AppState, MLModel } from '../types';
import { Archive, Clock, Database, CheckCircle2, Download, PackageOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export function VersionsView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const { datasetVersions, modelVersions, selectedModelId } = state;
  const [exportingModelId, setExportingModelId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const activeModel = modelVersions.find((model) => model.id === selectedModelId) || modelVersions[modelVersions.length - 1];

  const handleExport = async (model: MLModel) => {
    setExportError(null);
    setExportingModelId(model.id);
    const modelName = model.name.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
    try {
      await api.exportModelPickle(model.id, `${modelName}_${model.id}.pkl`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Model export failed');
    } finally {
      setExportingModelId(null);
    }
  };

  const handleBundleExport = async (model: MLModel) => {
    setExportError(null);
    setExportingModelId(model.id);
    const modelName = model.name.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
    try {
      await api.exportModelBundle(model.id, `${modelName}_${model.id}.zip`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Bundle export failed');
    } finally {
      setExportingModelId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 text-white">
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter italic serif">
          Model <span className="font-bold not-italic">Registry.</span>
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mt-4 max-w-md">
          Track lineage, compare historically trained models, and switch active inferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Datasets Column */}
        <div className="col-span-1 border border-white/10 glass-panel flex flex-col overflow-hidden">
          <div className="bg-[#080808] p-4 border-b border-white/10">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50 flex items-center gap-2">
              <Database className="w-3 h-3" /> Dataset Versions
            </h3>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
             {datasetVersions.length === 0 && (
               <p className="text-[10px] text-white/30 uppercase tracking-widest">No datasets registered yet.</p>
             )}
             {datasetVersions.map((ds, i) => (
                <div key={ds.id} className="p-4 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold truncate pr-4">{ds.filename}</span>
                    <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">{ds.version}</span>
                  </div>
                  <div className="text-[9px] font-mono text-white/40 mb-3">ID: <span className="truncate inline-block max-w-[120px] align-bottom">{ds.id}</span></div>
                  <div className="flex gap-4 text-[9px] uppercase tracking-widest text-white/60">
                    <span>{ds.rowCount} Rows</span>
                    <span>{ds.colCount} Cols</span>
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Models Column */}
        <div className="col-span-2 border border-white/10 glass-panel flex flex-col overflow-hidden">
          <div className="bg-[#080808] p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50 flex items-center gap-2">
              <Archive className="w-3 h-3" /> Trained Models History
            </h3>
          </div>
          {exportError && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] uppercase tracking-widest text-red-200">
              {exportError}
            </div>
          )}
          
          <div className="p-0 overflow-x-auto flex-1">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-white/10 text-[9px] uppercase tracking-widest text-white/30 bg-[#050505]">
                    <th className="py-4 px-6 font-normal whitespace-nowrap">Model ID & Arch</th>
                    <th className="py-4 px-6 font-normal whitespace-nowrap">Dataset Link</th>
                    <th className="py-4 px-6 font-normal whitespace-nowrap">Metric (Acc/R2)</th>
                    <th className="py-4 px-6 font-normal whitespace-nowrap">Date Trained</th>
                    <th className="py-4 px-6 font-normal text-right whitespace-nowrap">Action</th>
                 </tr>
               </thead>
               <tbody className="text-[11px] font-mono">
                 {modelVersions.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-12 text-center text-[10px] text-white/30 uppercase tracking-widest font-sans">
                        No models trained yet.
                     </td>
                   </tr>
                 )}
                 {[...modelVersions].reverse().map(model => {
                   const isActive = selectedModelId === model.id;
                   const score = model.metrics?.accuracy || model.metrics?.r2 || 0;
                   const ds = datasetVersions.find(d => d.id === model.datasetId);

                   return (
                     <tr key={model.id} className={cn("border-b border-white/5 transition-colors hover:bg-white/5", isActive && "bg-[#0A0A0A]")}>
                        <td className="py-4 px-6 whitespace-nowrap">
                           <div className="font-bold text-white mb-1 font-sans text-[10px] uppercase tracking-wider">{model.name}</div>
                           <div className="text-[9px] text-white/50">{model.id}</div>
                        </td>
                        <td className="py-4 px-6 text-white/60 whitespace-nowrap">
                           {ds ? <span title={ds.filename}>{ds.version}</span> : <span className="opacity-50">Unknown</span>}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                           <span className={cn("font-bold text-lg", score > 0.9 ? "text-emerald-400" : "text-amber-400")}>
                             {(score * (model.type === 'classification' ? 100 : 1)).toFixed(2)}{model.type === 'classification' ? '%' : ''}
                           </span>
                        </td>
                        <td className="py-4 px-6 text-white/40 whitespace-nowrap">
                           <div className="flex items-center gap-2">
                             <Clock className="w-3 h-3" /> 
                             {new Date(model.createdAt).toLocaleDateString()}
                           </div>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                           <div className="flex items-center justify-end gap-2">
                             {isActive ? (
                               <span className="inline-flex items-center justify-end gap-1 px-3 py-1 bg-emerald-500/10 text-[9px] font-sans font-bold uppercase tracking-widest text-emerald-500 rounded">
                                 <CheckCircle2 className="w-3 h-3" /> Active
                               </span>
                             ) : (
                               <button 
                                 onClick={() => dispatch({ type: 'SELECT_MODEL', modelId: model.id })}
                                 className="px-3 py-1.5 border border-white/10 hover:border-white hover:bg-white hover:text-black transition-all rounded-sm text-[9px] font-sans font-bold uppercase tracking-widest text-white/70"
                               >
                                 Set Active
                               </button>
                             )}
                             <button
                               onClick={() => handleExport(model)}
                               disabled={model.status !== 'success' || exportingModelId === model.id}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all rounded-sm text-[9px] font-sans font-bold uppercase tracking-widest disabled:opacity-50"
                             >
                               <Download className="w-3 h-3" />
                               {exportingModelId === model.id ? 'Exporting' : 'Export .pkl'}
                             </button>
                             <button
                               onClick={() => handleBundleExport(model)}
                               disabled={model.status !== 'success' || exportingModelId === model.id}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-white/5 text-white/70 hover:bg-white hover:text-black transition-all rounded-sm text-[9px] font-sans font-bold uppercase tracking-widest disabled:opacity-50"
                             >
                               <PackageOpen className="w-3 h-3" />
                               Bundle
                             </button>
                           </div>
                        </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      {activeModel && (
        <div className="glass-panel border border-white/10 p-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <h2 className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-2">Active Model Detail</h2>
              <div className="text-2xl font-light">{activeModel.name}</div>
              <div className="text-[10px] text-white/40 font-mono mt-1">{activeModel.id}</div>
            </div>
            <div className="text-right text-[10px] uppercase tracking-widest text-white/50">
              <div>Target: <span className="text-white">{activeModel.targetColumn || state.targetColumn}</span></div>
              <div>Features: <span className="text-white">{activeModel.featureColumns?.length || 0}</span></div>
              <div>Excluded: <span className="text-white">{activeModel.excludedColumns?.length || 0}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Feature Importance</h3>
              <div className="space-y-2">
                {(activeModel.featureImportance || []).slice(0, 10).map((item) => (
                  <div key={item.feature} className="grid grid-cols-[150px_1fr_50px] gap-3 items-center text-[10px] uppercase tracking-widest">
                    <span className="truncate text-white/60">{item.feature}</span>
                    <div className="h-2 bg-white/10">
                      <div className="h-full bg-emerald-400" style={{ width: `${Math.max(2, item.importance * 100)}%` }} />
                    </div>
                    <span className="font-mono text-right">{(item.importance * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Validation & Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(activeModel.metrics || {}).filter(([key]) => !['perClass'].includes(key)).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="bg-white/5 border border-white/10 p-3">
                    <div className="text-[9px] uppercase tracking-widest text-white/40">{key}</div>
                    <div className="font-mono text-lg mt-1">{typeof value === 'number' ? value.toFixed(3) : String(value ?? 'n/a')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
