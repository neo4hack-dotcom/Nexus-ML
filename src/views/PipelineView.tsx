import React, { useEffect, useRef } from 'react';
import { AppState, MLModel } from '../types';
import { Play, Check, CircleAlert, Loader2, FastForward } from 'lucide-react';
import { cn } from '../lib/utils';

export function PipelineView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state.pipelineSteps]);

  // The engine that simulates the ML run!
  useEffect(() => {
    let timeoutIds: NodeJS.Timeout[] = [];
    const runSimulation = () => {
      // Only start if pending
      if (state.pipelineSteps[0].status !== 'pending') return;

      const scheduleLog = (stepId: string, log: string, delay: number, status?: 'running' | 'success' | 'error') => {
        const id = setTimeout(() => {
          if (status) {
            dispatch({ type: 'UPDATE_STEP_STATUS', stepId, log, status });
          } else {
            dispatch({ type: 'UPDATE_STEP_STATUS', stepId, log, status: 'running' }); // Keep it running if it's just a log
          }
        }, delay);
        timeoutIds.push(id);
      };

      let time = 500;

      // --- INGEST ---
      scheduleLog('ingest', 'Initializing data pipeline...', time, 'running'); time += 800;
      scheduleLog('ingest', `Loading ${state.dataset?.filename} into memory...`, time); time += 600;
      scheduleLog('ingest', `Parsed ${state.dataset?.rowCount} rows, ${state.dataset?.colCount} columns.`, time); time += 800;
      scheduleLog('ingest', 'Data Validation Passed.', time, 'success'); time += 500;

      // --- CLEAN ---
      scheduleLog('clean', 'Analyzing missing values...', time, 'running'); time += 1200;
      state.dataset?.columns.forEach(col => {
        if (col.missingCount > 0) {
          scheduleLog('clean', `Imputing ${col.missingCount} missing values in '${col.name}' using ${col.type === 'numeric' ? 'median' : 'mode'} strategy...`, time);
          time += 700;
        }
      });
      scheduleLog('clean', 'Detecting outliers using Isolation Forest...', time); time += 1500;
      scheduleLog('clean', 'Outlier removal complete.', time, 'success'); time += 500;

      // --- FEATURE ENGINEERING ---
      scheduleLog('feature', 'Starting feature engineering...', time, 'running'); time += 800;
      scheduleLog('feature', 'Applying TargetEncoder to high-cardinality categoricals...', time); time += 1200;
      scheduleLog('feature', 'Applying StandardScaler to numeric columns...', time); time += 900;
      scheduleLog('feature', 'Generating polynomial features for correlation pairs...', time); time += 1500;
      scheduleLog('feature', 'Feature engineering complete. Generated 14 new features.', time, 'success'); time += 500;

      // --- MODEL TRAINING ---
      scheduleLog('train', 'Initializing AutoML training loop...', time, 'running'); time += 1000;
      
      const modelsToTrain = state.problemType === 'regression' 
        ? ['Random Forest Regressor', 'XGBoost Regressor', 'Ridge Regression']
        : ['Random Forest Classifier', 'XGBoost Classifier', 'Logistic Regression'];

      modelsToTrain.forEach(m => {
        scheduleLog('train', `[Training] ${m}...`, time); time += 2000;
        scheduleLog('train', `[Finished] ${m}.`, time); time += 500;
      });
      scheduleLog('train', 'Model ensemble created.', time, 'success'); time += 500;

      // --- EVALUATION ---
      scheduleLog('eval', 'Running 5-fold Cross Validation...', time, 'running'); time += 2000;
      scheduleLog('eval', 'Calculating metrics...', time); time += 1000;
      scheduleLog('eval', 'Pipeline execution finished successfully.', time, 'success');

      // Finalize models
      const finalizeId = setTimeout(() => {
        const isClass = state.problemType === 'classification';
        const generatedModels: MLModel[] = modelsToTrain.map((name, i) => {
          const baseScore = 0.75 + (Math.random() * 0.2); // Random baseline between 75-95%
          const versionId = `v${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
          
          return {
            id: `model-${Date.now()}-${i}`,
            version: versionId,
            createdAt: Date.now(),
            datasetId: state.dataset?.id || 'unknown',
            name: name,
            type: state.problemType || 'classification',
            status: 'success',
            metrics: {
              [isClass ? 'accuracy' : 'r2']: baseScore + (i === 1 ? 0.05 : 0), // Make XGBoost slightly better usually
              [isClass ? 'f1' : 'rmse']: isClass ? baseScore - 0.02 : (1 - baseScore) * 100,
              trainingTime: Math.floor(Math.random() * 50) + 12
            },
            hyperparameters: {
              learning_rate: isClass ? 0.01 : undefined,
              max_depth: Math.floor(Math.random() * 5) + 3,
              n_estimators: [100, 200, 500][Math.floor(Math.random() * 3)]
            },
            // Fake confusion matrix for classification
            confusionMatrix: isClass ? [
              [Math.floor(Math.random()*200)+50, Math.floor(Math.random()*20)],
              [Math.floor(Math.random()*15), Math.floor(Math.random()*150)+80]
            ] : undefined,
            // Fake ROC Data
            rocData: isClass ? Array.from({length: 10}).map((_, i) => ({ fpr: i/10, tpr: Math.min(1, (i/10) * (1.5 + baseScore)) })) : undefined
          } as MLModel;
        });

        // Sort by accuracy/r2 descending
        generatedModels.sort((a,b) => {
          const aS = a.metrics?.accuracy || a.metrics?.r2 || 0;
          const bS = b.metrics?.accuracy || b.metrics?.r2 || 0;
          return bS - aS;
        });

        dispatch({ type: 'SET_MODELS', models: generatedModels });
        dispatch({ type: 'SELECT_MODEL', modelId: generatedModels[0].id });
        
        // Auto navigate to dashboard after a delay
        setTimeout(() => dispatch({ type: 'SET_VIEW', view: 'dashboard' }), 3000);

      }, time + 500);
      timeoutIds.push(finalizeId);
    };

    runSimulation();

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [state.pipelineSteps[0].status, state.dataset]);


  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col pt-8 animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          Execution <br/> <span className="font-bold not-italic">Pipeline.</span>
        </h1>
        <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">The AI agent is constructing and executing your machine learning pipeline locally.</p>
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
