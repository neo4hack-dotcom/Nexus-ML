import { AppState, initialState } from './types';

type Action =
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'UPDATE_LLM_CONFIG'; config: Partial<AppState['llmConfig']> }
  | { type: 'SET_DATASET'; dataset: AppState['dataset'] }
  | { type: 'SET_TARGET'; target: string; problemType: AppState['problemType'] }
  | { type: 'ADD_MESSAGE'; message: { role: 'user' | 'agent'; content: string } }
  | { type: 'UPDATE_STEP_STATUS'; stepId: string; status: AppState['pipelineSteps'][0]['status']; log?: string }
  | { type: 'SET_MODELS'; models: AppState['models'] }
  | { type: 'UPDATE_MODEL'; modelId: string; updates: Partial<AppState['models'][0]> }
  | { type: 'SELECT_MODEL'; modelId: string }
  | { type: 'RESET_PIPELINE' };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'UPDATE_LLM_CONFIG':
      return { ...state, llmConfig: { ...state.llmConfig, ...action.config } };
    case 'SET_DATASET':
      return { 
        ...state, 
        dataset: action.dataset,
        datasetVersions: action.dataset ? [...state.datasetVersions, action.dataset] : state.datasetVersions,
        pipelineSteps: initialState.pipelineSteps,
        models: [],
        targetColumn: null,
        problemType: null,
      };
    case 'SET_TARGET':
      return { ...state, targetColumn: action.target, problemType: action.problemType };
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
        modelVersions: [...state.modelVersions, ...action.models]
      };
    case 'UPDATE_MODEL':
      return {
        ...state,
        models: state.models.map((m) => (m.id === action.modelId ? { ...m, ...action.updates } : m)),
        modelVersions: state.modelVersions.map((m) => (m.id === action.modelId ? { ...m, ...action.updates } : m)),
      };
    case 'SELECT_MODEL':
      return { ...state, selectedModelId: action.modelId };
    case 'RESET_PIPELINE':
      return { ...state, pipelineSteps: initialState.pipelineSteps, models: [] };
    default:
      return state;
  }
}

export function analyzeDataset(data: any[], filename: string): AppState['dataset'] {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);
  const rowCount = data.length;
  const id = `ds_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const version = `v1.0.${Math.floor(Math.random() * 100)}`;

  const columns = headers.map((header) => {
    let missing = 0;
    const values = new Set<any>();
    let numericCount = 0;
    
    // Sample only first 100 rows for speed and sample data
    const sampleSize = Math.min(100, rowCount);
    const sampleValues = [];

    for (let i = 0; i < rowCount; i++) {
      const val = data[i][header];
      if (val === null || val === undefined || val === '') {
        missing++;
      } else {
        values.add(val);
        if (!isNaN(Number(val))) {
          numericCount++;
        }
      }
      
      if (i < sampleSize && val !== null && val !== '') {
        sampleValues.push(val);
      }
    }

    const uniqueCount = values.size;
    let type: 'numeric' | 'categorical' | 'text' = 'text';

    if (numericCount / (rowCount - missing || 1) > 0.9) {
      type = 'numeric';
    } else if (uniqueCount < 20 || uniqueCount / rowCount < 0.1) {
      type = 'categorical';
    }

    return {
      name: header,
      type,
      missingCount: missing,
      uniqueCount,
      sampleValues: sampleValues.slice(0, 5)
    };
  });

  return {
    id,
    version,
    createdAt: Date.now(),
    filename,
    rowCount,
    colCount: headers.length,
    columns,
    rawPreview: data.slice(0, 10),
    chartData: data.slice(0, 500) // Store up to 500 rows for charts
  };
}
