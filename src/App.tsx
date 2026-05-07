import React, { useEffect, useReducer } from 'react';
import { Layout } from './components/layout/Layout';
import { SetupView } from './views/SetupView';
import { AgentView } from './views/AgentView';
import { PipelineView } from './views/PipelineView';
import { DashboardView } from './views/DashboardView';
import { PredictView } from './views/PredictView';
import { ExploreView } from './views/ExploreView';
import { VersionsView } from './views/VersionsView';
import { ConfigurationView } from './views/ConfigurationView';
import { appReducer } from './store';
import { initialState } from './types';
import { api } from './lib/api';

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    api.health()
      .then((health) => {
        dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'online', engine: health.engine, baseUrl: api.baseUrl } });
        return Promise.all([api.registry(), api.getLLMConfig()]);
      })
      .then(([registry, llmConfig]) => {
        dispatch({ type: 'SET_REGISTRY', datasets: registry.datasets, models: registry.models });
        dispatch({
          type: 'UPDATE_LLM_CONFIG',
          config: {
            baseUrl: llmConfig.base_url,
            modelName: llmConfig.model_name,
            enabled: llmConfig.enabled,
            timeoutSeconds: llmConfig.timeout_seconds,
            apiKeySet: llmConfig.api_key_set,
          },
        });
      })
      .catch(() => dispatch({ type: 'UPDATE_BACKEND_CONFIG', config: { status: 'offline', baseUrl: api.baseUrl } }));
  }, []);

  return (
    <Layout state={state} dispatch={dispatch}>
      {state.view === 'setup' && <SetupView state={state} dispatch={dispatch} />}
      {state.view === 'config' && <ConfigurationView state={state} dispatch={dispatch} />}
      {state.view === 'chat' && <AgentView state={state} dispatch={dispatch} />}
      {state.view === 'explore' && <ExploreView state={state} />}
      {state.view === 'pipeline' && <PipelineView state={state} dispatch={dispatch} />}
      {state.view === 'dashboard' && <DashboardView state={state} dispatch={dispatch} />}
      {state.view === 'predict' && <PredictView state={state} />}
      {state.view === 'versions' && <VersionsView state={state} dispatch={dispatch} />}
    </Layout>
  );
}
