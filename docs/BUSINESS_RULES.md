# Business Rules — LoadLevel

> [!CAUTION]
> These rules are system invariants. Do NOT violate them without explicit user approval and updating this document.

## Scoring Model

| Rule | Description |
|------|-------------|
| **BR-S1** | There are exactly 6 scoring dimensions. Adding or removing a dimension requires updating: `CATEGORIES` in `app.js`, `Scoring.categoryScore()`, all weight sliders in `index.html`, `renderRadarChart()` in `ui.js`, and `defaultWeights()` in `db.js` |
| **BR-S2** | `Scoring.*` functions must be **pure** — no DOM access, no Firestore writes, no side effects |
| **BR-S3** | All 6 category weights must sum to 100%. The UI shows a warning if they don't |
| **BR-S4** | Survey scores are 0–100 per dimension. The final score is a weighted average |
| **BR-S5** | `surveyType` affects the grading complexity dimension: qualitative=1.0x, mixed=0.7x, quantitative=0.4x multiplier |

## Roles & Permissions

| Rule | Description |
|------|-------------|
| **BR-R1** | Four role levels: Super Admin > Org Admin > Editor > Viewer |
| **BR-R2** | Roles are **per-organization** (except Super Admin, which is global) |
| **BR-R3** | Viewers can view all panels and edit values on **existing** surveys only. They cannot create, delete, or change assignments |
| **BR-R4** | Editors can create/edit/delete surveys, staff, and assignments. They cannot manage users |
| **BR-R5** | Org Admins inherit Editor permissions plus can manage users within their org |
| **BR-R6** | Super Admins can do everything, including creating/deleting organizations |
| **BR-R7** | The first user to sign in is **automatically** seeded as Super Admin |
| **BR-R8** | Users cannot change their own role (prevents accidental self-lockout) |

## Data Model

| Rule | Description |
|------|-------------|
| **BR-D1** | All application data is organization-scoped (under `/organizations/{orgId}/`) |
| **BR-D2** | Survey, staff, and assignment data must **never** be stored in localStorage — Firestore only |
| **BR-D3** | When a staff member is deleted, all their survey assignments must be cleared |
| **BR-D4** | When a survey is deleted, its assignment must be removed |
| **BR-D5** | Assignments map is stored as a **single Firestore document** (not individual docs per assignment) |
| **BR-D6** | User profiles are stored at `/users/{email}` with an `organizations` array |
| **BR-D7** | Real-time listeners (`onSnapshot`) must be used for all org data collections |

## Authentication

| Rule | Description |
|------|-------------|
| **BR-A1** | Two auth methods supported: Email/Password and Google Sign-In |
| **BR-A2** | All authenticated users must have a `/users/{email}` doc to access the app |
| **BR-A3** | Super Admins always get access, regardless of org assignments |
| **BR-A4** | Regular users must be assigned to at least one organization to pass the login gate |

## UI/UX

| Rule | Description |
|------|-------------|
| **BR-U1** | Dark theme only. All new UI elements must use CSS variables from `styles.css` |
| **BR-U2** | Role-based UI gating uses `Roles.can*()` functions — buttons are hidden, not just disabled |
| **BR-U3** | All user-facing errors must show a toast notification, not a console error |
| **BR-U4** | The org picker only appears when the user has access to 2+ organizations |
| **BR-U5** | Survey type badges use consistent colors: Quant=blue, Qual=purple, Mixed=amber |
