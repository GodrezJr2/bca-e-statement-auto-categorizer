# Frontend Apple Card-inspired redesign design

## Goal

Redesign all frontend screens with a simple, clean Apple Card-inspired visual system while preserving routes, backend APIs, Supabase auth/data flow, and existing product behavior.

Scope includes:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/statements`
- `/dashboard/analytics`
- `/dashboard/map`

## Visual direction

Use an Apple Card-inspired finance interface:

- Premium, calm, light visual tone.
- White and soft gray surfaces as the baseline.
- One dark premium finance hero card for dashboard/landing emphasis.
- System blue for primary actions.
- Green and red only for income/expense semantics.
- Neutral grays for structure, labels, disabled states, and dividers.
- Rounded 24-32px panels, subtle shadows, and minimal borders.
- No purple gradients or decorative AI-style visuals.
- Typography uses system stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `Segoe UI`, sans-serif.

## Architecture

Keep current Next.js App Router structure and current server/client data boundaries.

Add small reusable presentation primitives instead of a broad UI framework rewrite:

- `AppShell`: shared authenticated layout wrapper around sidebar/mobile topbar/content spacing.
- `SurfaceCard`: standard Apple-style white panel with radius, shadow, and optional padding variants.
- `MetricTile`: compact label/value/status card for dashboard and analytics metrics.
- `HeroFinanceCard`: Apple Card-inspired dark gradient summary card for landing and dashboard.

Keep existing feature components responsible for feature logic. Refactor styling/layout inside them only where needed.

## Screen designs

### Landing `/`

Simple centered product intro with premium statement-card visual. Primary actions: sign in and create account. Keep copy concise and focused on importing BCA statements, categorizing spending, and understanding money flow.

### Login and register

Desktop uses a minimal split layout:

- Left: auth form in a clean white card.
- Right: premium statement-card visual showing product identity.

Mobile collapses to a single-column form with the visual reduced or hidden.

### Dashboard

Dashboard becomes the main finance overview:

1. Hero finance card showing current selected-period spending/income context.
2. Three compact `MetricTile` cards for expense, income, and transaction count.
3. Upload card and statement history in the side column.
4. Daily spending and category charts in white `SurfaceCard` panels.
5. Budget tracker below, using quiet progress rows and system colors.

### Statements

Statements screen becomes a clean transaction browser:

- Sticky or prominent month/search controls.
- Global search stays available.
- Transactions remain editable by category.
- Category pills use subdued semantic colors.
- CSV export is a quiet secondary action unless actively exporting.

### Analytics

Analytics prioritizes trends:

- Trend chart first.
- Summary metrics as compact tiles.
- Insights in an iOS-style suggestions panel.
- Category/daily charts remain in card panels.

### Flow Map

Flow Map keeps current Sankey/drilldown behavior:

- Filters move into a compact toolbar card.
- Sankey appears in a large white canvas panel.
- Drilldown appears as a clean right sheet/panel, not a heavy modal.

## Data flow

No backend or database changes.

- Server pages continue to use `createServerSupabaseClient()` for authentication and initial transaction reads.
- Client components continue to use `createClient()` for session access and direct Supabase refreshes.
- Backend API calls continue to use `NEXT_PUBLIC_API_URL` and `Authorization: Bearer <access_token>`.
- `lib/api/flows.ts` remains API boundary for flow data.

## Error and loading states

Keep existing error semantics and messages. Restyle presentation only:

- Inline alerts use soft red/amber backgrounds and system text colors.
- Loading skeletons use neutral gray shimmer, not blue/purple shimmer.
- Disabled buttons use muted gray surfaces.
- Empty states use concise text and optional simple icon treatment.

## Implementation constraints

- Preserve all routes and existing feature behavior.
- Do not change backend endpoints, Supabase schema, or auth logic.
- Do not introduce new dependencies for styling.
- Avoid broad refactors unrelated to visual redesign.
- Remove Google font import from `globals.css` if system font stack is adopted.
- Replace current purple/blue gradient tokens with Apple-style neutral/system tokens.

## Verification

Run:

```bash
npm run build
npx tsc --noEmit
```

Then start frontend dev server and verify in browser:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/statements`
- `/dashboard/analytics`
- `/dashboard/map`

Check responsive behavior on desktop and mobile widths. Verify dashboard auth redirects still work, upload UI remains usable, category editing still works visually, CSV export is reachable, analytics insights still fetch, and Flow Map filters/drilldown remain usable.
