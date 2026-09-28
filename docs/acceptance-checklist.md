# SkillTrace prototype acceptance checklist

Use this checklist for final manual and automated verification.

## Public experience

- [ ] Landing page states **From Training to Real Outcomes** and frames the platform as an outcome intelligence layer.
- [ ] Distinct Trainee, Employer, and Government entry cards navigate to the correct role route.
- [ ] Privacy First, Multilingual Support, and Vision Alignment pillars are visible.
- [ ] English, मराठी, and हिंदी switch key interface copy.
- [ ] Four-stage journey is interactive: Training & Certification → Placement & Employment → Retention & Wage Growth → Skill Gap & Policy Insights.
- [ ] Layout is usable at 360 px, 768 px, and desktop widths.

## Trainee experience

- [ ] Passport displays training hours, certification, current status, employer/business when relevant, starting/current wage or revenue, 3M/6M/12M retention, confidence, and skill relevance.
- [ ] Update flow has four visible steps: status, conditional details, optional proof, success.
- [ ] Employed and Apprenticeship branches request role, company, start date, wage band, and location.
- [ ] Self-employed branch requests type/business, monthly revenue, and jobs created.
- [ ] Seeking Job branch requests a structured reason and location.
- [ ] Optional upload accepts a local document and communicates privacy/consent.
- [ ] Invalid/empty required fields produce accessible errors.
- [ ] Draft survives a page refresh through local storage.
- [ ] Submission produces a clear success state and next follow-up information.
- [ ] API-connected mode creates an employment record, follow-up, and audit event.

## Employer experience

- [ ] Queue shows trainee name, identifier, district, course, pass year, reported role/date/wage/status, and pending state.
- [ ] Search and status filters work.
- [ ] Selecting a row opens a modal or drawer with trainee and course summary.
- [ ] Employer can confirm/correct role, start date, wage band, and status.
- [ ] Employer can choose Verified or Needs Correction.
- [ ] 1–5 star relevance and structured feedback are supported.
- [ ] API mode prevents access to another employer's records.
- [ ] Status change appears optimistically in demo mode.

## Government dashboard

- [ ] Cards show Total Trained, Placed/Employed, Current Employment Rate, 6-Month Retention Rate, and Median Monthly Wage.
- [ ] District map/list supports Pune, Nashik, Gadchiroli, Mumbai, and Chhatrapati Sambhajinagar.
- [ ] Selected district reveals trained/placed totals, employment and retention rates, wage, and top risk drivers.
- [ ] Funnel contains Enrolled, Completed, Placed, and Retained at 12 months with values and percentages.
- [ ] Supply-versus-demand view contains sector gaps such as Docker/AWS.
- [ ] Attrition donut uses structured exit reasons and has an accessible text/table alternative.
- [ ] AI/policy cards separate evidence, summary, recommendation, metric, sector, and district.
- [ ] Last updated and methodology/confidence information are visible.
- [ ] Charts resize without clipping or overlapping labels.

## Data, API, and security

- [ ] SQLAlchemy models cover all nine requested entities and use explicit relationships.
- [ ] Alembic can create the complete PostgreSQL schema from empty state.
- [ ] Seed contains at least 60 synthetic trainees across all five focus districts.
- [ ] Seed creates multiple courses, sectors, employers, wage bands, outcome types, attrition reasons, follow-up dates, and verification states.
- [ ] Login works for all three demo roles and rejects invalid credentials.
- [ ] Trainee endpoints reject employer/admin access.
- [ ] Employer queue and patch enforce employer ownership.
- [ ] Analytics reject unauthenticated and non-government-admin access.
- [ ] Successful responses use `{ success: true, data }`.
- [ ] Self-report-only confidence is 60%.
- [ ] Proof or employer verification raises confidence to 95%.
- [ ] Outcome risk returns category and explainable reasons.
- [ ] Skill-gap calculation derives counts from course supply and demand data.
- [ ] Analytics responses are calculated from the database rather than fixed dashboard values.
- [ ] CORS permits the configured frontend origin.
- [ ] Uploads reject unsupported/oversized files and do not expose arbitrary paths.

## Quality and operations

- [ ] Backend tests pass.
- [ ] Frontend type-check, lint, and production build pass.
- [ ] API OpenAPI page loads at `/docs`.
- [ ] Health endpoint returns healthy status.
- [ ] Docker Compose starts PostgreSQL, API, and frontend from clean state.
- [ ] Demo is clearly labelled synthetic and does not imply official Maharashtra data.
- [ ] Prototype privacy limitations and production controls are documented.
