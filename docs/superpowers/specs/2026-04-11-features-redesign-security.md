# BCA e-Statement: Features, UI Redesign & Security — Design Spec

**Date:** 2026-04-11  
**Scope:** Security hardening (2 HIGH issues), Modern Gradient UI redesign with animations, and a 6-feature roadmap built one at a time.  
**Stack:** Next.js 15 App Router + Tailwind CSS v4, Python FastAPI, Supabase (PostgreSQL + Auth + RLS), Docker on CasaOS.

---

## 1. Security Fixes

### 1.1 File Size and Type Validation

**Location:** `backend/routers/statements.py`, upload endpoint.

**Rules:**
- Maximum file size: 10 MB. The existing upload handler already reads the full file into memory (`content = await file.read()`). After reading, check `len(content) > 10 * 1024 * 1024` and reject with HTTP 400 before passing to the parser.
- MIME type: reject if `file.content_type` is not `application/pdf`.
- Magic bytes: check `content[:5] != b"%PDF-"` and reject with HTTP 400. This catches files renamed to `.pdf` with a wrong MIME type.
- Return HTTP 400 with a clear message on rejection. Do not call the PDF parser or LLM.

**Why both MIME + magic bytes?** Browsers report `content_type` from the OS file association, which can be spoofed or wrong. Magic bytes are authoritative.

### 1.2 Upload Rate Limiting

**Location:** `backend/routers/statements.py`, module level.

**Implementation:**
```
_upload_counts: dict[str, list[float]] = defaultdict(list)  # user_id → [timestamp]
RATE_LIMIT_WINDOW = 3600   # seconds (1 hour)
RATE_LIMIT_MAX    = 10     # uploads per window
```

On each upload request, after auth:
1. Prune entries in `_upload_counts[user_id]` older than `now - RATE_LIMIT_WINDOW`.
2. If `len(entries) >= RATE_LIMIT_MAX`, return HTTP 429 with message `"Upload limit reached. Max 10 uploads per hour."`.
3. Otherwise append `time.time()` to the list and proceed.

**Trade-offs:** In-memory means limits reset on container restart. Acceptable for a single-user home server. No Redis dependency needed.

---

## 2. UI Redesign — Modern Gradient

The visual direction is **Modern Gradient**: soft blue-to-purple gradient backgrounds, white cards with colored borders, per-category tinted badges, and gradient primary buttons. Reference aesthetic: Notion / Linear.

### 2.1 Color System

| Token | Value | Usage |
|---|---|---|
| Page background | `bg-gradient-to-br from-blue-50 to-violet-50` | Shell/layout wrapper |
| Card background | `bg-white` | All cards |
| Card border | `border border-violet-100` | All cards |
| Primary button | `bg-gradient-to-r from-blue-500 to-violet-500` | Upload, Save actions |
| Sidebar active pill | `bg-gradient-to-r from-blue-500 to-violet-500 text-white` | Active nav item |
| Sidebar inactive | `text-slate-600 hover:bg-violet-50` | Inactive nav items |

**Category badge colors** (background / text):

| Category | Badge |
|---|---|
| Food | `bg-orange-100 text-orange-700` |
| Transport | `bg-cyan-100 text-cyan-700` |
| Utilities | `bg-yellow-100 text-yellow-700` |
| Shopping | `bg-pink-100 text-pink-700` |
| Subscription | `bg-purple-100 text-purple-700` |
| Health | `bg-red-100 text-red-700` |
| Entertainment | `bg-indigo-100 text-indigo-700` |
| Transfer | `bg-blue-100 text-blue-700` |
| Income | `bg-green-100 text-green-700` |
| Other | `bg-slate-100 text-slate-500` |

### 2.2 Typography and Layout

- Amount columns: `font-mono` for digit alignment.
- Card padding: `p-5` (down from `p-6`) for tighter feel.
- Category badge border radius: `rounded-full` (pill shape).
- Section headings: `text-slate-800 font-semibold`.

### 2.3 Animations

All animations use CSS transitions — no Framer Motion or JS animation libraries.

