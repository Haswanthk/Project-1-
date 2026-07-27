# Unified Enterprise AI Analytics Platform

Production-grade enterprise analytics platform with modular AI layer, big data processing, ML pipelines, and MLOps-ready architecture.

## Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Apache ECharts, React Query, Zustand, React Hook Form
- Backend: FastAPI, SQLAlchemy, Alembic, Pydantic, JWT Auth, RBAC
- Data/ML: Spark, Kafka, PostgreSQL, MongoDB, Redis, scikit-learn, XGBoost, LightGBM, MLflow
- Infra: Docker Compose, Nginx, Prometheus, Grafana, Airflow

## Monorepo Structure
- `frontend/` React enterprise UI shell and pages
- `backend/` API, business logic, auth, profiling, ML, AI placeholder layer
- `infra/` Nginx, Prometheus, Grafana, Airflow configs
- `.github/workflows/` CI pipeline

## Backend Features
- JWT + Refresh Token
- RBAC (`Admin`, `Analyst`, `Viewer`)
- Register, login, forgot/reset password, email verification, profile, session management
- Dataset upload (CSV/Excel/JSON) + automatic profiling
- ML training and prediction APIs (MLflow tracked)
- WebSocket notifications
- AI and RAG endpoints as provider-agnostic placeholders

## AI Provider Layer
Providers are implemented as interfaces and disabled by default:
- OpenAI, Gemini, Claude, DeepSeek, Groq, OpenRouter, Ollama, Local Llama

Enable in `.env` by setting `ENABLE_*` flags and corresponding keys/endpoints.

## Run with Docker
```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000/docs`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- MLflow: `http://localhost:5000`

## Local Development

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Optional full big-data/tooling extras:
```bash
pip install -r requirements-extended.txt
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## Security Baseline
- Secure headers middleware
- Password hashing with bcrypt
- Input validation with Pydantic and Zod
- RBAC authorization checks
- CORS allowlist from env

## Roadmap Remaining
- Expand profiling visualization APIs (PCA/feature importance endpoints)
- Full SQL/REST/Kafka/IoT connectors
- Advanced AutoML and explainability (SHAP/LIME) service endpoints
- Report exports (PDF/Excel/Word/PPT) and scheduling engine
- Kubernetes manifests and cloud deployment modules
