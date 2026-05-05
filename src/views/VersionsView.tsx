import React from 'react';
import { AppState, MLModel } from '../types';
import { Archive, Clock, Database, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function VersionsView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const { datasetVersions, modelVersions, selectedModelId } = state;

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
                        </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
}
