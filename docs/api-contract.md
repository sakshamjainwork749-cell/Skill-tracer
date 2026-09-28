# SkillTrace API contract

Base URL: `http://localhost:8000/api/v1`

Successful responses use:

```json
{ "success": true, "data": {} }
```

Validation/authentication errors use FastAPI's `detail` field. Dates are ISO 8601 strings. Rates are numeric percentages where noted.

## Login

`POST /auth/login`

```json
{
  "email": "trainee@skilltrace.in",
  "password": "Demo@123"
}
```

Response data:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": "<uuid>",
    "role": "TRAINEE",
    "email": "trainee@skilltrace.in",
    "full_name": "Demo Trainee"
  }
}
```

Send subsequent requests as:

```text
Authorization: Bearer <jwt>
```

## Trainee passport

`GET /trainees/me/passport`

Key data fields:

- `trainee`: name, identifier, district, consent;
- `training`: course, provider, sector, hours, score, completion/certification;
- `current_outcome`: type, organization/role, dates, wage/revenue;
- `confidence_score` and `confidence_label`;
- `skill_relevance_score` and source;
- `risk_level` and `risk_reasons`;
- `retention`: current retention summary;
- `retention_milestones`: dated 3M, 6M, and 12M evidence markers;
- `wage_progression`: starting and current bands/values;
- `next_followup`, `proof_status`, and `last_updated`.

## Record an outcome

`POST /trainees/me/outcomes`

Employed/apprenticeship example:

```json
{
  "outcome_type": "EMPLOYED",
  "role": "Service Technician",
  "company_name": "Fictional Auto Systems",
  "start_date": "2026-09-01",
  "wage_value": 24000,
  "wage_band": "₹15k–25k",
  "location": "Pune"
}
```

Self-employment example:

```json
{
  "outcome_type": "SELF_EMPLOYED",
  "business_type": "Digital services",
  "monthly_revenue": 32000,
  "employees_created": 1,
  "location": "Nashik"
}
```

Seeking-work example:

```json
{
  "outcome_type": "SEEKING_JOB",
  "exit_reason": "WAGE_TOO_LOW",
  "location": "Gadchiroli"
}
```

## Employer queue

`GET /employer/verification-queue`

Each row includes trainee summary, course/pass year, reported employment facts, current verification status, confidence, and submission time.

`PATCH /employer/verifications/{employment_id}`

```json
{
  "status": "VERIFIED",
  "role": "Service Technician",
  "joining_date": "2026-09-01",
  "wage_band": "₹15k–25k",
  "employment_status": "ACTIVE",
  "feedback_rating": 4,
  "skill_relevance_score": 82,
  "feedback": {
    "training_alignment": "STRONG",
    "missing_skills": ["CAN communication"],
    "comment": "Electrical training matched the role; diagnostic software exposure would help."
  }
}
```

## Analytics

These routes require a `GOVERNMENT_ADMIN` bearer token.

- `GET /analytics/overview`
- `GET /analytics/districts`
- `GET /analytics/funnel`
- `GET /analytics/skill-gaps`
- `GET /analytics/attrition`
- `GET /analytics/insights`

Optional common query parameters are `period` (for example `6m`, `12m`, or `all`) and `district`.

### Overview

```json
{
  "total_trained": 1200,
  "total_placed": 760,
  "employed_rate": 63.3,
  "retention_6m_rate": 71.2,
  "median_monthly_wage": 24000,
  "trend": 4.8,
  "province": "Maharashtra",
  "updated_at": "2026-09-25T10:00:00Z"
}
```

### Districts

```json
{
  "id": "pune",
  "name": "Pune",
  "trained": 340,
  "placed": 230,
  "employed_rate": 67.6,
  "retention_6m_rate": 76.0,
  "median_wage": 27000,
  "top_risk_drivers": ["Wage expectation mismatch"],
  "risk_level": "MEDIUM",
  "lat": 18.52,
  "lng": 73.86
}
```

### Funnel

```json
{
  "stages": [
    { "name": "Enrolled", "value": 1200, "percentage": 100 },
    { "name": "Completed", "value": 1050, "percentage": 87.5 },
    { "name": "Placed", "value": 760, "percentage": 63.3 },
    { "name": "Retained at 12 months", "value": 540, "percentage": 45 }
  ]
}
```

### Skill gaps

```json
{
  "sectors": [
    {
      "sector": "IT & Software",
      "skills": [
        { "skill": "AWS", "supply": 24, "demand": 43, "gap": 19, "ratio": 1.79 }
      ]
    }
  ]
}
```

### Attrition

```json
{
  "total": 86,
  "reasons": [
    { "reason": "Wage too low", "count": 24, "percentage": 27.9 }
  ]
}
```

### Policy insights

```json
{
  "insights": [
    {
      "id": "ev-nashik-wage",
      "severity": "HIGH",
      "title": "EV Technician placements show wage-exit risk",
      "summary": "Nashik EV Technician records have elevated wage-related exits relative to their placement volume.",
      "evidence": "24 of 31 wage-related exits follow EV Technician placements.",
      "recommendation": "Validate placement wage bands with employers and add a transparent compensation range to course counselling.",
      "metric": "77%",
      "sector": "Automotive",
      "district": "Nashik"
    }
  ]
}
```
