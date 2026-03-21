# Architecture

## Overview

LoadLevel is a single-page app (SPA) with no build step — vanilla HTML/CSS/JS served statically. All state lives in Firestore with real-time `onSnapshot` listeners for instant multi-user sync.

**External dependencies (CDN):** Firebase SDK, Chart.js, jsPDF + AutoTable (PDF export), SheetJS (Excel export).

## File Dependency Graph

```
index.html
  ├── styles.css          (all styling)
  ├── logger.js           (loaded first — logging & observability)
  │   └── Logger          — structured logging, ring buffer, global error handlers
  ├── db.js               (loaded second — Firestore data layer)
  │   ├── FirestoreStore   — org-scoped CRUD with real-time listeners
  │   ├── UserManager      — per-org role management
  │   └── _getSampleSurveys() — 27 IQMH sample surveys factory
  ├── auth.js             (loaded third — Firebase init + auth)
  │   ├── firebase config + init
  │   ├── Roles            — permission check functions
  │   └── Auth             — sign-in flow, org selection, role resolution
  ├── app.js              (loaded fourth — Store + Scoring)
  │   ├── Store            — thin async wrapper around FirestoreStore
  │   ├── CATEGORIES       — 6 scoring dimension names
  │   └── Scoring          — pure scoring math (no side effects)
  └── ui.js               (loaded last — all UI logic)
      ├── Modal, Toast, Navigation
      ├── renderDashboard, renderStaffTable, renderSurveysTable
      ├── renderAssignments, What-If Simulator
      ├── renderOrgPicker, renderOrgManagement
      ├── renderUserManagement, renderSettings
      └── applyRoleRestrictions
```

## Data Flow

```
User Action (click, slider, etc.)
  → ui.js (event handler)
    → Store.addSurvey(data)          [app.js — async wrapper]
      → FirestoreStore.addSurvey()   [db.js — writes to Firestore]
        → Firestore cloud
          → onSnapshot listener fires [db.js — real-time]
            → callback: refreshCurrentPanel()  [ui.js — re-renders]
```

## Authentication Flow

```
1. User visits site → login-gate shown
2. Signs in via Email/Password OR Google
3. auth.onAuthStateChanged fires
4. UserManager.seedSuperAdmin() — first user ever becomes Super Admin
5. UserManager.loadUser(email) — loads /users/{email} doc
6. Check: Super Admin? → access granted
   Check: Has orgs? → access granted, load first org
   Neither? → "Access Denied"
7. FirestoreStore.loadOrg(orgId) — subscribes to org's data
8. applyRoleRestrictions() — gates UI by role
9. renderDashboard() — shows data
```

## Scoring Engine

The scoring engine in `app.js` is **pure** — it reads from `Store.surveys/staff/assignments/weights` but never writes. All 6 dimensions return a 0–100 score:

| Dimension | Key Input Fields | Formula Style |
|-----------|-----------------|---------------|
| Analyte Volume | analytes × challenges × rounds | Volume product / max |
| Participant Load | participants, jurisdictions, inquiryRate, correctiveActions | Weighted average (35/25/20/20) |
| Grading Complexity | peerGroups, gradingMethod, surveyType, expertPanel | Weighted + type multiplier |
| Material & Shipping | shipmentsPerYear, coldChain, slidePrep | Base + boolean bonuses |
| Regulatory & Reporting | accreditationBodies, reportComplexity, remediationRate, regChangeFreq | Weighted average |
| Committee Work | committeeMeetings, consensusRounds, educational | Weighted + boolean bonus |

Final score = weighted sum of all 6 dimensions (weights configurable via Settings).

## Multi-Tenancy Design

- Each organization is a top-level Firestore document with subcollections
- Users have a `/users/{email}` doc with an `organizations` array: `[{orgId, role}]`
- Super Admins are tracked in a separate `/superAdmins/{email}` collection
- Each org has an `auditLog` subcollection for immutable activity tracking
- Each org has a `snapshots` subcollection for historical workload captures
- The org picker in the sidebar lets users switch between their orgs
- Switching orgs unsubscribes old listeners and subscribes to the new org's data

## Key Design Decisions

1. **No framework** — Chosen for simplicity and zero build step. The app fits in 7 files.
2. **Firestore over Realtime DB** — Needed structured queries and subcollections for multi-tenancy.
3. **Client-side role enforcement** — Roles are checked in UI JS. Firestore rules provide auth-level security. A future improvement would be Cloud Functions for server-side role enforcement in security rules.
4. **Real-time sync** — `onSnapshot` was chosen over polling so multiple users editing simultaneously see changes instantly.
5. **Assignments as a single doc** — The survey→staff mapping is stored as one Firestore doc rather than individual docs, since it's always read/written as a whole and keeps costs down.
6. **Client-side logging** — `Logger` uses an in-memory ring buffer (last 200 entries) rather than shipping logs to a backend. Sufficient for a small-team app; can be extended to write to Firestore or an external service later.

## Logging & Observability

`logger.js` is loaded before all other application scripts and provides:

- **Structured log entries** — Each entry has `{ timestamp, level, category, message, data, error, user, orgId }`
- **4 log levels** — `DEBUG`, `INFO`, `WARN`, `ERROR` with configurable minimum (default: `INFO`)
- **Global error handlers** — `window.onerror` and `unhandledrejection` catch uncaught errors
- **Ring buffer** — Last 200 entries accessible via `Logger.getRecentLogs()` in the dev console
- **Performance timing** — `Logger.time()` / `Logger.timeEnd()` for measuring Firestore operations
- **Context injection** — Current user email and org ID are attached to every log entry once known

Categories used: `init`, `auth`, `db`, `ui`, `perf`, `global`
