from __future__ import annotations

import json
import math
import pickle
import queue
import re
import sqlite3
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any, Literal

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sklearn.compose import ColumnTransformer
from sklearn.datasets import make_classification
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_curve,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ProblemType = Literal["classification", "regression"]
JobStatus = Literal["queued", "running", "success", "error"]

APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent
STORAGE_DIR = APP_DIR / "storage"
MODEL_DIR = STORAGE_DIR / "models"
DATASET_DIR = STORAGE_DIR / "datasets"
EXPORT_DIR = STORAGE_DIR / "exports"
REGISTRY_DB = STORAGE_DIR / "registry.sqlite3"
for directory in (MODEL_DIR, DATASET_DIR, EXPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Nexus AutoML Python API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATASETS: dict[str, pd.DataFrame] = {}
DATASET_META: dict[str, dict[str, Any]] = {}
MODELS: dict[str, Pipeline] = {}
MODEL_META: dict[str, dict[str, Any]] = {}
JOBS: dict[str, dict[str, Any]] = {}
JOB_EVENTS: dict[str, "queue.Queue[dict[str, Any]]"] = {}
LOCK = threading.RLock()


class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    problem_type: ProblemType | None = None
    excluded_columns: list[str] = Field(default_factory=list)
    validation_folds: int = 3


class PredictRequest(BaseModel):
    model_id: str
    features: dict[str, Any]


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(REGISTRY_DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_registry() -> None:
    with connect_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                filename TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )


def load_registry() -> None:
    init_registry()
    with connect_db() as conn:
        for row in conn.execute("SELECT payload FROM datasets"):
            payload = json.loads(row["payload"])
            DATASET_META[payload["id"]] = payload
        for row in conn.execute("SELECT payload FROM models"):
            payload = json.loads(row["payload"])
            MODEL_META[payload["id"]] = payload
        for row in conn.execute("SELECT payload FROM jobs"):
            payload = json.loads(row["payload"])
            if payload.get("status") == "running":
                payload["status"] = "error"
                payload["logs"] = [*payload.get("logs", []), "Backend restarted before the job completed."]
            JOBS[payload["id"]] = payload
            JOB_EVENTS[payload["id"]] = queue.Queue()


def save_dataset_meta(payload: dict[str, Any]) -> None:
    DATASET_META[payload["id"]] = payload
    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO datasets (id, created_at, filename, payload) VALUES (?, ?, ?, ?)",
            (payload["id"], payload["createdAt"], payload["filename"], json.dumps(json_safe(payload))),
        )


def save_model_meta(payload: dict[str, Any]) -> None:
    MODEL_META[payload["id"]] = payload
    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO models (id, dataset_id, created_at, name, status, payload) VALUES (?, ?, ?, ?, ?, ?)",
            (
                payload["id"],
                payload["datasetId"],
                payload["createdAt"],
                payload["name"],
                payload["status"],
                json.dumps(json_safe(payload)),
            ),
        )


def save_job(job: dict[str, Any]) -> None:
    job["updatedAt"] = int(time.time() * 1000)
    JOBS[job["id"]] = job
    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO jobs (id, created_at, updated_at, status, payload) VALUES (?, ?, ?, ?, ?)",
            (job["id"], job["createdAt"], job["updatedAt"], job["status"], json.dumps(json_safe(job))),
        )


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if math.isnan(float(value)) or math.isinf(float(value)):
            return None
        return float(value)
    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]
    df = df.replace(r"^\s*$", np.nan, regex=True)
    return df.dropna(axis=1, how="all")


def infer_column_type(series: pd.Series) -> str:
    non_null = series.dropna()
    if non_null.empty:
        return "text"

    numeric = pd.to_numeric(non_null, errors="coerce")
    if numeric.notna().mean() >= 0.9:
        return "numeric"

    string_values = non_null.astype(str).head(100)
    date_like_ratio = string_values.str.contains(
        re.compile(r"(?:\d{4}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4})"),
        regex=True,
    ).mean()
    if date_like_ratio >= 0.6:
        parsed_dates = pd.to_datetime(non_null, errors="coerce", utc=True)
        if parsed_dates.notna().mean() >= 0.85:
            return "datetime"

    unique_count = non_null.nunique(dropna=True)
    if unique_count < 20 or unique_count / max(len(series), 1) < 0.1:
        return "categorical"
    return "text"


