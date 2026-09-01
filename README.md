# Unified Enterprise AI Analytics Platform

> Production-style enterprise analytics platform with real-time data simulation, ML pipelines, anomaly detection, forecasting, and an AI copilot — all runnable locally in under 5 minutes.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react)](https://react.dev)
[![SQLite](https://img.shields.io/badge/DB-SQLite%20%28local%29-003B57?logo=sqlite)](https://sqlite.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## ✨ Feature Highlights

| Feature | Description |
|---|---|
| **📊 Analytics Overview** | Revenue, customers, churn, AOV KPIs with period filters (7d/30d/90d/1Y) |
| **🚨 Anomaly Detection** | 10 realistic anomalies with Z-score scatter chart, severity filters, AI root cause analysis |
| **📈 Forecasting** | 90-day projections for Revenue/Events/API/Churn with confidence bands |
| **🤖 AI Copilot** | SSE-streaming chat grounded on the platform dataset; fallback mode if no LLM key |
| **🌊 Real-Time Streaming** | Simulated Kafka events, live throughput chart updating every 2 s |
| **🧠 ML Lifecycle** | Train/predict/explain/delete sklearn models with MLflow tracking |
| **📁 Dataset Upload** | CSV/Excel/JSON upload with automatic profiling (schema, stats, PCA) |
| **📋 Reports** | Generate + schedule reports in PDF/Excel/HTML/JSON formats |
| **🔭 Monitoring** | Platform health, infrastructure nodes, model drift, alert management |
| **🔐 Auth & RBAC** | JWT + refresh tokens, Admin/Analyst/Viewer roles |

---

## 🚀 Quick Start (Local Dev — No Docker Required)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template (defaults work for SQLite local dev)
cp .env.example .env

# Start API server
uvicorn app.main:app --reload --port 8000
```

**API Docs available at:** `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

**App available at:** `http://localhost:5173`

### Default Login

Register a new account at `/register`, or use these if you've seeded a user:
```
Email:    admin@enterprise.ai
Password: Admin1234!
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 19)                   │
│  Dashboard · Analytics · Anomaly · Forecast · AI Chat   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI Backend  /api/v1/*                  │
│                                                          │
│  /auth          JWT + RBAC                               │
│  /analytics     KPIs, timeseries, segments, products     │
│  /anomalies     Detection, summary, AI explain           │
│  /forecast      Projections with confidence bands        │
│  /ai            SSE chat/stream + provider layer         │
│  /ml            Train, predict, explain (sklearn)        │
│  /datasets      Upload, profile, PCA, preview            │
│  /monitoring    Nodes, health, drift, alerts             │
│  /reports       Generate + schedule                      │
│  /streaming     Mock Kafka event feed                    │
│  /spark         Job simulation                           │
│  /realtime      WebSocket notifications                  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Data Layer (local dev)                                  │
│  SQLite (users, datasets)  ·  Pickle models  ·  MLflow  │
└─────────────────────────────────────────────────────────┘

Future integrations (plug in via env vars):
  Kafka · Spark · PostgreSQL · Redis · MongoDB
  OpenAI · Gemini · Claude · Ollama
```

---

## 📋 Demo Flows

1. **Login** → Register at `/register` → Login → auto-redirects to Dashboard

2. **Streaming Simulation** → `/streaming` → Live chart updates every 2 s with mock Kafka events

3. **Business Analytics** → `/analytics` → Period filter → Revenue trend + Top Products + Region breakdown

4. **Anomaly Detection** → `/anomaly` → Filter by severity → Click any row → AI root cause panel loads

5. **Forecasting** → `/forecast` → Select metric + horizon → 90-day chart with confidence bands

6. **AI Chat** → `/ai-assistant` → Ask: *"What are the revenue trends?"* → Streamed, grounded response

7. **ML Lifecycle** → `/dataset-upload` → Upload CSV → `/training` → Train model → `/predictions` → Predict

8. **Reports** → `/reports` → Fill form → Generate → See in table (download returns JSON payload)

---

## ⚙️ Environment Variables

Create `backend/.env` (defaults in `.env.example` work for local dev):

```ini
# Core
APP_NAME=Unified Enterprise AI Analytics Platform API
ENVIRONMENT=development             # development | staging | production
SECRET_KEY=change-me-in-production  # REQUIRED in production
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:5174

# Database (default: SQLite, drop-in for PostgreSQL)
DATABASE_URL=sqlite:///./app.db
# DATABASE_URL=postgresql://user:pass@localhost:5432/unified_ai_platform

# Optional services (leave blank to use mocks)
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://localhost:27017

# AI Providers (all disabled by default — use mock mode)
ENABLE_OPENAI=false
OPENAI_API_KEY=

ENABLE_GEMINI=false
GEMINI_API_KEY=

ENABLE_CLAUDE=false
CLAUDE_API_KEY=

ENABLE_OLLAMA=false
OLLAMA_BASE_URL=http://localhost:11434
```

### Frontend env (optional)

Create `frontend/.env`:
```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 🐳 Docker Compose (Full Stack)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/docs |
| MLflow | http://localhost:5000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |

---

## 🔧 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Apache ECharts, Framer Motion, React Query, Zustand, React Hook Form + Zod |
| **Backend** | FastAPI, SQLAlchemy, Alembic, Pydantic v2, JWT (python-jose), bcrypt |
| **ML / Data** | scikit-learn, MLflow, pandas, numpy |
| **Infrastructure** | Docker Compose, Nginx, Prometheus, Grafana |
| **Future** | Kafka, Spark, PostgreSQL, Redis, MongoDB, Airflow |

---

## 🗂️ Project Structure

```
Project-1-/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/    # All API endpoints
│   │   │   ├── analytics.py  # KPI, timeseries, segments
│   │   │   ├── anomaly.py    # Anomaly detection + explain
│   │   │   ├── forecast.py   # Time-series forecasting
│   │   │   ├── ai.py         # Chat stream + provider layer
│   │   │   ├── ml.py         # Train/predict/explain
│   │   │   ├── datasets.py   # Upload/profile/preview
│   │   │   ├── monitoring.py # Health/nodes/drift/alerts
│   │   │   └── ...
│   │   ├── core/             # Config, DB, security, deps
│   │   ├── services/         # Business logic (ML, AI, profiling)
│   │   └── models/           # SQLAlchemy ORM models
│   ├── uploads/              # Dataset files (gitignored)
│   ├── models/               # Trained ML models (gitignored)
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── ui/
│       │   ├── layout/AppShell.tsx   # Collapsible sidebar, mobile nav
│       │   ├── pages/                # 25 page components
│       │   │   ├── AnalyticsPage.tsx # Business KPI dashboard
│       │   │   ├── AnomalyPage.tsx   # Anomaly detection
│       │   │   ├── ForecastPage.tsx  # Forecasting projections
│       │   │   └── AIAssistantPage.tsx # Streaming chat
│       │   ├── lib/api.ts            # Axios client with auth
│       │   └── state/authStore.ts    # Zustand auth state
│       └── index.css                 # Full design system
│
├── infra/                    # Nginx, Prometheus, Grafana configs
├── docs/                     # Architecture docs
└── docker-compose.yml
```

---

## 🔒 Security

- Passwords hashed with bcrypt
- JWT access tokens (30 min) + refresh tokens (7 days)
- RBAC: `Admin`, `Analyst`, `Viewer` roles enforced per endpoint
- Secure HTTP headers middleware
- CORS allowlist from `FRONTEND_ORIGINS` env var
- All secrets via environment variables — never hardcoded
- Input validation: Pydantic (backend) + Zod (frontend)

---

## 🗺️ Roadmap

- [ ] Real Kafka consumer + producer integration
- [ ] Spark job submission via REST API
- [ ] PostgreSQL as default (currently SQLite for zero-setup local dev)
- [ ] OpenAI / Gemini / Claude real chat integration
- [ ] SHAP/LIME explainability endpoints
- [ ] PDF report export (reportlab)
- [ ] Kubernetes manifests + Helm chart
- [ ] GitHub Actions CI/CD pipeline
- [ ] E2E tests (Playwright)

---

## 📝 License

MIT — see [LICENSE](LICENSE) for details.
