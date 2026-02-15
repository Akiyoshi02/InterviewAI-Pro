# Dashboard UI & Style Audit

Date: 2026-02-14
Project: Interviewer (`d:\Campus Work\Projects\Interviewer`)
Scope: Candidate dashboard, Company dashboard, System Admin dashboard (including all system-admin section routes)

## 1. Audit Method

This audit was completed in two passes:

1. Static UI code review
- Dashboard pages: `src/pages/candidate-dashboard/index.jsx`, `src/pages/company-dashboard/index.jsx`, `src/pages/system-admin-dashboard/index.jsx`
- All dashboard child components in:
  - `src/pages/candidate-dashboard/components/`
  - `src/pages/company-dashboard/components/`
  - `src/pages/system-admin-dashboard/components/`
- Shared UI/layout primitives used by all dashboards:
  - `src/components/ui/Header.jsx`
  - `src/components/ui/UserContextNavigation.jsx`
  - `src/components/ui/NavigationMenu.jsx`
  - `src/components/ui/DashboardQuickActions.jsx`
  - `src/components/ui/Button.jsx`
  - `src/components/ui/Input.jsx`
  - `src/components/ui/Select.jsx`
  - `src/components/ui/LoadingState.jsx`
  - `src/components/ui/MaintenanceBanner.jsx`
- Global style system:
  - `src/styles/tailwind.css`
  - `src/styles/index.css`
  - `tailwind.config.js`

2. Live browser validation (Playwright CLI, Microsoft Edge channel)
- Candidate route: `/candidate-dashboard`
- Company route: `/company-dashboard`
- System admin routes validated:
  - `/system-admin-dashboard`
  - `/system-admin-dashboard/approvals`
  - `/system-admin-dashboard/organizations`
  - `/system-admin-dashboard/users`
  - `/system-admin-dashboard/operations`
  - `/system-admin-dashboard/fairness`
  - `/system-admin-dashboard/training-data`
  - `/system-admin-dashboard/live-chat`
  - `/system-admin-dashboard/settings`
  - `/system-admin-dashboard/audit`
- Evidence saved under `.playwright-cli/` as `.yml` snapshots and `.png` screenshots.

## 2. Global UI Style System

### Typography
- Primary font family: `Inter` (global body + headings)
  - Defined in `src/styles/tailwind.css` and `src/styles/index.css`.
- Monospace: `JetBrains Mono` (`.font-mono`) for timestamps/technical text.
- Base body size at runtime: `16px`.
- Responsive text tokens are defined as CSS custom props (`--text-xs` through `--text-5xl`) in `src/styles/tailwind.css`.

### Color and Theme
- Theme is token-driven with CSS variables (`--color-*`) in light and dark variants.
- Dashboards share the same ambient gradient shell:
  - Light: `from-blue-50 via-white to-purple-50`
  - Dark: `from-slate-900 via-slate-900 to-slate-950`
- Common accent gradients:
  - Primary CTA: `from-blue-600 to-purple-600`
  - Secondary accents: emerald/cyan/amber based on function/state.

### Layout + Surfaces
- Shared shell structure:
  - fixed top header
  - left desktop sidebar + bottom mobile nav
  - centered responsive content container (`container-responsive`)
- Reused card pattern (`card-base`):
  - frosted/glass surface
  - rounded corners (`rounded-2xl` / `rounded-3xl`)
  - subtle depth shadows with dark-mode variants

### Interaction and Motion
- Framer Motion entry animations are consistently used for page reveal and section stagger.
- Hover micro-interactions repeat across cards/buttons:
  - slight lift (`hover:-translate-y-0.5`)
  - shadow amplification
  - border tint shift toward primary blue.

## 3. Candidate Dashboard UI Inventory

Primary page: `src/pages/candidate-dashboard/index.jsx`

### Page Composition (top-to-bottom)
1. Hero welcome card with real-time badge + status mini-card + 3 highlight stats
2. `DashboardQuickActions` block
3. `ProgressOverviewCard`
4. "My Applications" quick-link card
5. Two-column content area:
- Left: `RecentActivityFeed`, `SchedulingWidget`, anxiety guidance card
- Right: `QuickStartPanel`, `AchievementBadges`
6. Insights row:
- `RecommendedTopics`
- AI insights card

### Candidate Component Set
- `ProgressOverviewCard.jsx`
- `QuickStartPanel.jsx`
- `RecentActivityFeed.jsx`
- `SchedulingWidget.jsx`
- `AchievementBadges.jsx`
- `RecommendedTopics.jsx`
- `AIChatAssistant.jsx` (sidebar assistant panel)
- `MyApplicationsList.jsx` (linked page surface from dashboard)

