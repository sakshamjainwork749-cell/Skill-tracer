# SkillTrace

**Maharashtra Skill Outcome & Livelihood Intelligence Platform**

SkillTrace is a consent-based, longitudinal skilling intelligence prototype that follows a learner beyond certification:

> Training → Certification → Outcome → Employer verification → 3/6/12-month retention → Wage progression → Skill-gap policy feedback

The repository contains a Next.js experience layer and a FastAPI analytics/API layer backed by SQLAlchemy and PostgreSQL. It is designed to run locally with either PostgreSQL (Docker Compose) or a zero-configuration SQLite database.

## Product experiences

| Experience | Route | Purpose |
| --- | --- | --- |
| Public landing | `/` | Explain the outcome journey and provide role-based entry |
| Trainee passport | `/trainee/dashboard` | Review the interactive journey, Outcome Passport, retention, and wage progression |
| Trainee update | `/trainee/update` | Complete the low-burden four-step employment status update |
| Employer queue | `/employer/dashboard` | Review trainee-reported employment verification requests |
| Employer verification | `/employer/verify/[id]` | Confirm or correct a reported outcome and rate skill relevance |
| Government dashboard | `/admin` | Explore district, funnel, trend, attrition, wage, and skill-gap analytics |
| Demo access | `/login` | Enter as a trainee, employer, or administrator |

The frontend includes realistic demo-mode data if the API is not running, so every interface can be reviewed immediately. When the backend is available, API responses replace the demo data.

## Architecture

```text
SkillTrace/
├── backend/                 FastAPI, SQLAlchemy, Pydantic, Alembic, analytics
│   ├── app/                 API, domain models, schemas, security, services
│   ├── alembic/             Database migrations
│   ├── tests/               API and analytics tests
│   └── seed.py              Deterministic Maharashtra demo dataset
├── frontend/                Next.js App Router, TypeScript, Tailwind, Recharts
│   ├── app/                 Landing and role-based product experiences
│   ├── components/          Shared UI, charts, maps, dialogs
│   └── lib/                 Typed API client, demo fixtures, auth state
├── docker-compose.yml       PostgreSQL + API + web app
└── Makefile                 Common local commands
```

### Analytics principles

- **Outcome confidence:** self-reported only = 60%; proof supplied or employer-verified = 95%.
- **Risk engine:** combines verification state, update staleness, wage band, and training/job relevance.
- **Retention:** 3-, 6-, and 12-month signals are tied to dated follow-ups rather than inferred from training completion.
- **Skill gaps:** employer demand signals are compared with skills taught by sector. Every insight includes evidence and a policy action; the UI does not present generated claims as measured facts.
- **Consent:** trainees explicitly authorize follow-up and employer verification. A provider sees only information covered by the relevant consent.

## Quick start with Docker Compose

Requirements: Docker Desktop or Docker Engine with Compose.

```bash
docker compose up --build
```

Then open:

- Web app: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

PostgreSQL data and uploaded proof files are persisted in named Docker volumes. The web image uses Next.js standalone output, and the API health check gates frontend startup.

> Docker was not installed in the authoring environment, so the Compose stack is configuration-validated but was not executed here. The backend and frontend were each run and validated directly instead.

## Local development

### 1. Backend

Python 3.11 or newer is recommended.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

The default development database is SQLite when `DATABASE_URL` is not set. To use PostgreSQL directly, set:

```dotenv
DATABASE_URL=postgresql+psycopg://skilltrace:skilltrace@localhost:5432/skilltrace
```

and apply the migration:

```bash
alembic upgrade head
```

### 2. Frontend

Node.js 20 or newer is recommended.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. The default API URL is `http://localhost:8000/api/v1`.

## Demo accounts

| Role | Email | Password | Experience |
| --- | --- | --- | --- |
| Trainee | `trainee@skilltrace.in` | `Demo@123` | Passport and 4-step outcome update |
| Employer | `employer@skilltrace.in` | `Demo@123` | Verification queue and feedback |
| Government admin | `admin@skilltrace.in` | `Demo@123` | District and course intelligence |

The seed contains at least 60 synthetic trainees across Pune, Nashik, Gadchiroli, Mumbai, and Chhatrapati Sambhajinagar, plus employers, courses, outcomes, follow-ups, verification states, wage bands, and employer demand signals. All people and organizations in the seed are fictional.

## Suggested evaluation journey

1. Open **Trainee → Outcome Passport** (`/trainee/dashboard`) and review the journey, confidence, and status-update prompt.
2. Open **Update employment status** (`/trainee/update`) to report a new outcome and optionally attach proof.
3. Switch to **Demo as Employer** and open a request from the verification queue.
4. Confirm or flag the record, add a performance rating, and submit skill-relevance feedback.
5. Open **Demo as Government Admin** (`/admin`) to explore district, funnel, trend, attrition, and skill-gap metrics.

## Useful commands

```bash
make setup       # Install both applications
make backend     # Start API with reload
make frontend    # Start Next.js
make test        # Run backend tests and frontend lint
make build       # Compile backend and build frontend
```

Individual frontend checks are also available:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Individual backend checks:

```bash
cd backend
.venv/bin/pytest -q
.venv/bin/ruff check app tests alembic seed.py
.venv/bin/mypy app --ignore-missing-imports --check-untyped-defs
.venv/bin/alembic upgrade head
.venv/bin/alembic check
```

See `backend/README.md` and `frontend/README.md` for implementation-specific configuration, API routes, and commands.

## Prototype boundaries

- Password authentication and role checks are functional, but production deployment should add short-lived access/refresh tokens, MFA for administrators, rate limiting, and an external identity provider.
- Proof uploads are local development storage. Production should use encrypted object storage, malware scanning, signed URLs, retention policies, and per-document consent.
- Aggregate demand signals in the seed are synthetic and illustrative; they are not a claim about current Maharashtra labour-market conditions.
- Natural-language policy cards are rule-grounded summaries over the same metrics shown in the dashboard. A production LLM integration must retain citations, validation, and a no-invention guardrail.
- The app is an outcome measurement prototype, not an official Maharashtra government service or a substitute for statutory employment records.
- The dashboard funnel reports 12-month retention because the requested journey calls that stage out explicitly; the headline retention KPI remains the six-month rate.
- The district map is a schematic, clickable representation of five representative districts rather than a full geospatial boundary layer.
