import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Wand2 } from 'lucide-react';
import { AppState } from '../types';
import { cn } from '../lib/utils';

export function AgentView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.agentMessages, isTyping]);

  useEffect(() => {
    // Initial greeting if empty
    if (state.agentMessages.length === 0 && state.dataset) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          role: 'agent',
          content: `Hello! I see you've uploaded ${state.dataset.filename} with ${state.dataset.colCount} columns and ${state.dataset.rowCount} rows. I'm your AutoML assistant. What would you like to predict? (e.g. "I want to predict if a user is active based on the other fields")`
        }
      });
    }
  }, [state.dataset, state.agentMessages.length]);

  const handleOptimizePrompt = () => {
    if (!input.trim() || !state.dataset) return;
    setIsTyping(true);
    setTimeout(() => {
      const topColumns = state.dataset!.columns.slice(0, 3).map(c => c.name).join(', ');
      const optimized = `Analyze the dataset '${state.dataset!.filename}'. Perform feature engineering focusing on missing values, then train a model to predict ${input.trim() || 'the target'} based on features like ${topColumns}. Ensure high accuracy and provide cross-validation metrics.`;
      setInput(optimized);
      setIsTyping(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    dispatch({ type: 'ADD_MESSAGE', message: { role: 'user', content: userMsg } });
    
    setIsTyping(true);

    // Simulate LLM reasoning
    setTimeout(() => {
      // Very basic intent extraction for simulation
      const lowerInput = userMsg.toLowerCase();
      let targetFound = state.dataset?.columns.find(c => lowerInput.includes(c.name.toLowerCase()));
      
      if (!targetFound && state.dataset) {
         // Fallback to the last column if no obvious match
         targetFound = state.dataset.columns[state.dataset.columns.length - 1];
      }

      const problemType = targetFound?.type === 'numeric' ? 'regression' : 'classification';

      const agentReply = `I understand. You want to predict the **${targetFound?.name || 'target'}** column.\nBased on the data profile, this looks like a **${problemType}** task.\n\nI will now:\n1. Clean and impute missing values.\n2. Encode categorical columns.\n3. Train Random Forest, XGBoost, and Logistic/Linear models.\n4. Perform Cross-Validation.\n\nAre you ready to begin the pipeline?`;

      setIsTyping(false);
      dispatch({ type: 'ADD_MESSAGE', message: { role: 'agent', content: agentReply } });
      dispatch({ type: 'SET_TARGET', target: targetFound?.name || 'target', problemType });
    }, 2000);
  };

  const handlestartPipeline = () => {
    dispatch({ type: 'RESET_PIPELINE' });
    dispatch({ type: 'SET_VIEW', view: 'pipeline' });
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-light leading-[0.9] tracking-tighter italic serif">
            AI <span className="font-bold not-italic">Associate.</span>
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-4">Define your objective in natural language.</p>
        </div>
        {state.targetColumn && (
          <button 
            onClick={handlestartPipeline}
            className="px-6 py-3 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#D4D4D4] transition-colors rounded-sm"
          >
            Start Pipeline
          </button>
        )}
      </div>

      <div className="flex-1 glass-panel flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {state.agentMessages.map((msg, i) => (
            <div key={i} className={cn("flex gap-4 max-w-[85%]", msg.role === 'user' ? "ml-auto" : "")}>
              {msg.role === 'agent' && (
                <div className="w-8 h-8 border border-white/20 rounded-sm flex items-center justify-center flex-shrink-0 bg-white/5 text-white">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={cn("px-5 py-4 border text-sm leading-relaxed", 
                msg.role === 'user' 
                  ? "bg-white text-black border-white rounded-br-none" 
                  : "bg-[#050505] text-white/80 border-white/10 rounded-bl-none font-serif italic"
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 border border-white/20 rounded-sm bg-white/5 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-5 py-4 border border-white/10 bg-[#050505] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-white/50 animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-white/50 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-white/50 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-[#080808] border-t border-white/10 flex flex-col gap-2">
          {input.trim() && (
            <div className="flex justify-end px-2">
              <button 
                onClick={handleOptimizePrompt}
                disabled={isTyping}
                className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-amber-400 hover:text-amber-300 font-bold transition-colors disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3" /> Optimize Prompt
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g. Analyze the historical sales data..."
              className="w-full bg-[#050505] border border-white/10 p-4 pr-14 focus:outline-none focus:border-white/40 transition-all text-sm font-serif italic"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-3 bg-white text-black hover:bg-[#D4D4D4] disabled:opacity-50 transition-colors uppercase font-bold tracking-widest text-[10px]"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
