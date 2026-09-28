# SkillTrace FastAPI Backend

Production-oriented prototype backend for trainee outcome traceability, employer verification, and Maharashtra skilling analytics.

## Stack

- Python 3.11+
- FastAPI + Pydantic v2
- SQLAlchemy 2
- PostgreSQL (`postgresql+psycopg`) or zero-config SQLite
- Alembic
- JWT bearer authentication and role-based access control
- PyJWT + Argon2 password hashing
- pytest

## Quick start (SQLite)

```bash
cd /Users/mayank/Desktop/SIH/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # optional; defaults already work
uvicorn app.main:app --reload
```

Open:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- Health: <http://localhost:8000/health>

On an empty database, startup creates the schema and inserts deterministic demo data. The default database is `skilltrace.db` in the backend directory. Seeding runs only when the user table is empty.

To reseed explicitly:

```bash
python -m app.db.seed --reset
```

Set `AUTO_CREATE_TABLES=false` and `AUTO_SEED_DEMO=false` in production if schema management is handled by Alembic.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Trainee | `trainee@skilltrace.in` | `Demo@123` |
| Employer | `employer@skilltrace.in` | `Demo@123` |
| Government admin | `admin@skilltrace.in` | `Demo@123` |

The same credentials are also listed in the OpenAPI description. Additional seeded employer accounts follow `employer1@skilltrace.in`, `employer2@skilltrace.in`, etc. and use `Demo@123` for prototype testing.

The primary trainee has a complete, verified CNC manufacturing journey: completed training, proof, employment, employer confirmation, feedback, wage, follow-ups, and wage progression. The demo employer has a populated verification queue.

## Login example

```bash
curl -s http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"trainee@skilltrace.in","password":"Demo@123"}'
```

Successful API responses use:

```json
{"success": true, "data": {}}
```

Errors use a string detail:

```json
{"detail": "Error message"}
```

## API endpoints

All application endpoints are under `/api/v1`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | JSON login; returns JWT and user |
| `GET` | `/auth/me` | Authenticated | Current user |
| `GET` | `/trainees/me/passport` | Trainee | Passport, training, outcome, confidence, relevance, risk, follow-up and wage history |
| `POST` | `/trainees/me/outcomes` | Trainee | Submit a conditional outcome record |
| `PATCH` | `/trainees/me/outcomes/{employment_id}` | Trainee | Correct/resubmit an owned outcome |
| `POST` | `/trainees/me/proofs` | Trainee | Multipart PDF/PNG/JPG proof upload |
| `GET` | `/employer/verification-queue` | Employer | Queue for the logged-in employer only |
| `PATCH` | `/employer/verifications/{employment_id}` | Employer | Verify/request correction, correct facts, rate and submit skill feedback |
| `GET` | `/analytics/overview` | Government admin | DB-derived totals, rates, median wage and 12-month trend |
| `GET` | `/analytics/districts` | Government admin | District totals, rates, risk and map coordinates |
| `GET` | `/analytics/funnel` | Government admin | Training-to-placement funnel |
| `GET` | `/analytics/skill-gaps` | Government admin | Sector demand compared with trained skill supply |
| `GET` | `/analytics/attrition` | Government admin | Exit-reason distribution |
| `GET` | `/analytics/insights` | Government admin | Data-backed operational insights |
| `GET` | `/health` | Public | Liveness response |

Analytics endpoints accept these optional filters:

- `period=30d`, `90d`, `12m`, etc.
- `district=Pune`
- `start_date=2026-01-01`
- `end_date=2026-09-30`

`period` is ignored when `start_date` is supplied. Explicit dates must be ordered.

### Outcome example

```json
{
  "outcome_type": "EMPLOYED",
  "role": "CNC Machine Operator",
  "company_name": "Sahyadri Precision Tools Pvt Ltd",
  "start_date": "2026-02-01",
  "wage_value": 28500,
  "wage_band": "₹20k–₹30k",
  "location": "Pune"
}
```

Conditional rules:

- `EMPLOYED` / `APPRENTICESHIP`: role, company, start date, and wage value or band; location is optional.
- `SELF_EMPLOYED`: role, business type, start date, and monthly revenue or employees created; location is optional.
- `SEEKING_JOB`: no employer details are required; an exit reason is optional context.

A submitted outcome resets employer verification, creates or updates a scheduled follow-up, and writes an audit record. If an owned uploaded proof ID is included, it is attached and marked verified for prototype confidence scoring.

### Proof upload

```bash
curl -s http://localhost:8000/api/v1/trainees/me/proofs \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@offer-letter.pdf;type=application/pdf' \
  -F 'description=Offer letter'
```

Allowed extensions are `.pdf`, `.png`, `.jpg`, and `.jpeg`. The API checks extension and file signature, generates a random server filename, limits size (5 MB by default, hard maximum 50 MB), hashes content, and never trusts a client path. Files are stored in `uploads/`.

### Employer verification example

```json
{
  "status": "Verified",
  "role": "CNC Machine Operator",
  "start_date": "2026-02-01",
  "wage_value": 29000,
  "rating": 5,
  "skill_alignment_feedback": {
    "overall_alignment": 5,
    "aligned_skills": ["CNC machining", "quality inspection"],
    "missing_skills": [],
    "additional_comments": "Strong practical performance."
  },
  "notes": "Employment facts confirmed."
}
```

Use `"Needs Correction"` to return a record to follow-up. Employers can only access and update records assigned to their own employer profile.

## Confidence and risk rules

Confidence is intentionally binary and exact:

- self report only: **60**
- self report plus retained proof, **or** verified employer record: **95**

The risk engine combines verification state, outcome staleness, wage versus district benchmark, and skill relevance to sector demand. District risk drivers are aggregated from those calculations; dashboard totals are never hardcoded.

## Database and migrations

The initial migration creates all required entities:

- users
- trainees
- courses
- training_enrollments
- employment_records
- verification_records
- followups
- job_postings_demand
- audit_logs
- proofs (supporting evidence entity)

All primary keys are UUIDs. Relationships use explicit cascade behavior, indexes cover common filters, and JSON fields use JSONB on PostgreSQL while remaining JSON on SQLite.

```bash
alembic upgrade head
alembic current
alembic check
```

For PostgreSQL:

```bash
createdb skilltrace
export DATABASE_URL='postgresql+psycopg://skilltrace:password@localhost:5432/skilltrace'
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload
```

Change `JWT_SECRET` to a long random secret outside development.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
ruff check app tests alembic
mypy app --ignore-missing-imports --check-untyped-defs
```

Tests use a dedicated SQLite database and cover authentication, RBAC, employer ownership, outcome validation and proof handling, seeded analytics, the district filter, confidence invariants, and risk calculations.

## Configuration

See `.env.example`. Important settings include:

- `DATABASE_URL`
- `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CORS_ORIGINS` (localhost frontend URLs are included by default)
- `UPLOAD_DIR`, `MAX_UPLOAD_SIZE`
- `AUTO_CREATE_TABLES`, `AUTO_SEED_DEMO`
- `PROVINCE`
