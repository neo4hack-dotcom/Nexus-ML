import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, PlugZap, Save, Server, ToggleLeft, ToggleRight } from 'lucide-react';
import { AppState } from '../types';
import { api, LLMTestResponse } from '../lib/api';
import { cn } from '../lib/utils';

export function ConfigurationView({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<any> }) {
  const [baseUrl, setBaseUrl] = useState(state.llmConfig.baseUrl);
  const [modelName, setModelName] = useState(state.llmConfig.modelName);
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(state.llmConfig.enabled);
  const [timeoutSeconds, setTimeoutSeconds] = useState(String(state.llmConfig.timeoutSeconds));
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<LLMTestResponse | null>(null);

  useEffect(() => {
    setBaseUrl(state.llmConfig.baseUrl);
    setModelName(state.llmConfig.modelName);
    setEnabled(state.llmConfig.enabled);
    setTimeoutSeconds(String(state.llmConfig.timeoutSeconds));
  }, [state.llmConfig]);

  const payload = () => ({
    base_url: baseUrl.trim().replace(/\/+$/, ''),
    model_name: modelName.trim(),
    api_key: apiKey.trim() ? apiKey.trim() : null,
    enabled,
    timeout_seconds: Number(timeoutSeconds) || 30,
  });

  const applyConfig = (config: Awaited<ReturnType<typeof api.getLLMConfig>>) => {
    dispatch({
      type: 'UPDATE_LLM_CONFIG',
      config: {
        baseUrl: config.base_url,
        modelName: config.model_name,
        enabled: config.enabled,
        timeoutSeconds: config.timeout_seconds,
        apiKeySet: config.api_key_set,
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.saveLLMConfig(payload());
      applyConfig(saved);
      setApiKey('');
      setMessage('Configuration LLM sauvegardée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de sauvegarder la configuration LLM.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setError(null);
    setMessage(null);
    setTestResult(null);
    try {
      const result = await api.testLLMConfig(payload());
      setTestResult(result);
      setMessage(result.model_found === false ? 'Serveur joignable, mais le modèle configuré n’a pas été listé.' : 'Serveur LLM joignable.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test LLM échoué.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 text-white">
      <div>
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          App <br /> <span className="font-bold not-italic">Configuration.</span>
        </h1>
        <p className="text-xs text-white/40 mb-10 uppercase tracking-widest leading-relaxed">
          Configure ton LLM local compatible OpenAI pour les futures fonctions d'assistance et d'automatisation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-6">
            <Server className="w-4 h-4 text-white" />
            <h2 className="text-[10px] uppercase tracking-widest font-bold">OpenAI-Compatible Local LLM</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Base URL</label>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Model Name</label>
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                placeholder="llama3"
                className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Timeout Seconds</label>
              <input
                type="number"
                min={1}
                max={300}
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
                className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">API Key</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={state.llmConfig.apiKeySet ? 'API key already saved. Leave empty to keep it.' : 'Optional for Ollama / LM Studio local servers'}
                  className="w-full bg-[#020202] border border-white/10 p-3 pl-10 text-sm font-mono focus:outline-none focus:border-white/50"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "px-4 py-3 border text-[10px] uppercase tracking-widest font-bold flex items-center gap-2",
                enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/60"
              )}
            >
              {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {enabled ? 'Enabled' : 'Disabled'}
            </button>

            <button
              onClick={handleTest}
              disabled={isTesting || !baseUrl.trim() || !modelName.trim()}
              className="px-4 py-3 border border-white/10 bg-white/5 hover:bg-white hover:text-black transition-colors text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !baseUrl.trim() || !modelName.trim()}
              className="px-5 py-3 bg-white text-black hover:bg-[#D4D4D4] transition-colors text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>

          {(message || error) && (
            <div className={cn(
              "mt-6 border px-4 py-3 text-sm",
              error ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            )}>
              {error || message}
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-[10px] uppercase tracking-widest font-bold">Current State</h2>
          </div>

          <div className="space-y-3 text-[10px] uppercase tracking-widest">
            <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
              <span className="text-white/40">Status</span>
              <span className={state.llmConfig.enabled ? 'text-emerald-300' : 'text-white/50'}>{state.llmConfig.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
              <span className="text-white/40">Model</span>
              <span className="font-mono truncate">{state.llmConfig.modelName}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
              <span className="text-white/40">API Key</span>
              <span>{state.llmConfig.apiKeySet ? 'Saved' : 'Not Set'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
              <span className="text-white/40">Timeout</span>
              <span className="font-mono">{state.llmConfig.timeoutSeconds}s</span>
            </div>
          </div>

          {testResult && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-[9px] uppercase tracking-widest text-white/40 mb-3">Detected Models</div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {testResult.models.length ? testResult.models.map((model) => (
                  <div key={model} className={cn(
                    "px-3 py-2 border text-[10px] font-mono",
                    model === modelName ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/60"
                  )}>
                    {model}
                  </div>
                )) : (
                  <div className="text-[10px] uppercase tracking-widest text-white/30">No model list returned.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