| Element | Animation |
|---|---|
| Stat cards | `hover:-translate-y-0.5 hover:shadow-md transition-all duration-150` |
| Category badge (override) | `transition-colors duration-150` |
| Sidebar active indicator | `transition-colors duration-200` |
| Upload processing state | Animated gradient shimmer via `@keyframes shimmer` in `globals.css` |
| Page mount | `animate-fadeIn` — `opacity: 0 → 1`, `translateY: 8px → 0`, 200ms ease-out, defined in `globals.css` |
| Chart bars/lines | Recharts `isAnimationActive={true}` (already default; ensure it's not disabled) |
| Dropdown (category override) | `transition-opacity duration-100` on open/close |

**globals.css additions:**
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn { animation: fadeIn 0.2s ease-out both; }

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e8ff 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### 2.4 Files Changed

- `frontend/app/globals.css` — add keyframes + utility classes
- `frontend/components/Sidebar.tsx` — gradient active pill, hover states
- `frontend/app/dashboard/DashboardClient.tsx` — page background, card styles, stat card hover
- `frontend/app/dashboard/statements/StatementsClient.tsx` — category badge colors, table styling
- `frontend/app/dashboard/analytics/AnalyticsClient.tsx` — card borders, chart animation enabled
- `frontend/components/UploadForm.tsx` — gradient button, shimmer loading state

No new component files. No new dependencies.

---

## 3. Features Roadmap

Features are built sequentially. Each ships as its own commit. The UI redesign (Section 2) is applied first, then features are layered on top.

### Feature 1: Manual Category Override *(build first)*

**Goal:** Fix miscategorized transactions inline without re-uploading.

**UX:** In the transaction table, the category badge is clickable. Clicking it replaces the badge with a styled `<select>` dropdown (all 10 categories). Selecting a new value saves immediately and restores the badge with the new color.

**Backend — new route:**
```
PATCH /api/transactions/{transaction_id}
Body: { "category_name": "Food" }
Auth: Bearer JWT (existing pattern)
```
- Validate `category_name` is in the known 10-category list.
- The backend uses the Supabase service role key (RLS is bypassed server-side), so ownership must be enforced explicitly: update only where `id = transaction_id AND user_id = authenticated_user.id`. If 0 rows updated, return HTTP 404.
- Returns the updated transaction row.

**Frontend:**
- `StatementsClient.tsx`: add `editingId` state. On badge click, render `<select>` in that cell. On change, call `PATCH`, update local `transactions` state, clear `editingId`.
- No new page, no new component file (stays within `StatementsClient.tsx`).

**DB:** No schema change. `category_name` column already exists and is writable.

### Feature 2: Export CSV / Excel

**Goal:** Download all transactions for the selected month as a spreadsheet.

**Backend — new route:**
```
GET /api/transactions/export?month=2024-03
Auth: Bearer JWT
Response: text/csv stream
```
- Queries transactions for user + month, formats as CSV rows.
- Uses FastAPI `StreamingResponse` with `media_type="text/csv"` and `Content-Disposition: attachment; filename="statement-2024-03.csv"`.

**Frontend:**
- Button `"Export CSV"` in the Statements page header (next to month selector).
- On click: fetch the route with auth header, create a Blob, trigger `<a download>` click. No new page.

**Columns:** Date, Description, Amount (IDR), Category.

### Feature 3: Global Search

**Goal:** Find any transaction by description or merchant across all uploaded months.

**UX:** Search input in the Statements page header (separate from month-level search). Typing filters across all months simultaneously; results show the month alongside each transaction.

**Implementation:** Client-side. `StatementsClient.tsx` already loads all months' transactions — filter across the flat list when a global search term is present, grouping results by month. No new backend route needed unless data volume grows large.

### Feature 4: Spending Insights

**Goal:** Auto-generated text summaries on the Analytics page.

**Examples:**
- "Food spending up 40% vs last month"
- "Largest category this month: Transfer (Rp 15,200,000)"
- "3 transactions above Rp 2,000,000 this month"

**Implementation:** Computed server-side in a new route:
```
GET /api/insights?month=2024-03
```
Returns a list of insight strings. Logic: compare current month totals per category vs prior month, flag transactions > 2× the category average. Pure SQL aggregation — no LLM call.

Frontend: "Insights" card on the Analytics page, renders the list as styled callouts.

### Feature 5: Monthly Budget Tracker

**Goal:** Set per-category monthly limits and track progress.

**New DB table:**
```sql
create table budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  category    text not null,
  monthly_limit numeric(12,2) not null,
  created_at  timestamptz default now(),
  unique (user_id, category)
);
alter table budgets enable row level security;
create policy "users manage own budgets"
  on budgets for all using (auth.uid() = user_id);
```

**UX:** New "Budget" section on the Dashboard. Shows a progress bar per category (actual spend / limit). Bars turn red when exceeded. Clicking a budget limit value makes it editable inline.

**Backend:** `GET /api/budgets`, `PUT /api/budgets/{category}` (upsert).

### Feature 6: Recurring Transaction Detection

**Goal:** Flag subscriptions, loan payments, and recurring charges automatically.

**Logic:** Group transactions by normalized description (lowercase, strip dates/amounts). If a description appears in 2+ different calendar months, flag as recurring. Run as a background computation when new transactions are uploaded.

**New column:** `is_recurring boolean default false` on the `transactions` table (migration required).

**UX:** Recurring badge (🔁 or "Recurring" pill) on transaction rows. Filter toggle "Show recurring only" on the Statements page.

**Backend:** After bulk-insert in the upload route, run a SQL query that marks `is_recurring = true` for descriptions matching the pattern above.

---

## 4. Build Order

| # | Item | Dependency |
|---|---|---|
| 0 | Security fixes (file validation + rate limit) | None — ship first |
| 1 | UI Redesign (Modern Gradient + animations) | None |
| 2 | Manual Category Override | UI redesign done |
| 3 | Export CSV | UI redesign done |
| 4 | Global Search | Manual Category Override done (clean data) |
| 5 | Spending Insights | Clean category data |
| 6 | Monthly Budget Tracker | Spending Insights done |
| 7 | Recurring Detection | 2+ months of data in DB |

---

## 5. Out of Scope

- HTTPS / TLS termination (handled by Tailscale's encrypted overlay)
- CORS origin locking (acceptable behind Tailscale; revisit if exposed publicly)
- Authentication changes (register flow, OAuth) — current single-user auth is sufficient
- Mobile app
- Multi-bank support (non-BCA statements)
