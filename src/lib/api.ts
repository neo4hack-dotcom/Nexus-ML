import { DatasetMeta, MLModel } from '../types';

export interface TrainResponse {
  models: MLModel[];
  logs: string[];
  problemType: 'classification' | 'regression';
}

export interface PredictResponse {
  modelId: string;
  target: string;
  prediction: string | number;
  confidence?: number;
  latencyMs: number;
}

export interface HealthResponse {
  status: string;
  engine: string;
  datasets: number;
  models: number;
  jobs: number;
}

export interface TrainingJob {
  id: string;
  status: 'queued' | 'running' | 'success' | 'error';
  progress: number;
  logs: string[];
  result?: TrainResponse | null;
  error?: string | null;
}

export interface RegistryResponse {
  datasets: DatasetMeta[];
  models: MLModel[];
  jobs: TrainingJob[];
}

export interface LLMConfigResponse {
  base_url: string;
  model_name: string;
  enabled: boolean;
  timeout_seconds: number;
  api_key_set: boolean;
}

export interface LLMConfigPayload {
  base_url: string;
  model_name: string;
  api_key?: string | null;
  enabled: boolean;
  timeout_seconds: number;
}

export interface LLMTestResponse {
  status: string;
  base_url: string;
  model_name: string;
  model_found: boolean | null;
  models: string[];
}

export interface OracleConfigResponse {
  host: string;
  port: number;
  dsn_type: 'service_name' | 'sid';
  dsn_value: string;
  username: string;
  password_set: boolean;
}

export interface OracleConfigPayload {
  host: string;
  port: number;
  dsn_type: 'service_name' | 'sid';
  dsn_value: string;
  username: string;
  password?: string | null;
}

export interface OracleTestResponse {
  status: string;
  oracle_version: string;
  host: string;
  dsn_value: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE_URL,

  async health() {
    return parseResponse<HealthResponse>(await fetch(`${API_BASE_URL}/health`));
  },

  async registry() {
    return parseResponse<RegistryResponse>(await fetch(`${API_BASE_URL}/api/registry`));
  },

  async getLLMConfig() {
    return parseResponse<LLMConfigResponse>(await fetch(`${API_BASE_URL}/api/llm/config`));
  },

  async saveLLMConfig(payload: LLMConfigPayload) {
    return parseResponse<LLMConfigResponse>(
      await fetch(`${API_BASE_URL}/api/llm/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async testLLMConfig(payload: LLMConfigPayload) {
    return parseResponse<LLMTestResponse>(
      await fetch(`${API_BASE_URL}/api/llm/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async getOracleConfig() {
    return parseResponse<OracleConfigResponse>(await fetch(`${API_BASE_URL}/api/oracle/config`));
  },

  async saveOracleConfig(payload: OracleConfigPayload) {
    return parseResponse<OracleConfigResponse>(
      await fetch(`${API_BASE_URL}/api/oracle/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async testOracleConfig(payload: OracleConfigPayload) {
    return parseResponse<OracleTestResponse>(
      await fetch(`${API_BASE_URL}/api/oracle/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async oracleQuery(sql: string) {
    return parseResponse<DatasetMeta>(
      await fetch(`${API_BASE_URL}/api/oracle/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      })
    );
  },

  async uploadDataset(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return parseResponse<DatasetMeta>(
      await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
      })
    );
  },

  async createDemoDataset() {
    return parseResponse<DatasetMeta>(
      await fetch(`${API_BASE_URL}/api/datasets/demo`, {
        method: 'POST',
      })
    );
  },

  async trainModels(datasetId: string, targetColumn: string, problemType: 'classification' | 'regression' | null, excludedColumns: string[] = []) {
    return parseResponse<TrainResponse>(
      await fetch(`${API_BASE_URL}/api/models/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          target_column: targetColumn,
          problem_type: problemType,
          excluded_columns: excludedColumns,
        }),
      })
    );
  },

  async startTrainingJob(datasetId: string, targetColumn: string, problemType: 'classification' | 'regression' | null, excludedColumns: string[] = []) {
    return parseResponse<TrainingJob>(
      await fetch(`${API_BASE_URL}/api/models/train/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          target_column: targetColumn,
          problem_type: problemType,
          excluded_columns: excludedColumns,
          validation_folds: 3,
        }),
      })
    );
  },

  jobEventsUrl(jobId: string) {
    return `${API_BASE_URL}/api/jobs/${jobId}/events`;
  },

  async modelDetails(modelId: string) {
    return parseResponse<MLModel>(await fetch(`${API_BASE_URL}/api/models/${modelId}`));
  },

  async predict(modelId: string, features: Record<string, string>) {
    return parseResponse<PredictResponse>(
      await fetch(`${API_BASE_URL}/api/models/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          features,
        }),
      })
    );
  },

  async exportModelPickle(modelId: string, filename: string) {
    const response = await fetch(`${API_BASE_URL}/api/models/${modelId}/export`);
    if (!response.ok) {
      throw new Error(`Model export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async exportModelBundle(modelId: string, filename: string) {
    const response = await fetch(`${API_BASE_URL}/api/models/${modelId}/export-bundle`);
    if (!response.ok) {
      throw new Error(`Model bundle export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async batchPredict(modelId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/api/models/${modelId}/batch-predict`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Batch inference failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const disposition = response.headers.get('content-disposition');
    const match = disposition?.match(/filename="([^"]+)"/);
    link.href = url;
    link.download = match?.[1] || `scored_${modelId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
