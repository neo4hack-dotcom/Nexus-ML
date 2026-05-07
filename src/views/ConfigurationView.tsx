import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  Server,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import { AppState } from '../types';
import { api, LLMTestResponse } from '../lib/api';
import { cn } from '../lib/utils';

const PROVIDERS = [
  {
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    hint: 'Local — no API key needed',
  },
  {
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    hint: 'Local — no API key needed',
  },
  {
    label: 'vLLM',
    baseUrl: 'http://localhost:8080/v1',
    defaultModel: 'meta-llama/Llama-3-8b-instruct',
    hint: 'Local — API key optional',
  },
  {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    hint: 'Remote — API key required',
  },
] as const;

type ConnectionStatus = 'idle' | 'checking' | 'ok' | 'warn' | 'error';

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const didAutoTest = useRef(false);

  useEffect(() => {
    setBaseUrl(state.llmConfig.baseUrl);
    setModelName(state.llmConfig.modelName);
    setEnabled(state.llmConfig.enabled);
    setTimeoutSeconds(String(state.llmConfig.timeoutSeconds));
  }, [state.llmConfig]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buildPayload = useCallback(
    () => ({
      base_url: baseUrl.trim().replace(/\/+$/, ''),
      model_name: modelName.trim(),
      api_key: apiKey.trim() ? apiKey.trim() : null,
      enabled,
      timeout_seconds: Number(timeoutSeconds) || 30,
    }),
    [baseUrl, modelName, apiKey, enabled, timeoutSeconds]
  );

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

  const runTest = useCallback(
    async (silent = false) => {
      if (!baseUrl.trim() || !modelName.trim()) return;
      setIsTesting(true);
      setConnectionStatus('checking');
      if (!silent) {
        setError(null);
        setMessage(null);
        setTestResult(null);
      }
      try {
        const result = await api.testLLMConfig(buildPayload());
        setTestResult(result);
        setConnectionStatus(result.model_found === false ? 'warn' : 'ok');
        if (!silent) {
          setMessage(
            result.model_found === false
              ? 'Serveur joignable, mais le modèle configuré ne figure pas dans la liste.'
              : `Serveur joignable — ${result.models.length} modèle(s) détecté(s).`
          );
        }
      } catch (err) {
        setConnectionStatus('error');
        if (!silent) setError(err instanceof Error ? err.message : 'Test LLM échoué.');
      } finally {
        setIsTesting(false);
      }
    },
    [baseUrl, modelName, buildPayload]
  );

  // Auto-test once on mount if a config is already saved
  useEffect(() => {
    if (!didAutoTest.current && state.llmConfig.baseUrl && state.llmConfig.modelName) {
      didAutoTest.current = true;
      runTest(true);
    }
  }, [runTest, state.llmConfig.baseUrl, state.llmConfig.modelName]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.saveLLMConfig(buildPayload());
      applyConfig(saved);
      setApiKey('');
      setMessage('Configuration LLM sauvegardée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de sauvegarder la configuration LLM.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (provider: (typeof PROVIDERS)[number]) => {
    setBaseUrl(provider.baseUrl);
    setModelName(provider.defaultModel);
    setTestResult(null);
    setConnectionStatus('idle');
    setMessage(null);
    setError(null);
  };

  const selectDetectedModel = (model: string) => {
    setModelName(model);
    setShowModelDropdown(false);
    setConnectionStatus(model === modelName ? connectionStatus : 'idle');
  };

  const statusColors: Record<ConnectionStatus, string> = {
    idle: 'bg-white/20',
    checking: 'bg-amber-400 animate-pulse',
    ok: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    warn: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    idle: 'Non testé',
    checking: 'Vérification…',
    ok: 'Connecté',
    warn: 'Modèle introuvable',
    error: 'Hors ligne',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 text-white">
      <div>
        <h1 className="text-5xl md:text-6xl font-light leading-[0.9] tracking-tighter mb-4 italic serif">
          LLM <br /> <span className="font-bold not-italic">Configuration.</span>
        </h1>
        <p className="text-xs text-white/40 mb-10 uppercase tracking-widest leading-relaxed">
          Configure ton LLM local compatible OpenAI pour les fonctions d'assistance et d'automatisation.
        </p>
      </div>

      {/* Provider presets */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-white/60" />
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-white/60">Quick Presets</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROVIDERS.map((provider) => {
            const isActive = baseUrl.trim().replace(/\/+$/, '') === provider.baseUrl;
            return (
              <button
                key={provider.label}
                onClick={() => applyPreset(provider)}
                className={cn(
                  'flex flex-col items-start px-4 py-3 border text-left transition-all',
                  isActive
                    ? 'border-white/40 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/50 hover:border-white/30 hover:text-white'
                )}
              >
                <span className="text-[10px] uppercase tracking-widest font-bold">{provider.label}</span>
                <span className="text-[9px] text-white/30 font-mono mt-1 truncate w-full">{provider.baseUrl}</span>
                <span className="text-[9px] text-white/25 mt-0.5">{provider.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-white" />
              <h2 className="text-[10px] uppercase tracking-widest font-bold">OpenAI-Compatible Server</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full transition-all', statusColors[connectionStatus])} />
              <span className="text-[9px] uppercase tracking-widest text-white/40">{statusLabel[connectionStatus]}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setConnectionStatus('idle'); setTestResult(null); }}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
              />
            </div>

            {/* Model name with dropdown if models were detected */}
            <div className="md:col-span-2" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] uppercase tracking-widest text-white/40">Model Name</label>
                {testResult && testResult.models.length > 0 && (
                  <button
                    onClick={() => setShowModelDropdown((v) => !v)}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                  >
                    <span>{testResult.models.length} détectés</span>
                    <ChevronDown className={cn('w-3 h-3 transition-transform', showModelDropdown && 'rotate-180')} />
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="llama3"
                  className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
                />
                {showModelDropdown && testResult && testResult.models.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-white/10 max-h-52 overflow-y-auto">
                    {testResult.models.map((model) => (
                      <button
                        key={model}
                        onClick={() => selectDetectedModel(model)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 text-[11px] font-mono transition-colors flex items-center justify-between',
                          model === modelName
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <span>{model}</span>
                        {model === modelName && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">Timeout (secondes)</label>
              <input
                type="number"
                min={1}
                max={300}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
                className="w-full bg-[#020202] border border-white/10 p-3 text-sm font-mono focus:outline-none focus:border-white/50"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-2">API Key</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    state.llmConfig.apiKeySet
                      ? 'Clé déjà enregistrée — laisser vide pour conserver'
                      : 'Optionnel pour Ollama / LM Studio'
                  }
                  className="w-full bg-[#020202] border border-white/10 p-3 pl-10 text-sm font-mono focus:outline-none focus:border-white/50"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                'px-4 py-3 border text-[10px] uppercase tracking-widest font-bold flex items-center gap-2',
                enabled
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-white/60'
              )}
            >
              {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {enabled ? 'Activé' : 'Désactivé'}
            </button>

            <button
              onClick={() => runTest(false)}
              disabled={isTesting || !baseUrl.trim() || !modelName.trim()}
              className="px-4 py-3 border border-white/10 bg-white/5 hover:bg-white hover:text-black transition-colors text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              Tester
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !baseUrl.trim() || !modelName.trim()}
              className="px-5 py-3 bg-white text-black hover:bg-[#D4D4D4] transition-colors text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
          </div>

          {(message || error) && (
            <div
              className={cn(
                'mt-6 border px-4 py-3 text-sm',
                error
                  ? 'border-red-500/30 bg-red-500/10 text-red-100'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              )}
            >
              {error || message}
            </div>
          )}
        </div>

        {/* Status panel */}
        <div className="glass-panel p-6 flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-[10px] uppercase tracking-widest font-bold">État actuel</h2>
              </div>
              <button
                onClick={() => runTest(false)}
                disabled={isTesting}
                title="Retester"
                className="text-white/30 hover:text-white transition-colors disabled:opacity-30"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isTesting && 'animate-spin')} />
              </button>
            </div>

            <div className="space-y-3 text-[10px] uppercase tracking-widest">
              <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                <span className="text-white/40">Statut</span>
                <span className={state.llmConfig.enabled ? 'text-emerald-300' : 'text-white/50'}>
                  {state.llmConfig.enabled ? 'Activé' : 'Désactivé'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                <span className="text-white/40">Modèle</span>
                <span className="font-mono truncate">{state.llmConfig.modelName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                <span className="text-white/40">API Key</span>
                <span>{state.llmConfig.apiKeySet ? 'Enregistrée' : 'Non définie'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                <span className="text-white/40">Timeout</span>
                <span className="font-mono">{state.llmConfig.timeoutSeconds}s</span>
              </div>
              <div className="flex justify-between pb-2 gap-4">
                <span className="text-white/40">Connexion</span>
                <span
                  className={cn({
                    'text-emerald-300': connectionStatus === 'ok',
                    'text-amber-300': connectionStatus === 'warn' || connectionStatus === 'checking',
                    'text-red-400': connectionStatus === 'error',
                    'text-white/40': connectionStatus === 'idle',
                  })}
                >
                  {statusLabel[connectionStatus]}
                </span>
              </div>
            </div>
          </div>

          {testResult && testResult.models.length > 0 && (
            <div className="border-t border-white/10 pt-5">
              <div className="text-[9px] uppercase tracking-widest text-white/40 mb-3">
                Modèles détectés ({testResult.models.length})
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {testResult.models.map((model) => (
                  <button
                    key={model}
                    onClick={() => selectDetectedModel(model)}
                    className={cn(
                      'w-full text-left px-3 py-2 border text-[10px] font-mono transition-colors',
                      model === modelName
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/30'
                    )}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
