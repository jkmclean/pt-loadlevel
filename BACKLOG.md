# LoadLevel — Product Backlog

## 🔮 Future Vision

### SaaS Platform
- [x] **Self-service onboarding** — New PT organizations can sign up, create their org, and start configuring surveys without needing a Super Admin
- [x] **Branded experience** — Per-org display name, custom color accent
- [ ] **Subscription tiers** — Free (1 org, 5 surveys), Pro (unlimited surveys, export), Enterprise (API access, SSO)
- [x] **Usage dashboard for Super Admins** — See all orgs, user counts, survey counts, activity metrics
- [ ] **Billing integration** — Stripe for subscription management
- [ ] **Custom domain support** — Orgs can use their own subdomain (e.g., `iqmh.loadlevel.app`)

---

## 📋 Planned Features

### Collaboration
- [ ] Comments/notes on surveys — Staff can annotate surveys with context
- [ ] Change notifications — Email or in-app alerts when assignments change

### Scoring Model
- [ ] Custom scoring dimensions — Orgs can define their own dimensions beyond the 6 IQMH defaults
- [ ] Survey templates — Pre-built templates for common survey types
- [ ] Bulk survey import from CSV/Excel

### Auth & Security
- [ ] SSO / SAML support for enterprise orgs
- [ ] Cloud Functions for server-side role enforcement in Firestore rules

---

## ✅ Completed

- [x] 6-dimension IQMH scoring model
- [x] What-If multi-reassignment simulator
- [x] Firebase Auth (email/password + Google)
- [x] Role-based access control (Super Admin / Admin / Editor / Viewer)
- [x] Central Firestore database (real-time sync)
- [x] Multi-tenant organization support with org picker
- [x] AI steward governance (AGENTS.md + BUSINESS_RULES.md)
- [x] Centralized logging & observability (logger.js)
- [x] Audit log with Activity Log panel
- [x] PDF/Excel report export
- [x] Historical snapshots with trend chart
- [x] Self-service onboarding
- [x] Per-org branding (display name, accent color)
- [x] Super Admin usage dashboard
- [x] Session timeout (30 min idle, 5 min warning)