def quality_report(df: pd.DataFrame, columns: list[dict[str, Any]]) -> dict[str, Any]:
    total_cells = max(int(df.shape[0] * df.shape[1]), 1)
    missing_cells = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    warnings: list[dict[str, str]] = []

    for column in columns:
        missing_rate = column["missingCount"] / max(len(df), 1)
        unique_rate = column["uniqueCount"] / max(len(df), 1)
        if column["uniqueCount"] <= 1:
            warnings.append({"severity": "high", "message": f"{column['name']} is constant or empty."})
        elif missing_rate > 0.35:
            warnings.append({"severity": "medium", "message": f"{column['name']} has {missing_rate:.0%} missing values."})
        elif column["type"] in {"categorical", "text"} and unique_rate > 0.7:
            warnings.append({"severity": "medium", "message": f"{column['name']} has high cardinality and may need review."})

    if duplicate_rows:
        warnings.append({"severity": "low", "message": f"{duplicate_rows} duplicate rows detected."})

    return {
        "missingCells": missing_cells,
        "missingRate": missing_cells / total_cells,
        "duplicateRows": duplicate_rows,
        "constantColumns": [col["name"] for col in columns if col["uniqueCount"] <= 1],
        "highCardinalityColumns": [
            col["name"]
            for col in columns
            if col["type"] in {"categorical", "text"} and col["uniqueCount"] / max(len(df), 1) > 0.7
        ],
        "warnings": warnings[:12],
    }


def dataframe_payload(df: pd.DataFrame, filename: str, dataset_id: str | None = None) -> dict[str, Any]:
    dataset_id = dataset_id or f"ds_{uuid.uuid4().hex[:10]}"
    clean_df = normalize_dataframe(df)
    columns = []

    for name in clean_df.columns:
        series = clean_df[name]
        non_null = series.dropna()
        samples = non_null.astype(str).drop_duplicates().head(5).tolist()
        columns.append(
            {
                "name": name,
                "type": infer_column_type(series),
                "missingCount": int(series.isna().sum()),
                "uniqueCount": int(non_null.nunique(dropna=True)),
                "sampleValues": samples,
            }
        )

    payload = {
        "id": dataset_id,
        "version": f"v{len(DATASET_META) + 1}.0.0",
        "createdAt": int(time.time() * 1000),
        "filename": filename,
        "rowCount": int(len(clean_df)),
        "colCount": int(len(clean_df.columns)),
        "columns": columns,
        "qualityReport": quality_report(clean_df, columns),
        "rawPreview": json_safe(clean_df.head(10).to_dict(orient="records")),
        "chartData": json_safe(clean_df.head(500).to_dict(orient="records")),
    }
    DATASETS[dataset_id] = clean_df
    clean_df.to_pickle(DATASET_DIR / f"{dataset_id}.pkl")
    save_dataset_meta(payload)
    return payload


def load_dataset(dataset_id: str) -> pd.DataFrame:
    if dataset_id in DATASETS:
        return DATASETS[dataset_id]
    dataset_path = DATASET_DIR / f"{dataset_id}.pkl"
    if dataset_path.exists():
        df = pd.read_pickle(dataset_path)
        DATASETS[dataset_id] = df
        return df
    raise HTTPException(status_code=404, detail="Dataset not found")


def detect_problem_type(df: pd.DataFrame, target_column: str) -> ProblemType:
    target = df[target_column].dropna()
    if target.empty:
        raise HTTPException(status_code=400, detail="Target column is empty")
    numeric_target = pd.to_numeric(target, errors="coerce")
    if numeric_target.notna().mean() >= 0.95 and target.nunique() > 20:
        return "regression"
    return "classification"


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric_columns = [col for col in X.columns if infer_column_type(X[col]) == "numeric"]
    categorical_columns = [col for col in X.columns if col not in numeric_columns]

    transformers = []
    if numeric_columns:
        transformers.append(
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_columns,
            )
        )
    if categorical_columns:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=40)),
                    ]
                ),
                categorical_columns,
            )
        )
    if not transformers:
        raise HTTPException(status_code=400, detail="No usable feature columns found")
    return ColumnTransformer(transformers=transformers)


