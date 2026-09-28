# SkillTrace Frontend

A polished, responsive Next.js prototype for tracing Maharashtra skilling outcomes—from verified training to employment, wage growth and retention.

## Included experiences

- `/` — multilingual public landing page with an interactive four-stage journey
- `/trainee` — mobile-first Outcome Passport and a validated four-step update wizard
- `/employer` — responsive verification queue with optimistic demo mutations
- `/dashboard` — government outcome intelligence with interactive district map and Recharts visualisations
- `/login` — trainee, employer and government role access with real API login and local fallback

Every route is usable without a backend. Rich fallback data is shown immediately and all demo interactions remain functional.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 3
- Lucide React
- Recharts (client-only chart loading)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production checks:

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

## Demo credentials

All roles use `Demo@123`.

| Role | Email | Destination |
| --- | --- | --- |
| Trainee | `trainee@skilltrace.in` | `/trainee` |
| Employer | `employer@skilltrace.in` | `/employer` |
| Government | `admin@skilltrace.in` | `/dashboard` |

Authentication first calls the backend. When the service is offline, matching demo credentials create a local session in `localStorage`.

## API configuration

Copy `.env.example` to `.env.local` if the API runs somewhere other than the default:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

`lib/api.ts` unwraps `{ success, data }`, normalises errors, attaches bearer tokens, applies a request timeout and supports `FormData` proof uploads. Expected endpoint shapes are documented by the typed methods in that file.

The frontend expects representative contracts for:

- `GET /analytics/overview`, `/analytics/districts`, `/analytics/funnel`
- `GET /analytics/skill-gaps`, `/analytics/attrition`, `/analytics/insights`
- `GET /trainees/me/passport`
- `POST /trainees/me/proofs` and `POST /trainees/me/outcomes`
- `GET /employer/verification-queue`
- `PATCH /employer/verifications/:id`
- `POST /auth/login`

## Demo persistence

- Auth session: `skilltrace.session.v1`
- Trainee outcome draft: `skilltrace.outcome-draft.v1`
- Employer queue mutations: `skilltrace.employer-queue.v1`

A live API response replaces fallback data when available. An offline response leaves the populated prototype in place and labels the active source.

## Accessibility and resilience

- Keyboard-accessible controls, modal focus trapping and Escape handling
- Visible focus states and reduced-motion support
- Screen-reader chart labels and expandable data tables
- Text alternatives for the illustrative district map
- Semantic tables, status text in addition to colour, and responsive layouts
- Error, loading and not-found boundaries

## Notes

The district map and all aggregate values are illustrative prototype data. It is designed as a decision-support interface, not a causal evaluation or official government publication.
