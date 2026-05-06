import React from 'react';
import { Network, Database, MessageSquare, Activity, LayoutDashboard, Cpu, LineChart, Archive } from 'lucide-react';
import { AppState } from '../../types';
import { cn } from '../../lib/utils';

export function Layout({ 
  children, 
  state, 
  dispatch 
}: { 
  children: React.ReactNode; 
  state: AppState;
  dispatch: React.Dispatch<any> 
}) {
  const steps = [
    { id: 'setup', icon: Database, label: 'Data & Config' },
    { id: 'chat', icon: MessageSquare, label: 'AI Associate' },
    { id: 'explore', icon: LineChart, label: 'Data Explorer' },
    { id: 'pipeline', icon: Activity, label: 'Pipeline' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Evaluation' },
    { id: 'predict', icon: Cpu, label: 'Inference' },
    { id: 'versions', icon: Archive, label: 'Model Registry' }
  ] as const;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-white/30">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 flex-shrink-0 bg-[#080808] border-r border-white/10 flex flex-col transition-all duration-300 z-10">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-white/10">
          <div className="relative flex items-center justify-center w-6 h-6 border border-white/20 rounded-full text-white">
            <Network className="w-3 h-3 absolute" />
          </div>
          <span className="hidden md:block ml-3 font-serif italic text-lg tracking-tighter text-white">
            Nexus <span className="font-sans font-bold not-italic tracking-widest uppercase text-[9px] ml-1 opacity-50 relative -top-1">AutoML</span>
          </span>
        </div>

        <nav className="flex-1 py-8 flex flex-col gap-1 px-2 md:px-6 overflow-y-auto">
          <div className="hidden md:block text-[9px] uppercase tracking-widest text-white/30 mb-4 px-2">Navigation</div>
          {steps.map((step) => {
            const isActive = state.view === step.id;
            const isTargetRequired = ['pipeline', 'dashboard', 'predict'].includes(step.id);
            const isDataRequired = ['chat', 'explore'].includes(step.id);
            const isPipelineStarted = state.pipelineSteps.some(s => s.status === 'running' || s.status === 'success');
            const isDashboardReady = state.models.length > 0;
            
            let disabled = false;
            if (isDataRequired && !state.dataset) disabled = true;
            if (isTargetRequired && !state.targetColumn) disabled = true;
            if (step.id === 'pipeline' && !isPipelineStarted && state.view !== 'pipeline') disabled = true;
            if (step.id === 'dashboard' && !isDashboardReady) disabled = true;
            if (step.id === 'predict' && !state.selectedModelId) disabled = true;

            return (
              <button
                key={step.id}
                onClick={() => !disabled && dispatch({ type: 'SET_VIEW', view: step.id })}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-4 px-3 py-3 rounded transition-all group",
                  isActive 
                    ? "bg-white/5 text-white" 
                    : disabled 
                      ? "text-white/20 cursor-not-allowed" 
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                )}
              >
                <step.icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "")} />
                <span className="hidden md:block font-bold text-[10px] uppercase tracking-widest">{step.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="hidden md:block text-[9px] uppercase tracking-widest text-white/30 mb-3">System Status</div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              state.backendConfig.status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
              state.backendConfig.status === 'checking' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
              "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            )}></div>
            <span className="hidden md:block truncate text-[10px] font-mono tracking-widest uppercase text-white/70">
              {state.backendConfig.status === 'online' ? "Python Backend" : state.backendConfig.status === 'checking' ? "Checking API" : "API Offline"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#020202] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