def candidate_models(problem_type: ProblemType) -> list[tuple[str, Any, dict[str, Any]]]:
    if problem_type == "classification":
        return [
            (
                "Random Forest Classifier",
                RandomForestClassifier(n_estimators=140, random_state=42, class_weight="balanced"),
                {"n_estimators": 140, "class_weight": "balanced"},
            ),
            (
                "Gradient Boosting Classifier",
                HistGradientBoostingClassifier(random_state=42),
                {"max_iter": 100, "learning_rate": 0.1},
            ),
            (
                "Logistic Regression",
                LogisticRegression(max_iter=1000, class_weight="balanced"),
                {"max_iter": 1000, "class_weight": "balanced"},
            ),
        ]
    return [
        ("Random Forest Regressor", RandomForestRegressor(n_estimators=160, random_state=42), {"n_estimators": 160}),
        (
            "Gradient Boosting Regressor",
            HistGradientBoostingRegressor(random_state=42),
            {"max_iter": 100, "learning_rate": 0.1},
        ),
        ("Ridge Regression", Ridge(alpha=1.0), {"alpha": 1.0}),
    ]


def prepare_training_frame(
    df: pd.DataFrame,
    target_column: str,
    problem_type: ProblemType,
    excluded_columns: list[str],
) -> tuple[pd.DataFrame, pd.Series]:
    if target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Unknown target column: {target_column}")

    excluded = [column for column in excluded_columns if column in df.columns and column != target_column]
    frame = df.drop(columns=excluded).dropna(subset=[target_column]).copy()
    if len(frame) < 12:
        raise HTTPException(status_code=400, detail="Need at least 12 rows with a target value to train models")

    X = frame.drop(columns=[target_column])
    y = frame[target_column]
    if problem_type == "regression":
        y = pd.to_numeric(y, errors="coerce")
        valid = y.notna()
        X = X.loc[valid]
        y = y.loc[valid]
    else:
        y = y.astype(str)

    if y.nunique() < 2:
        raise HTTPException(status_code=400, detail="Target column must contain at least two distinct values")
    return X, y


def feature_importance_payload(pipeline: Pipeline, max_items: int = 20) -> list[dict[str, Any]]:
    preprocessor = pipeline.named_steps["preprocess"]
    estimator = pipeline.named_steps["model"]
    try:
        names = preprocessor.get_feature_names_out()
    except Exception:
        names = np.array([f"feature_{i}" for i in range(getattr(estimator, "n_features_in_", 0))])

    if hasattr(estimator, "feature_importances_"):
        values = estimator.feature_importances_
    elif hasattr(estimator, "coef_"):
        coef = np.asarray(estimator.coef_)
        values = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)
    else:
        return []

    total = float(np.sum(np.abs(values))) or 1.0
    pairs = sorted(zip(names, values), key=lambda item: abs(float(item[1])), reverse=True)
    return [
        {
            "feature": str(name).replace("numeric__", "").replace("categorical__", ""),
            "importance": float(abs(value) / total),
        }
        for name, value in pairs[:max_items]
    ]


def classification_metrics(y_test: pd.Series, predictions: np.ndarray, pipeline: Pipeline, X_test: pd.DataFrame) -> dict[str, Any]:
    labels = sorted(y_test.astype(str).unique().tolist())
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "f1": float(f1_score(y_test, predictions, average="weighted")),
        "precision": float(precision_score(y_test, predictions, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_test, predictions, average="weighted", zero_division=0)),
        "perClass": classification_report(y_test, predictions, output_dict=True, zero_division=0),
    }
    confusion = confusion_matrix(y_test, predictions, labels=labels).tolist()
    roc_data = None
    estimator = pipeline.named_steps["model"]
    if len(labels) == 2 and hasattr(estimator, "predict_proba"):
        probabilities = pipeline.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, probabilities, pos_label=labels[1])
        roc_data = [{"fpr": float(x), "tpr": float(y_val)} for x, y_val in zip(fpr, tpr)]
    return {"metrics": metrics, "confusionMatrix": confusion, "rocData": roc_data}


def regression_metrics(y_test: pd.Series, predictions: np.ndarray) -> dict[str, Any]:
    non_zero_mask = np.asarray(y_test) != 0
    mape = None
    if non_zero_mask.any():
        mape = float(mean_absolute_percentage_error(np.asarray(y_test)[non_zero_mask], np.asarray(predictions)[non_zero_mask]))
    return {
        "metrics": {
            "rmse": float(math.sqrt(mean_squared_error(y_test, predictions))),
            "r2": float(r2_score(y_test, predictions)),
            "mae": float(mean_absolute_error(y_test, predictions)),
            "mape": mape,
        },
        "confusionMatrix": None,
        "rocData": None,
    }


