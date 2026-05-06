import React, { useState } from 'react';
import { AppState } from '../types';
import { motion } from 'motion/react';
import { api, PredictResponse } from '../lib/api';

export function PredictView({ state }: { state: AppState }) {
  const model = state.models.find(m => m.id === state.selectedModelId) || state.modelVersions.find(m => m.id === state.selectedModelId);
  const [inputData, setInputData] = useState<Record<string, string>>({});
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isBatchScoring, setIsBatchScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!model || !state.dataset) return null;

  // Features are all columns except the target
  const modelFeatureColumns = model.featureColumns || [];
  const features = state.dataset.columns.filter(c => modelFeatureColumns.length ? modelFeatureColumns.includes(c.name) : c.name !== state.targetColumn);

  const handleInputChange = (colName: string, value: string) => {
    setInputData(prev => ({ ...prev, [colName]: value }));
    setPrediction(null);
    setError(null);
  };

  const handleBatchPredict = async (file: File | null) => {
    if (!file) return;
    setIsBatchScoring(true);
    setError(null);
    try {
      await api.batchPredict(model.id, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch inference failed');
    } finally {
      setIsBatchScoring(false);
    }
  };

  const handlePredict = async () => {
    setIsPredicting(true);
    setError(null);
    try {
      setPrediction(await api.predict(model.id, inputData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-10">
        <div className="inline-block px-3 py-1 bg-white text-black text-[9px] font-bold uppercase tracking-widest mb-6">
          Deploy Target: {model.name}
        </div>
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter italic serif">
          Interactive <br/><span className="font-bold not-italic">Inference.</span>
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-white/40 mt-4 max-w-md">
          Test your trained model on raw feature inputs in real-time.
        </p>
        <div className="mt-5 inline-flex items-center gap-3">
          <input
            id="batch-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => handleBatchPredict(event.target.files?.[0] || null)}
          />
          <label
            htmlFor="batch-upload"
            className="px-4 py-2 border border-white/10 bg-white/5 hover:bg-white hover:text-black transition-colors text-[9px] uppercase tracking-widest font-bold cursor-pointer"
          >
            {isBatchScoring ? 'Scoring Batch...' : 'Batch Score CSV'}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Input Form */}
        <div className="glass-panel flex flex-col overflow-hidden">
          <div className="bg-[#080808] p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/50">
              Feature Input
            </h3>
            <button 
              onClick={() => {
                // Auto-fill random data from sample values
                const randomParams: Record<string,string> = {};
                features.forEach(f => {
                   if (f.sampleValues && f.sampleValues.length > 0) {
                     randomParams[f.name] = f.sampleValues[Math.floor(Math.random() * f.sampleValues.length)];
                   } else {
                     randomParams[f.name] = f.type === 'numeric' ? '0' : 'Unknown';
                   }
                });
                setInputData(randomParams);
                setPrediction(null);
                setError(null);
              }}
              className="text-[9px] uppercase tracking-widest font-bold text-white hover:text-white/70 transition-colors"
            >
              Fill Random Row
            </button>
          </div>
          
          <div className="p-8 overflow-y-auto flex-1 grid grid-cols-2 gap-6 auto-rows-max">
            {features.slice(0, 10).map((feat, idx) => ( // limit to 10 for UI cleanliness if dataset huge
              <div key={idx} className="col-span-1">
                <label className="text-[9px] text-white/40 mb-2 block uppercase tracking-widest font-bold truncate" title={feat.name}>
                  {feat.name}
                </label>
                <input
                  type={feat.type === 'numeric' ? 'number' : 'text'}
                  placeholder={`<${feat.type}>`}
                  value={inputData[feat.name] || ''}
                  onChange={(e) => handleInputChange(feat.name, e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 p-3 text-[11px] focus:outline-none focus:border-white/50 transition-colors font-mono"
                />
              </div>
            ))}
            {features.length > 10 && (
              <div className="col-span-2 text-center text-[10px] uppercase tracking-widest text-white/30 mt-4 italic">
                + {features.length - 10} more features omitted for UI simplicity.
              </div>
            )}
          </div>

          <div className="p-6 border-t border-white/10 bg-[#080808]">
            <button
              onClick={handlePredict}
              disabled={isPredicting || Object.keys(inputData).length === 0}
              className="w-full py-4 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#D4D4D4] transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
            >
               {isPredicting ? (
                 <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
               ) : (
                 <>Run Prediction</>
               )}
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="glass-panel p-10 flex flex-col items-center justify-center text-center relative overflow-hidden bg-[#020202]">
           {prediction ? (
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center z-10 w-full">
               <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-8">
                 Predicted Outcome: {state.targetColumn}
               </div>
               <div className="text-7xl md:text-8xl font-light italic serif text-white leading-none truncate max-w-full px-4 mb-4">
                 {String(prediction.prediction)}
               </div>
               {typeof prediction.confidence === 'number' && (
                  <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 mt-2">
                    CONFIDENCE: {prediction.confidence.toFixed(3)}
                  </div>
               )}
               
               <div className="w-full mt-16 bg-[#050505] p-6 border border-white/10 text-left text-[10px] font-mono text-white/50">
                  <div className="text-white/30 mb-4">// JSON PAYLOAD (FASTAPI)</div>
                  <div>{'{'}</div>
                  <div className="pl-4 py-1">"target": "{prediction.target}",</div>
                  <div className="pl-4 py-1 text-emerald-500 font-bold">"prediction": "{String(prediction.prediction)}",</div>
                  {typeof prediction.confidence === 'number' && (
                    <div className="pl-4 py-1">"confidence": {prediction.confidence.toFixed(6)},</div>
                  )}
                  <div className="pl-4 py-1">"latency_ms": {prediction.latencyMs}</div>
                  <div>{'}'}</div>
               </div>
             </motion.div>
           ) : error ? (
             <div className="flex flex-col items-center z-10 max-w-sm">
               <h3 className="text-3xl font-light italic serif text-red-200">Prediction failed.</h3>
               <p className="text-[11px] uppercase tracking-widest mt-6 text-red-200/70 text-center">{error}</p>
             </div>
           ) : (
             <div className="flex flex-col items-center opacity-30 z-10">
               <h3 className="text-4xl font-light italic serif">Awaiting <br/> <span className="font-bold not-italic">Data.</span></h3>
               <p className="text-[10px] uppercase tracking-widest mt-6 max-w-[200px] text-center">Fill the features on the left and execute.</p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
