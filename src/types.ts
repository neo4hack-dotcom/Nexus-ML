export type StepStatus = 'pending' | 'running' | 'success' | 'error';
export type AppView = 'setup' | 'chat' | 'explore' | 'pipeline' | 'dashboard' | 'predict' | 'versions';

export interface DataColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text';
  missingCount: number;
  uniqueCount: number;
  sampleValues: any[];
}

export interface DatasetMeta {
  id: string;
  version: string;
  createdAt: number;
  filename: string;
  rowCount: number;
  colCount: number;
  columns: DataColumn[];
  rawPreview: any[];
  chartData?: any[];
}

export interface MLModel {
  id: string;
  version: string;
  createdAt: number;
  datasetId: string;
  name: string;
  type: 'classification' | 'regression';
  status: StepStatus;
  metrics?: {
    accuracy?: number;
    f1?: number;
    rmse?: number;
    r2?: number;
    trainingTime: number;
  };
  hyperparameters?: Record<string, any>;
  confusionMatrix?: number[][];
  rocData?: { fpr: number; tpr: number }[];
}

export interface PipelineStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  logs: string[];
}

export interface AppState {
  view: AppView;
  llmConfig: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    isSimulated: boolean;
  };
  dataset: DatasetMeta | null;
  datasetVersions: DatasetMeta[];
  targetColumn: string | null;
  problemType: 'classification' | 'regression' | null;
  agentMessages: { role: 'user' | 'agent'; content: string }[];
  pipelineSteps: PipelineStep[];
  models: MLModel[];
  modelVersions: MLModel[];
  selectedModelId: string | null;
}

export const initialState: AppState = {
  view: 'setup',
  llmConfig: {
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    modelName: 'llama3',
    isSimulated: true,
  },
  dataset: null,
  datasetVersions: [],
  targetColumn: null,
  problemType: null,
  agentMessages: [],
  pipelineSteps: [
    { id: 'ingest', title: 'Data Ingestion', description: 'Loading and parsing raw data', status: 'pending', logs: [] },
    { id: 'clean', title: 'Data Cleaning', description: 'Handling missing values and outliers', status: 'pending', logs: [] },
    { id: 'feature', title: 'Feature Engineering', description: 'Encoding categorical variables, scaling', status: 'pending', logs: [] },
    { id: 'train', title: 'Model Training', description: 'Training baseline and ensemble models', status: 'pending', logs: [] },
    { id: 'eval', title: 'Evaluation', description: 'Measuring accuracy metrics', status: 'pending', logs: [] },
  ],
  models: [],
  modelVersions: [],
  selectedModelId: null,
};
