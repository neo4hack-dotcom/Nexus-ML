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
  qualityReport?: {
    missingCells: number;
    missingRate: number;
    duplicateRows: number;
    constantColumns: string[];
    highCardinalityColumns: string[];
    warnings: { severity: 'low' | 'medium' | 'high'; message: string }[];
  };
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
    precision?: number;
    recall?: number;
    rmse?: number;
    r2?: number;
    mae?: number;
    mape?: number | null;
    cvMean?: number | null;
    cvStd?: number | null;
    cvFolds?: number;
    cvMetric?: string | null;
    perClass?: Record<string, any>;
    trainingTime: number;
  };
  hyperparameters?: Record<string, any>;
  confusionMatrix?: number[][];
  rocData?: { fpr: number; tpr: number }[];
  featureImportance?: { feature: string; importance: number }[];
  targetColumn?: string;
  featureColumns?: string[];
  excludedColumns?: string[];
  validation?: Record<string, any>;
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
  backendConfig: {
    baseUrl: string;
    status: 'checking' | 'online' | 'offline';
    engine: string;
  };
  dataset: DatasetMeta | null;
  datasetVersions: DatasetMeta[];
  targetColumn: string | null;
  problemType: 'classification' | 'regression' | null;
  excludedColumns: string[];
  agentMessages: { role: 'user' | 'agent'; content: string }[];
  pipelineSteps: PipelineStep[];
  models: MLModel[];
  modelVersions: MLModel[];
  selectedModelId: string | null;
  currentJob: {
    id: string;
    status: 'queued' | 'running' | 'success' | 'error';
    progress: number;
    logs: string[];
    error?: string | null;
  } | null;
}

export const initialState: AppState = {
  view: 'setup',
  backendConfig: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
    status: 'checking',
    engine: 'FastAPI + pandas + scikit-learn',
  },
  dataset: null,
  datasetVersions: [],
  targetColumn: null,
  problemType: null,
  excludedColumns: [],
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
  currentJob: null,
};