def run_cross_validation(
    pipeline: Pipeline,
    X: pd.DataFrame,
    y: pd.Series,
    problem_type: ProblemType,
    folds: int,
) -> dict[str, Any]:
    folds = max(2, min(int(folds or 3), 5))
    try:
        if problem_type == "classification":
            min_class = int(y.value_counts().min())
            cv_folds = max(2, min(folds, min_class))
            cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
            scoring = "f1_weighted"
        else:
            cv_folds = min(folds, len(y))
            cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
            scoring = "r2"
        scores = cross_val_score(pipeline, X, y, cv=cv, scoring=scoring)
        return {
            "cvMetric": scoring,
            "cvFolds": int(cv_folds),
            "cvMean": float(np.mean(scores)),
            "cvStd": float(np.std(scores)),
        }
    except Exception as exc:
        return {"cvMetric": None, "cvFolds": 0, "cvMean": None, "cvStd": None, "cvError": str(exc)}


def load_model_pipeline(model_id: str) -> tuple[dict[str, Any], Pipeline]:
    model_meta = MODEL_META.get(model_id)
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    pipeline = MODELS.get(model_id)
    if pipeline is None:
        pipeline = joblib.load(model_meta["modelPath"])
        MODELS[model_id] = pipeline
    return model_meta, pipeline


def export_filename(model_meta: dict[str, Any], suffix: str = "pkl") -> str:
    name = re.sub(r"[^A-Za-z0-9_.-]+", "_", model_meta["name"]).strip("_").lower()
    return f"{name}_{model_meta['id']}.{suffix}"


def train_models_core(request: TrainRequest, log: Any | None = None) -> dict[str, Any]:
    def emit(message: str, progress: int | None = None) -> None:
        if log:
            log(message, progress)

    df = load_dataset(request.dataset_id)
    problem_type = request.problem_type or detect_problem_type(df, request.target_column)
    X, y = prepare_training_frame(df, request.target_column, problem_type, request.excluded_columns)

    stratify = None
    if problem_type == "classification" and y.value_counts().min() >= 2:
        stratify = y

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    logs = [
        f"Loaded dataset {request.dataset_id} with {len(df)} rows.",
        f"Selected target '{request.target_column}' as {problem_type}.",
        f"Excluded columns: {', '.join(request.excluded_columns) if request.excluded_columns else 'none'}.",
        "Built preprocessing graph: median imputation, scaling, categorical one-hot encoding.",
        f"Created train/test split: {len(X_train)} train rows, {len(X_test)} validation rows.",
    ]
    for entry in logs:
        emit(entry, 10)

    trained_models: list[dict[str, Any]] = []
    candidates = candidate_models(problem_type)
    for index, (name, estimator, hyperparameters) in enumerate(candidates, start=1):
        start = time.perf_counter()
        pipeline = Pipeline(steps=[("preprocess", build_preprocessor(X_train)), ("model", estimator)])
        emit(f"[Training] {name}...", 15 + index * 18)
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        if problem_type == "classification":
            metric_payload = classification_metrics(y_test, predictions, pipeline, X_test)
        else:
            metric_payload = regression_metrics(y_test, predictions)

        metrics = {
            **metric_payload["metrics"],
            **run_cross_validation(pipeline, X_train, y_train, problem_type, request.validation_folds),
            "trainingTime": elapsed_ms,
        }

        model_id = f"model_{uuid.uuid4().hex[:12]}"
        model_path = MODEL_DIR / f"{model_id}.joblib"
        joblib.dump(pipeline, model_path)
        MODELS[model_id] = pipeline

        model_payload = {
            "id": model_id,
            "version": f"v{len(MODEL_META) + len(trained_models) + 1}.0.0",
            "createdAt": int(time.time() * 1000),
            "datasetId": request.dataset_id,
            "name": name,
            "type": problem_type,
            "status": "success",
            "metrics": metrics,
            "hyperparameters": hyperparameters,
            "confusionMatrix": metric_payload["confusionMatrix"],
            "rocData": metric_payload["rocData"],
            "featureImportance": feature_importance_payload(pipeline),
            "modelPath": str(model_path),
            "targetColumn": request.target_column,
            "featureColumns": X.columns.tolist(),
            "excludedColumns": request.excluded_columns,
            "validation": {
                "strategy": "holdout + cross_validation",
                "testSize": 0.2,
                "folds": metrics.get("cvFolds"),
            },
        }
        save_model_meta(model_payload)
        trained_models.append(model_payload)
        logs.append(f"[Finished] {name} in {elapsed_ms}ms.")
        emit(f"[Finished] {name} in {elapsed_ms}ms.", 15 + index * 22)

    score_key = "accuracy" if problem_type == "classification" else "r2"
    trained_models.sort(key=lambda model: model["metrics"].get(score_key, -1) or -1, reverse=True)
    logs.append(f"Best model: {trained_models[0]['name']}.")
    logs.append("Pipeline execution finished successfully.")
    emit(f"Best model: {trained_models[0]['name']}.", 95)
    emit("Pipeline execution finished successfully.", 100)
    return {"models": json_safe(trained_models), "logs": logs, "problemType": problem_type}


