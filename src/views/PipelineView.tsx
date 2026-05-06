import React, { useEffect, useRef } from 'react';
import { AppState } from '../types';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export function PipelineView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const lastLogCountRef = useRef(0);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state.pipelineSteps]);

  useEffect(() => {
    const runPipeline = async () => {
      if (!state.dataset || !state.targetColumn || state.pipelineSteps[0].status !== 'pending' || hasStartedRef.current) return;
      hasStartedRef.current = true;

      const update = (stepId: string, status: 'running' | 'success' | 'error', log: string) => {
        dispatch({ type: 'UPDATE_STEP_STATUS', stepId, status, log });
      };

      update('ingest', 'running', 'Opening dataset from Python backend storage...');
      update('ingest', 'success', `Loaded ${state.dataset.filename}: ${state.dataset.rowCount} rows, ${state.dataset.colCount} columns.`);
      update('clean', 'running', 'Preparing pandas cleaning plan: blank normalization and missing value strategies.');
      update('feature', 'running', 'Building scikit-learn ColumnTransformer for numeric and categorical features.');
      update('train', 'running', 'Starting Python AutoML benchmark...');

      try {
        const job = await api.startTrainingJob(state.dataset.id, state.targetColumn, state.problemType, state.excludedColumns);
        dispatch({ type: 'SET_CURRENT_JOB', job });
        lastLogCountRef.current = job.logs.length;

        const events = new EventSource(api.jobEventsUrl(job.id));
        events.onmessage = (event) => {
          const nextJob = JSON.parse(event.data);
          dispatch({ type: 'SET_CURRENT_JOB', job: nextJob });

          if (nextJob.progress >= 10) update('ingest', 'success', 'Dataset loaded from persistent registry.');
          if (nextJob.progress >= 25) update('clean', nextJob.progress >= 60 ? 'success' : 'running', 'Cleaning strategy is encoded in the Python pipeline.');
          if (nextJob.progress >= 35) update('feature', nextJob.progress >= 75 ? 'success' : 'running', 'Feature transformer prepared and validated.');
          if (nextJob.progress >= 50) update('train', nextJob.status === 'success' ? 'success' : 'running', `Training job ${nextJob.id}: ${nextJob.progress}%`);
          if (nextJob.progress >= 95) update('eval', nextJob.status === 'success' ? 'success' : 'running', 'Evaluating candidate models and registry metadata.');

          const newLogs = nextJob.logs.slice(lastLogCountRef.current);
          lastLogCountRef.current = nextJob.logs.length;
          newLogs.forEach((log: string) => {
            const targetStep = log.includes('Best model') || log.includes('completed') || log.includes('finished successfully') ? 'eval' : 'train';
            update(targetStep, nextJob.status === 'error' ? 'error' : 'running', log);
          });

          if (nextJob.status === 'success' && nextJob.result) {
            events.close();
            update('clean', 'success', 'Missing value imputation configured inside the model pipeline.');
            update('feature', 'success', 'Feature pipeline ready: median imputer, scaler, one-hot encoder.');
            update('train', 'success', `Trained ${nextJob.result.models.length} candidate models with scikit-learn.`);
            update('eval', 'success', 'Validation metrics, feature importance, and registry entries are ready.');
            dispatch({ type: 'SET_TARGET', target: state.targetColumn!, problemType: nextJob.result.problemType });
            dispatch({ type: 'SET_MODELS', models: nextJob.result.models });
            dispatch({ type: 'SELECT_MODEL', modelId: nextJob.result.models[0].id });
            window.setTimeout(() => dispatch({ type: 'SET_VIEW', view: 'dashboard' }), 1200);
          }

          if (nextJob.status === 'error') {
            events.close();
            update('train', 'error', nextJob.error || 'Training job failed');
            update('eval', 'error', 'Pipeline stopped before evaluation.');
          }
        };

        events.onerror = () => {
          events.close();
          update('train', 'error', 'Lost connection to the training event stream.');
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline failed';
        update('train', 'error', message);
        update('eval', 'error', 'Pipeline stopped before evaluation.');
      }
    };

    runPipeline();
  }, [state.dataset, state.targetColumn, state.problemType, state.excludedColumns, state.pipelineSteps, dispatch]);


  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col pt-8 animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          Execution <br/> <span className="font-bold not-italic">Pipeline.</span>
        </h1>
        <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">FastAPI is executing your machine learning pipeline with Python libraries.</p>
        {state.currentJob && (
          <div className="mt-6 max-w-xl">
            <div className="flex justify-between text-[9px] uppercase tracking-widest text-white/40 mb-2">
              <span>{state.currentJob.status}</span>
              <span>{state.currentJob.progress}%</span>
            </div>
            <div className="h-2 bg-white/10 overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${state.currentJob.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 h-0">
        
        {/* Node Graph / Stepper */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-4">
          {state.pipelineSteps.map((step, index) => {
            const isPending = step.status === 'pending';
            const isRunning = step.status === 'running';
            const isSuccess = step.status === 'success';

            return (
              <div key={step.id} className="relative flex gap-4">
                {/* Connecting Line */}
                {index !== state.pipelineSteps.length - 1 && (
                  <div className={cn("absolute left-4 top-10 bottom-[-16px] w-[1px]", isSuccess ? "bg-white" : "bg-white/10")}></div>
                )}
                
                <div className={cn(
                  "w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 z-10 transition-colors border",
                  isSuccess ? "bg-white text-black border-white" : 
                  isRunning ? "bg-white/10 text-white border-white/50" : 
                  "bg-transparent border-white/10 text-white/30"
                )}>
                  {isSuccess ? <Check className="w-4 h-4" /> : 
                   isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                   <div className="w-1 h-1 rounded-full bg-white/30"></div>}
                </div>
                
                <div className={cn("flex-1 glass-panel p-4 transition-colors", isRunning && "border-white/40 bg-white/5")}>
                  <h3 className={cn("text-[10px] uppercase tracking-widest font-bold", isRunning && "text-white")}>{step.title}</h3>
                  <p className="text-xs text-white/50 mt-2 font-serif italic">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal / Logs Output */}
        <div className="lg:col-span-2 glass-panel flex flex-col overflow-hidden">
          <div className="bg-[#080808] p-4 border-b border-white/10 flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-500">System Log Active</span>
          </div>
          <div ref={terminalRef} className="flex-1 overflow-y-auto p-6 font-mono text-[11px] bg-[#020202] text-white/70 leading-relaxed scroll-smooth shadow-inner">
            {state.pipelineSteps.map(step => (
              step.logs.map((log, i) => (
                <div key={`${step.id}-${i}`} className="mb-2 hover:bg-white/5 px-2 py-0.5 rounded -mx-2 transition-colors">
                  <span className="text-blue-400 opacity-60">[{new Date().toLocaleTimeString()}]</span>{' '}
                  <span className={cn(
                    log.includes('success') || log.includes('Passed') ? "text-emerald-500 font-bold" :
                    log.includes('Training') ? "text-amber-500" : 
                    "text-white/70"
                  )}>{log}</span>
                </div>
              ))
            ))}
            {state.pipelineSteps.some(s => s.status === 'running') && (
              <div className="flex items-center gap-2 mt-4 px-2">
                <div className="w-1.5 h-3 bg-white/70 animate-pulse"></div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