### Candidate Style Tokens (observed in dashboard files)
- Text sizes:
  - `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
  - responsive: `xs:text-*`, `sm:text-*`, `lg:text-4xl`
- Font weights: `font-medium`, `font-semibold`, `font-bold`
- Spacing profile:
  - Frequent compact paddings: `p-2.5`, `p-3`, `p-4`
  - Vertical rhythm: `space-y-2`, `space-y-3`, responsive upscales
  - Hero/detail spacing uses `mt-0.5`, `mt-1`, `mb-2`, `mb-3`, `mb-4`
- Radius profile: `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`
- Shadow profile:
  - card shadows: `shadow-[0_20px_60px_rgba(...)]`
  - emphasis: `shadow-xl`, `shadow-blue-500/40`
  - hover elevation: `hover:shadow-[0_10px_30px_rgba(...)]`

## 4. Company Dashboard UI Inventory

Primary page: `src/pages/company-dashboard/index.jsx`

### Page Composition (top-to-bottom)
1. Optional `PendingApprovalBanner`
2. Hero welcome card with status mini-card + 3 highlight stats
3. `DashboardQuickActions`
4. Main 3-column grid
- Left span (2 cols): `OverviewPanel`, `CandidatePipeline`, `HiringMetrics` (permission-gated)
- Right span (1 col): `QuickActions`, `ReviewerPanel`
5. Full-width `CandidateTable` section (`data-section="candidates"`)
6. Mobile-only floating action button for interview setup (permission-gated)

### Company Component Set
- `OverviewPanel.jsx`
- `CandidatePipeline.jsx`
- `HiringMetrics.jsx`
- `QuickActions.jsx`
- `ReviewerPanel.jsx`
- `CandidateTable.jsx`
- `PendingApprovalBanner.jsx`
- `ApplicationsManager.jsx` (dashboard-adjacent workflow page)
- `CandidateManager.jsx` (dashboard-adjacent workflow page)
- `InvitationManager.jsx` (dashboard-adjacent workflow page)
- `InterviewReviewEnhanced.jsx` (deep review modal/page UI)
- `CandidateProgressDashboard.jsx`
- `AIChatAssistant.jsx` (company assistant panel)

### Company Style Tokens (observed in dashboard files)
- Text sizes:
  - `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
  - analytics-heavy surfaces also use `text-2xl`, `text-3xl`, `text-5xl`
- Font weights: `font-medium`, `font-semibold`, `font-bold`
- Spacing profile:
  - Dense cards: `p-3` / `p-4`
  - Data-heavy panels: `p-5` / `p-6`
  - Wider separation than candidate in analytics/review modules (`gap-6`, `gap-8` in some blocks)
- Radius profile: same family as candidate (`rounded-lg` through `rounded-3xl`)
- Shadow profile:
  - consistent glass-card depth and hover lift
  - additional modal-style elevations (`shadow-2xl`) in manager/review flows

## 5. System Admin Dashboard UI Inventory

Primary page: `src/pages/system-admin-dashboard/index.jsx`

### Admin Information Architecture
Overview + 9 route-based modules:
1. `overview`
2. `approvals`
3. `organizations`
4. `users`
5. `operations`
6. `fairness`
7. `training-data`
8. `live-chat`
9. `settings`
10. `audit`

### Admin Component Set by Section
- Overview:
  - `SystemStats.jsx`
  - recent activity list
  - admin module cards
- Approvals:
  - `OrganizationApprovalQueue.jsx`
- Organizations:
  - `AllOrganizationsList.jsx`
- Users:
  - `UserManagementPanel.jsx`
- Operations:
  - `PlatformOperationsPanel.jsx`
- Fairness:
  - `FairnessCalibrationPanel.jsx`
- Training Data:
  - `TrainingDataManager.jsx`
- Live Chat:
  - `LiveChatManager.jsx`
- Settings:
  - `SystemSettings.jsx`
- Audit:
  - `PlatformAuditLogs.jsx`

### Admin Style Tokens (observed in dashboard files)
- Text sizes:
  - `text-[10px]`, `text-[11px]`, `text-[14px]`, `text-[15px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, plus responsive variants
- Font weights: `font-medium`, `font-semibold`, `font-bold`
- Spacing profile:
  - broadest spacing set of all dashboards (`p-2` through `p-8`, `px-7`, `py-8`)
  - mixed compact controls + dense data tables/forms
- Radius profile:
  - standard rounded family + some special cases (`rounded-md`, `after:rounded-full`)
- Shadow profile:
  - same glass hero style
  - section cards commonly at `shadow-lg`
  - modal/dialog contexts use stronger elevation

## 6. Shared Style Consistency Across All Three Dashboards

Common implementation patterns:
- Same typography foundation (`Inter`), same heading weight profile
- Same hero pattern (badge + heading + supporting text + stat chips)
- Same shell spacing strategy (`container-responsive`, compact `p-3/p-4` cards)
- Same rounded geometry language (pill buttons + rounded cards)
- Same action color language:
  - primary: blue/purple gradient
  - success/positive: green/emerald
  - warning: amber/orange
  - destructive: red/rose

## 7. Runtime-Computed Style Samples

Computed values were captured in-browser on each dashboard shell:
- Body font family: `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Hero title (`h1`) typical desktop value: `36px`, `font-weight: 700`, `line-height: 40px`
- Section heading (`h2`) typical desktop value: `18px`, `font-weight: 600`, `line-height: 28px`
- Hero card surface:
  - border radius: `24px`
  - padding: `16px`
  - frosted white background (`rgba(255, 255, 255, ~0.8)`)