def create_job(payload: TrainRequest) -> dict[str, Any]:
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job = {
        "id": job_id,
        "createdAt": int(time.time() * 1000),
        "updatedAt": int(time.time() * 1000),
        "status": "queued",
        "progress": 0,
        "logs": ["Training job queued."],
        "request": payload.model_dump(),
        "result": None,
        "error": None,
    }
    JOB_EVENTS[job_id] = queue.Queue()
    save_job(job)
    return job


def publish_job_event(job_id: str, event: dict[str, Any]) -> None:
    if job_id in JOB_EVENTS:
        JOB_EVENTS[job_id].put(json_safe(event))


def update_job(job_id: str, status: JobStatus | None = None, progress: int | None = None, log: str | None = None, **extra: Any) -> None:
    with LOCK:
        job = JOBS[job_id]
        if status:
            job["status"] = status
        if progress is not None:
            job["progress"] = progress
        if log:
            job.setdefault("logs", []).append(log)
        job.update(extra)
        save_job(job)
        publish_job_event(job_id, job)


def run_training_job(job_id: str) -> None:
    request = TrainRequest(**JOBS[job_id]["request"])

    def log(message: str, progress: int | None = None) -> None:
        update_job(job_id, "running", progress, message)

    try:
        update_job(job_id, "running", 3, "Training job started.")
        result = train_models_core(request, log=log)
        update_job(job_id, "success", 100, "Training job completed.", result=result)
    except Exception as exc:
        update_job(job_id, "error", None, f"Training job failed: {exc}", error=str(exc))


@app.on_event("startup")
def startup() -> None:
    load_registry()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "engine": "FastAPI + pandas + scikit-learn",
        "datasets": len(DATASET_META),
        "models": len(MODEL_META),
        "jobs": len(JOBS),
    }


@app.get("/api/registry")
def registry() -> dict[str, Any]:
    return {
        "datasets": list(DATASET_META.values()),
        "models": list(MODEL_META.values()),
        "jobs": list(JOBS.values()),
    }


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    suffix = Path(file.filename or "").suffix.lower()
    try:
        if suffix == ".csv":
            df = pd.read_csv(file.file)
        elif suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(file.file)
        else:
            raise HTTPException(status_code=400, detail="Upload a CSV or Excel file")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse dataset: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")
    return dataframe_payload(df, file.filename or "dataset")


@app.post("/api/datasets/demo")
def create_demo_dataset() -> dict[str, Any]:
    X, y = make_classification(
        n_samples=600,
        n_features=6,
        n_informative=4,
        n_redundant=1,
        n_classes=2,
        random_state=42,
    )
    df = pd.DataFrame(X, columns=["usage_score", "recency", "monthly_spend", "support_tickets", "feature_depth", "team_size"])
    df["segment"] = np.where(df["monthly_spend"] > df["monthly_spend"].median(), "enterprise", "startup")
    df["is_active"] = np.where(y == 1, "YES", "NO")
    return dataframe_payload(df, "python_demo_customer_activity.csv")


@app.post("/api/models/train")
def train_models(request: TrainRequest) -> dict[str, Any]:
    return train_models_core(request)


@app.post("/api/models/train/jobs")
def start_training_job(request: TrainRequest) -> dict[str, Any]:
    job = create_job(request)
    thread = threading.Thread(target=run_training_job, args=(job["id"],), daemon=True)
    thread.start()
    return job


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return json_safe(job)


