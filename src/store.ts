import { AppState, initialState } from './types';

type Action =
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'UPDATE_BACKEND_CONFIG'; config: Partial<AppState['backendConfig']> }
  | { type: 'UPDATE_LLM_CONFIG'; config: Partial<AppState['llmConfig']> }
  | { type: 'UPDATE_ORACLE_CONFIG'; config: Partial<AppState['oracleConfig']> }
  | { type: 'SET_DATASET'; dataset: AppState['dataset'] }
  | { type: 'SET_TARGET'; target: string; problemType: AppState['problemType'] }
  | { type: 'SET_EXCLUDED_COLUMNS'; columns: string[] }
  | { type: 'ADD_MESSAGE'; message: { role: 'user' | 'agent'; content: string } }
  | { type: 'UPDATE_STEP_STATUS'; stepId: string; status: AppState['pipelineSteps'][0]['status']; log?: string }
  | { type: 'SET_MODELS'; models: AppState['models'] }
  | { type: 'SET_REGISTRY'; datasets: AppState['datasetVersions']; models: AppState['modelVersions'] }
  | { type: 'SET_CURRENT_JOB'; job: AppState['currentJob'] }
  | { type: 'UPDATE_MODEL'; modelId: string; updates: Partial<AppState['models'][0]> }
  | { type: 'SELECT_MODEL'; modelId: string }
  | { type: 'RESET_PIPELINE' };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'UPDATE_BACKEND_CONFIG':
      return { ...state, backendConfig: { ...state.backendConfig, ...action.config } };
    case 'UPDATE_LLM_CONFIG':
      return { ...state, llmConfig: { ...state.llmConfig, ...action.config } };
    case 'UPDATE_ORACLE_CONFIG':
      return { ...state, oracleConfig: { ...state.oracleConfig, ...action.config } };
    case 'SET_DATASET':
      return { 
        ...state, 
        dataset: action.dataset,
        datasetVersions: action.dataset ? [...state.datasetVersions, action.dataset] : state.datasetVersions,
        pipelineSteps: initialState.pipelineSteps,
        models: [],
        targetColumn: null,
        problemType: null,
        excludedColumns: [],
      };
    case 'SET_TARGET':
      return { ...state, targetColumn: action.target, problemType: action.problemType };
    case 'SET_EXCLUDED_COLUMNS':
      return { ...state, excludedColumns: action.columns };
    case 'ADD_MESSAGE':
      return { ...state, agentMessages: [...state.agentMessages, action.message] };
    case 'UPDATE_STEP_STATUS':
      return {
        ...state,
        pipelineSteps: state.pipelineSteps.map((step) =>
          step.id === action.stepId
            ? { ...step, status: action.status, logs: action.log ? [...step.logs, action.log] : step.logs }
            : step
        ),
      };
    case 'SET_MODELS':
      return { 
        ...state, 
        models: action.models,
        modelVersions: [
          ...state.modelVersions.filter((existing) => !action.models.some((model) => model.id === existing.id)),
          ...action.models,
        ]
      };
    case 'SET_REGISTRY':
      return { ...state, datasetVersions: action.datasets, modelVersions: action.models };
    case 'SET_CURRENT_JOB':
      return { ...state, currentJob: action.job };
    case 'UPDATE_MODEL':
      return {
        ...state,
        models: state.models.map((m) => (m.id === action.modelId ? { ...m, ...action.updates } : m)),
        modelVersions: state.modelVersions.map((m) => (m.id === action.modelId ? { ...m, ...action.updates } : m)),
      };
    case 'SELECT_MODEL':
      return { ...state, selectedModelId: action.modelId };
    case 'RESET_PIPELINE':
      return { ...state, pipelineSteps: initialState.pipelineSteps, models: [], currentJob: null };
    default:
      return state;
  }
}
