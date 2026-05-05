import React, { useReducer } from 'react';
import { Layout } from './components/layout/Layout';
import { SetupView } from './views/SetupView';
import { AgentView } from './views/AgentView';
import { PipelineView } from './views/PipelineView';
import { DashboardView } from './views/DashboardView';
import { PredictView } from './views/PredictView';
import { appReducer } from './store';
import { initialState } from './types';

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <Layout state={state} dispatch={dispatch}>
      {state.view === 'setup' && <SetupView state={state} dispatch={dispatch} />}
      {state.view === 'chat' && <AgentView state={state} dispatch={dispatch} />}
      {state.view === 'pipeline' && <PipelineView state={state} dispatch={dispatch} />}
      {state.view === 'dashboard' && <DashboardView state={state} dispatch={dispatch} />}
      {state.view === 'predict' && <PredictView state={state} />}
    </Layout>
  );
}
