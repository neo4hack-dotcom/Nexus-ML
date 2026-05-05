import React from 'react';
import { AppState } from '../types';
import { Trophy, Activity, Target, Clock, ArrowRight, Zap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function DashboardView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  if (!state.models || state.models.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-center">
        <Activity className="w-12 h-12 text-muted-foreground mb-4 animate-pulse" />
        <h2 className="text-xl font-medium">No Models Trained Yet</h2>
        <p className="text-muted-foreground">Go back to the pipeline to run the training process.</p>
      </div>
    );
  }

  const isClass = state.problemType === 'classification';
  const primaryMetric = isClass ? 'accuracy' : 'r2';
  
  const chartData = state.models.map(m => ({
    name: m.name.replace('Classifier', '').replace('Regressor', '').trim(),
    score: (m.metrics?.[primaryMetric] || 0) * (isClass ? 100 : 1), // R2 often not %, but we'll scale it nicely or keep it raw
    time: m.metrics?.trainingTime
  }));

  const selectedModel = state.models.find(m => m.id === state.selectedModelId) || state.models[0];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter italic serif">
            Model <br/><span className="font-bold not-italic">Leaderboard.</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mt-4">Compare performance across automatically tuned models.</p>
        </div>
        <button 
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'predict' })}
          className="px-6 py-4 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#D4D4D4] transition-colors rounded-sm flex items-center gap-2"
        >
          Use Model for Prediction
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {state.models.map((model, idx) => {
          const score = model.metrics?.[primaryMetric] || 0;
          const isWinner = idx === 0;
          return (
            <div 
              key={model.id}
              onClick={() => dispatch({ type: 'SELECT_MODEL', modelId: model.id })}
              className={cn(
                "glass-panel p-6 cursor-pointer transition-all border relative overflow-hidden group hover:bg-white/5",
                state.selectedModelId === model.id ? "border-white bg-[#0A0A0A]" : ""
              )}
            >
              {isWinner && (
                <div className="absolute top-0 right-0 bg-white text-black text-[9px] uppercase font-bold tracking-widest px-3 py-1">
                 BEST
                </div>
              )}
              <h3 className="font-bold text-[10px] uppercase tracking-widest mb-6 truncate pr-8 opacity-70">{model.name}</h3>
              <div className="flex items-end gap-2 text-5xl font-light font-mono tracking-tighter">
                {(isClass ? (score * 100) : score).toFixed(1)}
                <span className="text-xl text-white/40 font-sans tracking-normal mb-1">
                  {isClass ? '%' : 'R²'}
                </span>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-t border-white/5 pt-2">
                  <span className="text-white/40">Train Time</span>
                  <span className="font-mono">{model.metrics?.trainingTime}ms</span>
                </div>
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest border-t border-white/5 pt-2">
                  <span className="text-white/40">{isClass ? 'F1 Score' : 'RMSE'}</span>
                  <span className="font-mono text-emerald-500">{(model.metrics?.[isClass ? 'f1' : 'rmse'] || 0).toFixed(3)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        <div className="glass-panel p-8">
          <h3 className="text-[10px] uppercase tracking-widest font-bold mb-8 text-white/50">
            Performance Benchmark ({isClass ? 'Accuracy %' : 'R² Score'})
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" domain={[0, isClass ? 100 : 'auto']} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <YAxis dataKey="name" type="category" width={100} stroke="rgba(255,255,255,0.5)" fontSize={11} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                />
                <Bar dataKey="score" fill="#ffffff" barSize={32}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isClass ? (
          <div className="glass-panel p-8">
            <h3 className="text-[10px] uppercase tracking-widest font-bold mb-8 text-white/50">
              ROC Curve Overview
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="fpr" type="number" domain={[0, 1]} stroke="rgba(255,255,255,0.5)" fontSize={12} label={{ value: 'False Positive Rate', position: 'bottom', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                  <YAxis type="number" domain={[0, 1]} stroke="rgba(255,255,255,0.5)" fontSize={12} label={{ value: 'True Positive Rate', angle: -90, position: 'left', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {state.models.map((m, i) => (
                    <Line 
                      key={m.id} 
                      data={m.rocData || []} 
                      type="monotone" 
                      dataKey="tpr" 
                      name={m.name.replace('Classifier', '')} 
                      stroke={i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : '#a855f7'} 
                      strokeWidth={i === 0 ? 3 : 2} 
                      dot={false} 
                    />
                  ))}
                  <Line data={[{fpr:0, tpr:0}, {fpr:1, tpr:1}]} type="linear" dataKey="tpr" stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" dot={false} isAnimationActive={false} name="Random" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-8 flex flex-col justify-center">
             <h3 className="text-[10px] uppercase tracking-widest font-bold mb-8 text-white/50">
                Hyperparameter Highlights ({selectedModel.name})
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 {Object.entries(selectedModel.hyperparameters || {}).map(([key, value]) => (
                   <div key={key} className="bg-white/5 p-6 border border-white/10">
                     <div className="text-[9px] text-white/40 uppercase tracking-widest mb-2 font-mono">{key}</div>
                     <div className="text-2xl font-light font-mono text-white">{String(value)}</div>
                   </div>
                 ))}
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
