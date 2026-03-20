# LoadLevel — PT Survey Load Leveling Dashboard

A multi-tenant workload management tool for Proficiency Testing (PT) organizations, built for [IQMH](https://www.iqmh.org/) and similar programs.

**Live:** [pt-loadlevel.web.app](https://pt-loadlevel.web.app)

## What It Does

LoadLevel helps PT coordinators balance survey workload across staff by scoring each survey's complexity across 6 dimensions and visualizing the distribution. Managers can run "what-if" simulations to preview reassignment impact before committing.

## Key Features

- **6-Dimension IQMH Scoring Model**: Analyte Volume, Participant Load, Grading Complexity, Material & Shipping, Regulatory & Reporting, Committee Work
- **Survey Type Classification**: Quantitative / Qualitative / Mixed — affects grading complexity scoring
- **Real-time Firestore Backend**: All users see changes instantly via `onSnapshot` listeners
- **Multi-Tenant Organizations**: Each PT org gets isolated data; users can belong to multiple orgs
- **Role-Based Access Control (RBAC)**: Super Admin → Org Admin → Editor → Viewer
- **What-If Simulator**: Preview multiple reassignments before applying
- **Dual Authentication**: Email/password + Google Sign-In
- **Configurable Weights**: 6 adjustable weight sliders (must sum to 100%)

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **Charts**: Chart.js
- **Hosting**: Firebase Hosting

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown of the codebase.

## File Structure

```
├── index.html          # Main HTML — login gate, sidebar, all panels
├── auth.js             # Firebase Auth (email/password + Google), role definitions, org selection
├── db.js               # Firestore data layer — FirestoreStore (CRUD) + UserManager (per-org RBAC)
├── app.js              # Store wrapper + Scoring engine (pure math, no storage)
├── ui.js               # All UI rendering, modals, what-if simulator, settings, org management
├── styles.css          # Complete CSS — dark theme, responsive, role badges, survey type badges
├── firestore.rules     # Firestore security rules
├── firebase.json       # Firebase config (hosting + Firestore)
├── .idx/dev.nix        # Firebase Studio (IDX) environment config
└── .firebaserc         # Firebase project alias
```

## Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **Super Admin** | Global | Create/delete orgs, manage all users, everything |
| **Org Admin** | Per-org | Manage org's users, full data CRUD |
| **Editor** | Per-org | Create/edit surveys, staff, assignments, settings |
| **Viewer** | Per-org | View dashboards, data entry on existing surveys only |

## Firestore Data Model

```
/superAdmins/{email}              — Super admin registry
/users/{email}                    — User profiles with per-org role assignments
  └── organizations: [{orgId, role}]

/organizations/{orgId}            — PT organization (e.g., IQMH, CAP)
  ├── /surveys/{surveyId}         — Survey data (27 IQMH sample surveys available)
  ├── /staff/{staffId}            — Staff members
  └── /settings/
      ├── assignments             — Survey → Staff mapping
      └── weights                 — 6 scoring dimension weights
```

## Getting Started

1. Clone or open in Firebase Studio
2. `npx -y serve . -l 3000` to run locally
3. Sign in — first user is auto-seeded as Super Admin
4. Go to Settings → Load Sample Data

## Deploy

```bash
npx firebase-tools deploy --only hosting,firestore:rules
```

## Development History

This project evolved through several phases:
1. **v1**: Basic load leveling with 5 generic scoring categories, localStorage
2. **v2**: Multi-reassignment what-if simulator
3. **v3**: IQMH-specific 6-dimension scoring model with survey types
4. **v4**: Firebase deployment with Google Sign-In auth
5. **v5**: Email/password auth, Firestore allowlist, RBAC (admin/editor/viewer)
6. **v6** (current): Central Firestore database, multi-tenant orgs, Super Admin, org picker
