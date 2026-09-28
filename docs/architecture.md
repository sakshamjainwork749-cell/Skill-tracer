# SkillTrace architecture

## 1. System context

SkillTrace sits between skilling providers, trainees, employers, and Maharashtra policy teams.

```text
Trainee consent + outcome updates
              │
              ▼
        FastAPI / RBAC
              │
     ┌────────┼─────────┐
     ▼        ▼         ▼
PostgreSQL  Rule engine  Policy summary
     │        │         │
     └────────┴─────────┘
              │
              ▼
      Next.js role portals
```

A trainee can see their own passport. An employer can see only reports for their organization after the trainee has granted verification consent. A government administrator sees de-identified aggregates and access is audited. Aggregate analytics are intentionally available only to the government-admin role.

## 2. Longitudinal outcome model

A training enrollment represents supply. Employment records represent the latest reported livelihood state. Follow-ups provide dated retention signals, and verification records independently confirm reported employment facts.

The lifecycle is intentionally not a single mutable “placed” flag:

1. `training_enrollments` records enrollment, completion, and assessment.
2. `employment_records` represents a current or historical outcome.
3. `followups` captures 3-, 6-, and 12-month observations and structured attrition; the dashboard funnel reports the 12-month retention stage while the headline KPI uses the 6-month cohort rate.
4. `verification_records` adds employer confirmation and skill-alignment feedback.
5. Evidence references and audit records preserve provenance.

This avoids losing a learner’s journey when employment changes.

## 3. API boundaries

All versioned routes use `/api/v1` and return successful domain data inside `{ "success": true, "data": ... }`.

### Authentication

- `POST /auth/login`
- `GET /auth/me`

JWT claims include the user ID and role. FastAPI dependencies enforce `TRAINEE`, `EMPLOYER`, or `GOVERNMENT_ADMIN`; aggregate government analytics are restricted to `GOVERNMENT_ADMIN`.

### Trainee

- `GET /trainees/me/passport`
- `POST /trainees/me/outcomes`
- `POST /trainees/me/proofs` (when implemented as a separate upload boundary)

The conditional outcome schema allows only fields relevant to the selected status. A new outcome creates a follow-up, updates the current employment record, schedules the next follow-up, and writes an audit event.

### Employer

- `GET /employer/verification-queue`
- `PATCH /employer/verifications/{employment_id}`

The employer route checks both RBAC and organization ownership before exposing a record.

### Analytics

- `GET /analytics/overview`
- `GET /analytics/districts`
- `GET /analytics/funnel`
- `GET /analytics/skill-gaps`
- `GET /analytics/attrition`
- `GET /analytics/insights`

The server computes aggregates from domain records. The web client can use deterministic fixtures for disconnected review, but connected mode never merges fixture values into measured API values.

## 4. Scoring

### Outcome confidence

| Evidence | Confidence |
| --- | ---: |
| Self-reported outcome only | 60% |
| Self-report plus accepted proof | 95% |
| Self-report plus employer verification | 95% |

Proof and employer verification are independent corroboration channels. The score communicates evidence quality, not whether an employment claim is true with mathematical certainty.

### Skill relevance

The score is based on employer-reported alignment between the course and actual job requirements, with a conservative seeded/default value for unreviewed records. The UI labels the value and its source so a modelled score is not confused with an employer rating.

### Outcome risk

A rule engine combines:

- pending or missing employer confirmation;
- days since the latest trainee response;
- low starting wage band;
- low job/course relevance;
- structured exit reason where applicable.

The result is categorical (`LOW`, `MEDIUM`, or `HIGH`) and accompanied by the contributing reasons. It is an operational follow-up signal, not a diagnosis or a judgement about a person.

## 5. Skill-gap calculation

For each sector, the system compares normalized skill labels in:

- `courses.required_skills` (supply taught);
- `job_postings_demand.required_skills_list` (employer demand signals).

A positive gap means demand exceeds taught supply. A negative gap means supply exceeds observed demand. A ratio is included only where supply is non-zero. The dashboard presents sector, sample size, and source context so policymakers can distinguish an evidence gap from a true market shortage.

## 6. Privacy and consent

Prototype controls:

- explicit consent state on the trainee record;
- scoped employer access through `employer_id` ownership;
- role-scoped APIs;
- append-only audit events for sensitive actions;
- aggregate government views;
- minimal visible employer information;
- evidence separation from analytics queries.

Production additions should include consent version/history, withdrawal and deletion workflows, field-level disclosure, data-retention schedules, encryption at rest and in transit, access-review tooling, and a DPDP Act compliance review.

## 7. Deployment topology

Docker Compose runs:

- PostgreSQL 16;
- FastAPI/Uvicorn;
- Next.js;

with persistent volumes for database state and proof uploads.

For production, the API should run behind TLS with a managed PostgreSQL instance, object storage for evidence, a queue for exports/follow-ups, centralized observability, encrypted backups, and a separate LLM gateway. Generated policy prose must receive only aggregate, validated metrics and must retain evidence references.