## 8. Evidence Artifacts (Playwright)

Artifacts are in `.playwright-cli/`.
Representative screenshots:
- Candidate:
  - `.playwright-cli/page-2026-02-14T05-12-21-901Z.png`
  - `.playwright-cli/page-2026-02-14T05-12-26-805Z.png`
  - `.playwright-cli/page-2026-02-14T05-12-31-480Z.png`
- Company:
  - `.playwright-cli/page-2026-02-14T05-13-39-920Z.png`
  - `.playwright-cli/page-2026-02-14T05-13-44-352Z.png`
  - `.playwright-cli/page-2026-02-14T05-13-48-361Z.png`
- System Admin:
  - `.playwright-cli/page-2026-02-14T05-14-48-053Z.png` (overview)
  - `.playwright-cli/page-2026-02-14T05-14-53-120Z.png` (approvals)
  - `.playwright-cli/page-2026-02-14T05-14-57-563Z.png` (organizations)
  - `.playwright-cli/page-2026-02-14T05-15-02-298Z.png` (users)
  - `.playwright-cli/page-2026-02-14T05-15-07-035Z.png` (operations)
  - `.playwright-cli/page-2026-02-14T05-15-11-787Z.png` (fairness)
  - `.playwright-cli/page-2026-02-14T05-15-16-148Z.png` (training-data)
  - `.playwright-cli/page-2026-02-14T05-15-20-760Z.png` (live-chat)
  - `.playwright-cli/page-2026-02-14T05-15-25-434Z.png` (settings)
  - `.playwright-cli/page-2026-02-14T05-15-29-732Z.png` (audit)

## 9. Notable UI Quality Findings

1. Character encoding artifacts appear in some UI strings (e.g., em-dash/bullet/emoji showing as mojibake in JSX text). This affects polish and should be cleaned before submission/demo.
2. Style consistency is high across dashboards because shared primitives are heavily reused.
3. Admin dashboard has the widest token spread (more data-table/forms/operations UI states), but still follows the same design system.

## 10. Test Accounts Created for Audit

For reproducible local verification, these accounts were seeded in Firebase/Auth + datastore:
- Candidate: `candidate@example.com`
- Company: `company@example.com`
- System Admin: `admin@example.com`

(Passwords were used only for local testing during this audit session.)

## 11. Style Token Appendix (Full Dashboard Sets)

### Candidate Dashboard Tokens
- Text sizes: `lg:text-4xl`, `sm:text-2xl`, `sm:text-3xl`, `sm:text-base`, `sm:text-lg`, `sm:text-sm`, `sm:text-xl`, `text-[10px]`, `text-[11px]`, `text-base`, `text-lg`, `text-sm`, `text-xl`, `text-xs`, `xs:text-2xl`, `xs:text-lg`, `xs:text-sm`, `xs:text-xs`
- Font weights: `font-bold`, `font-medium`, `font-semibold`
- Gap tokens: `gap-1`, `gap-1.5`, `gap-2`, `gap-2.5`, `gap-3`, `gap-4`, `sm:gap-2.5`, `sm:gap-3`, `xs:gap-0`, `xs:gap-2`, `xs:gap-3`
- Radius tokens: `rounded`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-lg`, `rounded-xl`

### Company Dashboard Tokens
- Text sizes: `lg:text-4xl`, `sm:text-2xl`, `sm:text-3xl`, `sm:text-base`, `sm:text-lg`, `sm:text-sm`, `sm:text-xl`, `text-[10px]`, `text-[11px]`, `text-2xl`, `text-3xl`, `text-5xl`, `text-base`, `text-lg`, `text-sm`, `text-xl`, `text-xs`, `xs:text-2xl`, `xs:text-lg`, `xs:text-sm`, `xs:text-xs`
- Font weights: `font-bold`, `font-medium`, `font-semibold`
- Gap tokens: `gap-1`, `gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `sm:gap-2.5`, `sm:gap-3`, `sm:gap-4`, `xs:gap-2`
- Radius tokens: `rounded`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-lg`, `rounded-xl`

### System Admin Dashboard Tokens
- Text sizes: `lg:text-4xl`, `sm:text-3xl`, `sm:text-base`, `sm:text-lg`, `sm:text-sm`, `sm:text-xl`, `text-[10px]`, `text-[11px]`, `text-[14px]`, `text-[15px]`, `text-2xl`, `text-3xl`, `text-base`, `text-lg`, `text-sm`, `text-xl`, `text-xs`, `xs:text-2xl`, `xs:text-lg`, `xs:text-sm`, `xs:text-xs`
- Font weights: `font-bold`, `font-medium`, `font-semibold`
- Gap tokens: `gap-1.5`, `gap-2`, `gap-2.5`, `gap-3`, `gap-4`, `gap-6`, `sm:gap-2.5`, `sm:gap-3`, `sm:gap-4`, `xs:gap-2`
- Radius tokens: `after:rounded-full`, `rounded`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-lg`, `rounded-md`, `rounded-xl`

Note: Full spacing, color, border, and shadow token sets were also extracted during analysis; primary readability-focused sets are listed above.
