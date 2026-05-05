import React, { useState } from 'react';
import { AppState } from '../types';
import { Play, FileJson, Table2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function PredictView({ state }: { state: AppState }) {
  const model = state.models.find(m => m.id === state.selectedModelId);
  const [inputData, setInputData] = useState<Record<string, string>>({});
  const [prediction, setPrediction] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  if (!model || !state.dataset) return null;

  // Features are all columns except the target
  const features = state.dataset.columns.filter(c => c.name !== state.targetColumn);

  const handleInputChange = (colName: string, value: string) => {
    setInputData(prev => ({ ...prev, [colName]: value }));
    setPrediction(null);
  };

  const handlePredict = () => {
    setIsPredicting(true);
    setTimeout(() => {
      // Fake Prediction Logic
      if (state.problemType === 'classification') {
        const classes = ['Yes', 'No', 'Active', 'Inactive', 'High', 'Low'];
        setPrediction(classes[Math.floor(Math.random() * classes.length)] + ` (${(Math.random() * 0.4 + 0.5).toFixed(2)} prob)`);
      } else {
        setPrediction((Math.random() * 1000).toFixed(2));
      }
      setIsPredicting(false);
    }, 1000);
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
                 {prediction.split(' ')[0]}
               </div>
               {prediction.includes('prob') && (
                  <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-500 mt-2">
                    CONFIDENCE: {prediction.split('(')[1].replace('prob)', '').trim()}
                  </div>
               )}
               
               <div className="w-full mt-16 bg-[#050505] p-6 border border-white/10 text-left text-[10px] font-mono text-white/50">
                  <div className="text-white/30 mb-4">// JSON PAYLOAD (INTERNAL SIM)</div>
                  <div>{'{'}</div>
                  <div className="pl-4 py-1">"target": "{state.targetColumn}",</div>
                  <div className="pl-4 py-1 text-emerald-500 font-bold">"prediction": "{prediction.split(' ')[0]}",</div>
                  {prediction.includes('prob') && (
                    <div className="pl-4 py-1">"confidence": {prediction.split('(')[1].replace('prob)', '').trim()},</div>
                  )}
                  <div className="pl-4 py-1">"latency_ms": {Math.floor(Math.random() * 20 + 2)}</div>
                  <div>{'}'}</div>
               </div>
             </motion.div>
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