@app.get("/api/jobs/{job_id}/events")
def job_events(job_id: str) -> StreamingResponse:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    def event_stream():
        yield f"data: {json.dumps(json_safe(JOBS[job_id]))}\n\n"
        event_queue = JOB_EVENTS.setdefault(job_id, queue.Queue())
        while True:
            try:
                event = event_queue.get(timeout=15)
                yield f"data: {json.dumps(json_safe(event))}\n\n"
                if event.get("status") in {"success", "error"}:
                    break
            except queue.Empty:
                yield ": keep-alive\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/models/{model_id}")
def model_details(model_id: str) -> dict[str, Any]:
    model_meta = MODEL_META.get(model_id)
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")
    return json_safe(model_meta)


@app.post("/api/models/predict")
def predict(request: PredictRequest) -> dict[str, Any]:
    model_meta, pipeline = load_model_pipeline(request.model_id)

    feature_columns = model_meta["featureColumns"]
    row = {column: request.features.get(column) for column in feature_columns}
    frame = pd.DataFrame([row])

    start = time.perf_counter()
    prediction = pipeline.predict(frame)[0]
    latency_ms = int((time.perf_counter() - start) * 1000)

    response: dict[str, Any] = {
        "modelId": request.model_id,
        "target": model_meta["targetColumn"],
        "prediction": json_safe(prediction),
        "latencyMs": latency_ms,
    }

    estimator = pipeline.named_steps["model"]
    if model_meta["type"] == "classification" and hasattr(estimator, "predict_proba"):
        probabilities = pipeline.predict_proba(frame)[0]
        response["confidence"] = float(np.max(probabilities))
    return json_safe(response)


@app.post("/api/models/{model_id}/batch-predict")
async def batch_predict(model_id: str, file: UploadFile = File(...)) -> Response:
    model_meta, pipeline = load_model_pipeline(model_id)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix == ".csv":
        df = pd.read_csv(file.file)
    elif suffix in {".xlsx", ".xls"}:
        df = pd.read_excel(file.file)
    else:
        raise HTTPException(status_code=400, detail="Upload a CSV or Excel file")

    missing_columns = [column for column in model_meta["featureColumns"] if column not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing feature columns: {', '.join(missing_columns)}")

    features = df[model_meta["featureColumns"]]
    df = df.copy()
    df["prediction"] = pipeline.predict(features)
    estimator = pipeline.named_steps["model"]
    if model_meta["type"] == "classification" and hasattr(estimator, "predict_proba"):
        df["confidence"] = np.max(pipeline.predict_proba(features), axis=1)
    df["model_id"] = model_id
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    filename = f"scored_{Path(file.filename or 'batch').stem}_{model_id}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/models/{model_id}/export")
def export_model_pickle(model_id: str) -> FileResponse:
    model_meta, pipeline = load_model_pipeline(model_id)
    if model_meta.get("status") != "success":
        raise HTTPException(status_code=409, detail="Only successfully validated models can be exported")

    filename = export_filename(model_meta)
    export_path = EXPORT_DIR / filename
    with export_path.open("wb") as file:
        pickle.dump(pipeline, file, protocol=pickle.HIGHEST_PROTOCOL)

    return FileResponse(path=export_path, filename=filename, media_type="application/octet-stream")


@app.get("/api/models/{model_id}/export-bundle")
def export_model_bundle(model_id: str) -> FileResponse:
    model_meta, pipeline = load_model_pipeline(model_id)
    if model_meta.get("status") != "success":
        raise HTTPException(status_code=409, detail="Only successfully validated models can be exported")

    bundle_name = export_filename(model_meta, "zip")
    bundle_path = EXPORT_DIR / bundle_name
    model_bytes = pickle.dumps(pipeline, protocol=pickle.HIGHEST_PROTOCOL)
    requirements_path = ROOT_DIR / "requirements.txt"
    requirements = requirements_path.read_text() if requirements_path.exists() else "pandas\nscikit-learn\njoblib\n"
    inference_example = f'''import pickle
import pandas as pd

with open("model.pkl", "rb") as file:
    model = pickle.load(file)

features = {model_meta["featureColumns"]!r}
row = {{feature: None for feature in features}}
frame = pd.DataFrame([row])
print(model.predict(frame))
'''

    with zipfile.ZipFile(bundle_path, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("model.pkl", model_bytes)
        bundle.writestr("metadata.json", json.dumps(json_safe(model_meta), indent=2))
        bundle.writestr("requirements.txt", requirements)
        bundle.writestr("inference_example.py", inference_example)

    return FileResponse(path=bundle_path, filename=bundle_name, media_type="application/zip")
