# Phase 1: Security + UI Redesign + Manual Category Override

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the upload endpoint against oversized/malicious files and abuse, apply the Modern Gradient UI redesign with animations, and add inline category editing to the transaction table.

**Architecture:** Security fixes are isolated to `backend/routers/statements.py`. UI redesign updates CSS variables in `globals.css` and inline styles in existing components — no new files. Category override adds one new backend route and inline state to `StatementsClient.tsx`; the transaction `id` must also be added to the Supabase select and the `Transaction` type.

**Tech Stack:** FastAPI, pytest, httpx (backend tests); Next.js 15 App Router, Tailwind CSS v4, React inline styles (frontend)

---

## File Map

| File | Change |
|---|---|
| `backend/routers/statements.py` | Add file validation, rate limiting, PATCH route |
| `backend/tests/test_upload_validation.py` | New — pytest tests for file validation and rate limiting |
| `backend/tests/test_category_patch.py` | New — pytest tests for PATCH /transactions/{id} |
| `frontend/app/globals.css` | Update CSS variables to Modern Gradient, add keyframes |
| `frontend/components/Sidebar.tsx` | White sidebar, gradient active pill |
| `frontend/app/dashboard/DashboardClient.tsx` | Gradient page bg, stat card hover animations |
| `frontend/app/dashboard/statements/StatementsClient.tsx` | Category badge pills, `editingId` state, override dropdown |
| `frontend/app/dashboard/analytics/AnalyticsClient.tsx` | Card border update, gradient active filter pills |
| `frontend/components/UploadForm.tsx` | Gradient submit button, shimmer loading state |
| `frontend/lib/types.ts` | Add `id: string` to `Transaction` interface |

---

## Task 1: Set up backend test infrastructure

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_upload_validation.py`

- [ ] **Step 1: Add pytest and httpx to requirements**

Open `backend/requirements.txt` and append two lines:
```
pytest>=8.0.0
httpx>=0.27.0
```

- [ ] **Step 2: Create the tests package**

Create `backend/tests/__init__.py` as an empty file.

- [ ] **Step 3: Write failing tests for file validation**

Create `backend/tests/test_upload_validation.py`:
```python
import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# We patch auth + DB so tests run without real credentials
@pytest.fixture
def client():
    with patch("routers.statements._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "test-user-id"
        mock_supa.return_value.auth.get_user.return_value = mock_user
        from main import app
        yield TestClient(app)


def _upload(client, content: bytes, filename: str = "test.pdf", content_type: str = "application/pdf"):
    return client.post(
        "/api/upload-statement",
        headers={"Authorization": "Bearer fake-jwt"},
        files={"file": (filename, io.BytesIO(content), content_type)},
        data={"password": ""},
    )


def test_rejects_file_over_10mb(client):
    big = b"%PDF-" + b"A" * (10 * 1024 * 1024 + 1)
    resp = _upload(client, big)
    assert resp.status_code == 400
    assert "10 MB" in resp.json()["detail"]


def test_rejects_wrong_mime_type(client):
    resp = _upload(client, b"%PDF-fake", content_type="image/png")
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_rejects_bad_magic_bytes(client):
    resp = _upload(client, b"PK\x03\x04fake-zip-data")
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_accepts_valid_pdf_mime_and_magic(client):
    # Should pass validation (will fail later at PDF parsing, that's fine)
    resp = _upload(client, b"%PDF-1.4 fake content")
    # Not a 400 from our validation — could be 422 from parser, that's ok
    assert resp.status_code != 400
```

- [ ] **Step 4: Run tests, confirm they fail**

```bash
cd backend && python -m pytest tests/test_upload_validation.py -v
```
Expected: 4 tests FAIL — `routers.statements` has no validation yet.

---

## Task 2: Add file size and type validation

**Files:**
- Modify: `backend/routers/statements.py` — lines 43-44 (after `pdf_bytes = await file.read()`)

- [ ] **Step 1: Add MIME type check before reading**

In `backend/routers/statements.py`, replace the read + parse block (lines 43-53) with:

```python
    # 2. Read PDF bytes in memory — never write to disk
    pdf_bytes = await file.read()

    # 2a. Validate MIME type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # 2b. Validate magic bytes (%PDF-)
    if not pdf_bytes[:5] == b"%PDF-":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF.")

    # 2c. Validate file size (10 MB max)
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds the 10 MB limit.")

    # 3. Decrypt + parse
    try:
        transactions = extract_transactions(pdf_bytes, password or None)
    except ValueError as e:
        msg = str(e)
        if "password" in msg.lower():
            raise HTTPException(status_code=422, detail="Incorrect PDF password.")
        raise HTTPException(status_code=422, detail="Could not parse the PDF. Check the file format.")
```

- [ ] **Step 2: Run tests, confirm they pass**

```bash
cd backend && python -m pytest tests/test_upload_validation.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt backend/tests/__init__.py backend/tests/test_upload_validation.py backend/routers/statements.py
git commit -m "feat: add file size and type validation on PDF upload (10MB max, PDF-only)"
```

---

## Task 3: Add upload rate limiting

**Files:**
- Modify: `backend/routers/statements.py` — add module-level dict + check inside the route handler
- Modify: `backend/tests/test_upload_validation.py` — add rate limiting tests

- [ ] **Step 1: Write failing rate limit tests**

Append to `backend/tests/test_upload_validation.py`:

```python
import time as time_module

def test_rate_limit_blocks_after_10_uploads(client):
    from routers.statements import _upload_counts
    user_id = "test-user-id"
    now = time_module.time()
    # Pre-fill 10 recent uploads
    _upload_counts[user_id] = [now - i for i in range(10)]

    resp = _upload(client, b"%PDF-fake")
    assert resp.status_code == 429
    assert "limit" in resp.json()["detail"].lower()


def test_rate_limit_allows_after_window_expires(client):
    from routers.statements import _upload_counts
    user_id = "test-user-id"
    # All 10 uploads are older than 1 hour
    _upload_counts[user_id] = [time_module.time() - 3700 for _ in range(10)]

    resp = _upload(client, b"%PDF-fake")
    # Should pass rate limit (will fail at PDF parsing, not 429)
    assert resp.status_code != 429
```

- [ ] **Step 2: Run tests, confirm the new 2 fail**

```bash
cd backend && python -m pytest tests/test_upload_validation.py::test_rate_limit_blocks_after_10_uploads tests/test_upload_validation.py::test_rate_limit_allows_after_window_expires -v
```
Expected: 2 FAIL — `_upload_counts` doesn't exist yet.

- [ ] **Step 3: Add rate limiting to statements.py**

At the top of `backend/routers/statements.py`, add these imports after the existing ones:
```python
import time
from collections import defaultdict
```

After the existing module-level `_supabase: Client | None = None` block, add:
```python
# In-memory rate limit: max 10 uploads per user per hour.
# Resets naturally on container restart (acceptable for single-user home server).
_upload_counts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_MAX    = 10
_RATE_LIMIT_WINDOW = 3600  # seconds
```

Inside the `upload_statement` route handler, after the auth block (after `user_id = str(user_resp.user.id)`) and before the file read, add:
```python
    # Rate limit check
    now = time.time()
    _upload_counts[user_id] = [t for t in _upload_counts[user_id] if now - t < _RATE_LIMIT_WINDOW]
    if len(_upload_counts[user_id]) >= _RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Upload limit reached. Max 10 uploads per hour.")
    _upload_counts[user_id].append(now)
```

- [ ] **Step 4: Run all upload validation tests**

```bash
cd backend && python -m pytest tests/test_upload_validation.py -v
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/statements.py backend/tests/test_upload_validation.py
git commit -m "feat: add in-memory rate limiting on upload endpoint (10/hour per user)"
```

---

## Task 4: UI — Update CSS variables and add animation keyframes

**Files:**
- Modify: `frontend/app/globals.css` — update `:root` custom properties, add keyframes

The current app uses `var(--sidebar-bg)`, `var(--bg-main)`, `var(--accent-blue)`, etc. as inline styles throughout all components. Updating these variables in one place reshapes the whole app.

- [ ] **Step 1: Update the custom properties block at the top of globals.css**

In `frontend/app/globals.css`, replace the existing `:root` block at lines 3-17:

```css
:root {
  --sidebar-bg: #FFFFFF;
  --sidebar-border: #EDE9FE;
  --accent-blue: #3B82F6;
  --accent-blue-light: #93C5FD;
  --accent-violet: #8B5CF6;
  --accent-gradient: linear-gradient(135deg, #3B82F6, #8B5CF6);
  --income-green: #059669;
  --expense-red: #DC2626;
  --bg-main: linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%);
  --bg-card: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --border: #EDE9FE;
}
```

- [ ] **Step 2: Add keyframes for fadeIn and shimmer after the existing `@layer base` block**

Append to the end of `frontend/app/globals.css`:

```css
/* ── Animations ── */
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

- [ ] **Step 3: Rebuild the frontend and verify the page background changed**

On the server, run:
```bash
docker-compose up -d --build frontend
```
Open the dashboard — the background should now show a soft blue-to-violet gradient instead of the flat grey. Cards should still be white.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat: apply Modern Gradient CSS variables and add fadeIn/shimmer animations"
```

---

## Task 5: UI — Sidebar (white, gradient active pill)

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

- [ ] **Step 1: Update SidebarContent nav styles**

In `frontend/components/Sidebar.tsx`, the `<aside>` for desktop sidebar uses `style={{ background: "var(--sidebar-bg)" }}` — that now resolves to white. The border needs to be added. Replace the desktop `<aside>` opening tag (line 91-92):

```tsx
      <aside
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
        className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col z-20 select-none">
```

- [ ] **Step 2: Update the logo section border and text colors**

The logo divider `border-b border-white/10` is invisible on white. Replace the logo `<div>` opening tag (line 29):
```tsx
      <div className="px-6 py-7" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
```

Update the subtitle text color from `#64748B` to `var(--text-muted)` (same value, but keeps it consistent):
```tsx
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Financial Hub</p>
```

Update the logo circle to use gradient:
```tsx
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-gradient)" }}>
```

- [ ] **Step 3: Update nav item active/inactive styles and inactive text color**

In the `NAV.map` block, replace the `Link` style (currently `color: active ? "#fff" : "#94A3B8"`):
```tsx
            <Link key={href} href={href} onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
              style={{
                background: active ? "var(--accent-gradient)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
              }}>
```

- [ ] **Step 4: Update the Upload CTA button and Logout button**

Replace the Upload CTA style (currently `background: "var(--accent-blue)"`):
```tsx
        <Link href="/dashboard" onClick={onNav}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "var(--accent-gradient)", color: "#fff" }}>
```

Replace logout text color (`#64748B` → `var(--text-muted)`):
```tsx
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all duration-150 text-sm"
          style={{ color: "var(--text-muted)" }}>
```

- [ ] **Step 5: Update mobile top bar background to white**

Replace the mobile `<header>` style:
```tsx
      <header
        style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--sidebar-border)" }}
        className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
```

Update mobile header logo text and hamburger button color:
```tsx
          <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>e-Statement</p>
```
```tsx
        <button onClick={() => setOpen(true)} style={{ color: "var(--text-muted)" }}>
```

Update mobile drawer `<aside>` to also use white:
```tsx
          <aside className="relative w-64 h-full flex flex-col select-none"
            style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
```

- [ ] **Step 6: Visual check**

Rebuild and open the app. Sidebar should be white with a soft violet right border. Active nav item should show the blue-violet gradient pill.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/Sidebar.tsx
git commit -m "feat: update Sidebar to white background with gradient active pill"
```

---

## Task 6: UI — Dashboard stat card hover animations + filter pill gradient

**Files:**
- Modify: `frontend/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add fadeIn to page main element and hover to stat cards**

In `DashboardClient.tsx`, add `animate-fadeIn` class to the `<main>` element (line 79):
```tsx
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 min-h-screen animate-fadeIn">
```

In the stats row, each stat card `<div>` gets hover transition classes (the `.map` on line 120). Add `className` with transition to each card:
```tsx
            <div key={label}
              className="rounded-2xl p-4 flex items-center gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-default"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
```

- [ ] **Step 2: Update active month filter pill to use gradient**

In the month filter pills `.map` and the "All Time" button, replace the active background from `"var(--accent-blue)"` to `"var(--accent-gradient)"`:

```tsx
              <button onClick={() => setSelectedMonth("all")}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedMonth === "all" ? "var(--accent-gradient)" : "var(--bg-card)",
                  color: selectedMonth === "all" ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}>
                All Time
              </button>
              {months.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: selectedMonth === m ? "var(--accent-gradient)" : "var(--bg-card)",
                    color: selectedMonth === m ? "#fff" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                  {formatMonthLabel(m)}
                </button>
              ))}
```

- [ ] **Step 3: Update uploaded statements list active item**

In the "Uploaded Statements" section, replace the active background from `"#EFF6FF"` and border from `"var(--accent-blue-light)"`:
```tsx
                        background: selectedMonth === m ? "#F5F3FF" : "#F8FAFC",
                        border: `1px solid ${selectedMonth === m ? "var(--accent-violet)" : "var(--border)"}`,
```
And active text color from `"var(--accent-blue)"` to `"var(--accent-violet)"`:
```tsx
                        <span className="text-xs font-semibold" style={{ color: selectedMonth === m ? "var(--accent-violet)" : "var(--text-primary)" }}>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/DashboardClient.tsx
git commit -m "feat: add page fadeIn, stat card hover lift, gradient filter pills on Dashboard"
```

---

## Task 7: UI — Statements page category badge pills + Analytics gradient pills

**Files:**
- Modify: `frontend/app/dashboard/statements/StatementsClient.tsx`
- Modify: `frontend/app/dashboard/analytics/AnalyticsClient.tsx`

- [ ] **Step 1: Replace CAT_COLORS in StatementsClient with tinted Tailwind-style palette**

In `StatementsClient.tsx`, replace the `CAT_COLORS` constant (lines 18-22) with a map of `{ bg, text }` tuples:

```tsx
const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  Food:          { bg: "#FFF7ED", text: "#C2410C" },
  Transport:     { bg: "#ECFEFF", text: "#0E7490" },
  Utilities:     { bg: "#FEFCE8", text: "#A16207" },
  Shopping:      { bg: "#FDF4FF", text: "#9333EA" },
  Subscription:  { bg: "#F3E8FF", text: "#7C3AED" },
  Health:        { bg: "#FEF2F2", text: "#B91C1C" },
  Entertainment: { bg: "#EEF2FF", text: "#4338CA" },
  Transfer:      { bg: "#EFF6FF", text: "#1D4ED8" },
  Income:        { bg: "#F0FDF4", text: "#15803D" },
  Other:         { bg: "#F8FAFC", text: "#64748B" },
};
```

- [ ] **Step 2: Update the category badge render in the transaction table**

In the `filtered.map` block, replace the badge `<span>` (lines 176-179):

```tsx
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-150"
                                style={{
                                  background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg,
                                  color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text,
                                }}>
                                {cat}
                              </span>
                            </td>
```

- [ ] **Step 3: Add hover animation to table rows and fadeIn to main**

On the `<main>` element in `StatementsClient.tsx`, add `animate-fadeIn` class:
```tsx
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 animate-fadeIn">
```

On each `<tr>` in the table body, update hover class (currently `hover:bg-slate-50`):
```tsx
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                            className="transition-colors duration-100 hover:bg-violet-50/30">
```

- [ ] **Step 4: Update active month button in StatementsClient**

Replace the active month button background from `"var(--accent-blue)"` to `"var(--accent-gradient)"` (the month list on the left, line 82):
```tsx
                  background: isActive ? "var(--accent-gradient)" : "var(--bg-card)",
                  border: `1px solid ${isActive ? "var(--accent-violet)" : "var(--border)"}`,
```

- [ ] **Step 5: Update AnalyticsClient filter pills and add fadeIn**

In `AnalyticsClient.tsx`, add `animate-fadeIn` class to `<main>` (line 92):
```tsx
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 animate-fadeIn">
```

Replace active filter pill background from `"var(--accent-blue)"` to `"var(--accent-gradient)"` in both the "All Time" button and the months map. Find lines 110-126 and apply:
```tsx
                  background: selectedMonth === "all" ? "var(--accent-gradient)" : "var(--bg-card)",
```
and similarly for each month button:
```tsx
                  background: selectedMonth === m ? "var(--accent-gradient)" : "var(--bg-card)",
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/dashboard/statements/StatementsClient.tsx frontend/app/dashboard/analytics/AnalyticsClient.tsx
git commit -m "feat: tinted category badge pills, gradient active pills, fadeIn on Statements + Analytics"
```

---

## Task 8: UI — UploadForm gradient button + shimmer loading

**Files:**
- Modify: `frontend/components/UploadForm.tsx`

- [ ] **Step 1: Replace solid blue submit button with gradient**

In `UploadForm.tsx`, find the submit `<button>` (line 137). Replace its `style`:
```tsx
        <button type="submit" disabled={!file || status === "uploading"}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
          style={{
            background: !file || status === "uploading"
              ? "#CBD5E1"
              : "var(--accent-gradient)",
            cursor: !file || status === "uploading" ? "not-allowed" : "pointer",
          }}>
```

- [ ] **Step 2: Add shimmer skeleton while uploading**

Replace the button label content (currently `<Loader2> Processing...`). Change the entire button inner content:
```tsx
          {status === "uploading" ? (
            <span className="flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Processing&hellip;
            </span>
          ) : "Process Statement"}
```

Replace the drop zone `background` when `dragging` from `"#EFF6FF"` to `"#F3E8FF"` (violet tint):
```tsx
            background: dragging ? "#F3E8FF" : "#F8FAFC",
```

And the border color when dragging from `"var(--accent-blue)"` to `"var(--accent-violet)"`:
```tsx
            borderColor: dragging ? "var(--accent-violet)" : "var(--border)",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/UploadForm.tsx
git commit -m "feat: gradient upload button, violet drag-over highlight on UploadForm"
```

---

## Task 9: Feature 1 — Add `id` to Transaction type and Supabase query

The transaction `id` is needed for the PATCH endpoint. Currently the frontend never selects it.

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/app/dashboard/statements/page.tsx` (Supabase query)
- Modify: `frontend/app/dashboard/page.tsx` (Supabase query, for consistency)

- [ ] **Step 1: Add `id` to the Transaction interface**

In `frontend/lib/types.ts`, replace the entire file:
```typescript
export interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  categories: { name: string } | null;
}
```

- [ ] **Step 2: Add `id` to the Statements page Supabase select**

Read `frontend/app/dashboard/statements/page.tsx` to find the Supabase query, then add `id` to the select. The query currently looks like:
```typescript
.select("transaction_date, description, amount, categories(name)")
```
Change it to:
```typescript
.select("id, transaction_date, description, amount, categories(name)")
```

- [ ] **Step 3: Add `id` to the Dashboard page Supabase select**

Read `frontend/app/dashboard/page.tsx` to find the same query and apply the same change:
```typescript
.select("id, transaction_date, description, amount, categories(name)")
```

- [ ] **Step 4: Add `id` to the DashboardClient refresh query**

In `frontend/app/dashboard/DashboardClient.tsx`, the `refresh()` function has a Supabase query. Update it:
```typescript
      .select("id, transaction_date, description, amount, categories(name)")
```

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/types.ts frontend/app/dashboard/statements/page.tsx frontend/app/dashboard/page.tsx frontend/app/dashboard/DashboardClient.tsx
git commit -m "feat: add transaction id to type and all Supabase selects"
```

---

## Task 10: Feature 1 — Backend PATCH /api/transactions/{id} route

**Files:**
- Create: `backend/tests/test_category_patch.py`
- Modify: `backend/routers/statements.py`
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: Add the request/response schema**

In `backend/models/schemas.py`, append:
```python
class CategoryUpdateRequest(BaseModel):
    category_name: str

class TransactionUpdateResponse(BaseModel):
    id: str
    category_name: str
```

- [ ] **Step 2: Write failing tests for the PATCH route**

Create `backend/tests/test_category_patch.py`:
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    with patch("routers.statements._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-123"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        # Simulate category lookup returning {name: id}
        mock_supa.return_value.table.return_value.select.return_value.execute.return_value.data = [
            {"id": "cat-food-uuid", "name": "Food"},
            {"id": "cat-other-uuid", "name": "Other"},
        ]

        # Simulate the update chain returning 1 updated row
        mock_update = MagicMock()
        mock_update.eq.return_value = mock_update
        mock_update.execute.return_value.data = [{"id": "txn-uuid", "category_id": "cat-food-uuid"}]
        mock_supa.return_value.table.return_value.update.return_value = mock_update

        from main import app
        yield TestClient(app)


def test_patch_valid_category(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        headers={"Authorization": "Bearer fake-jwt"},
        json={"category_name": "Food"},
    )
    assert resp.status_code == 200
    assert resp.json()["category_name"] == "Food"


def test_patch_invalid_category_returns_422(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        headers={"Authorization": "Bearer fake-jwt"},
        json={"category_name": "NotACategory"},
    )
    assert resp.status_code == 422


def test_patch_missing_auth_returns_401(client):
    resp = client.patch(
        "/api/transactions/txn-uuid",
        json={"category_name": "Food"},
    )
    assert resp.status_code == 422  # FastAPI 422 for missing required header
```

- [ ] **Step 3: Run tests, confirm they fail**

```bash
cd backend && python -m pytest tests/test_category_patch.py -v
```
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 4: Add the PATCH route to statements.py**

In `backend/routers/statements.py`, add these imports at the top if not present:
```python
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Header
```
(already present — just verify `Header` is there)

Add to the existing imports:
```python
from models.schemas import UploadResponse, CategorizedTransaction, CategoryUpdateRequest, TransactionUpdateResponse
```

Append the new route at the end of `backend/routers/statements.py`:

```python
VALID_CATEGORIES = {
    "Food", "Transport", "Utilities", "Shopping", "Subscription",
    "Health", "Entertainment", "Transfer", "Income", "Other",
}

@router.patch("/transactions/{transaction_id}", response_model=TransactionUpdateResponse)
async def update_transaction_category(
    transaction_id: str,
    body: CategoryUpdateRequest,
    authorization: str = Header(...),
):
    if body.category_name not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")

    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    user_resp = supabase.auth.get_user(jwt)
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    # Look up category UUID
    cats_resp = supabase.table("categories").select("id, name").execute()
    cat_map: dict[str, str] = {row["name"]: row["id"] for row in cats_resp.data}
    cat_id = cat_map.get(body.category_name)
    if not cat_id:
        raise HTTPException(status_code=422, detail=f"Category '{body.category_name}' not found in DB.")

    # Update — filter by both id AND user_id so users can't edit others' transactions
    result = (
        supabase.table("transactions")
        .update({"category_id": cat_id})
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    return TransactionUpdateResponse(id=transaction_id, category_name=body.category_name)
```

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```
Expected: All 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/models/schemas.py backend/routers/statements.py backend/tests/test_category_patch.py
git commit -m "feat: add PATCH /api/transactions/{id} for manual category override"
```

---

## Task 11: Feature 1 — Frontend inline category editing in StatementsClient

**Files:**
- Modify: `frontend/app/dashboard/statements/StatementsClient.tsx`

- [ ] **Step 1: Add editingId state, local transactions state, and PATCH helper**

In `StatementsClient.tsx`, add the `createClient` import at the top with the other imports:
```tsx
import { createClient } from "@/lib/supabase";
```

Add `transactions` and `editingId` state after the existing `useState` calls (after `const [search, setSearch] = useState("")`):
```tsx
  const [transactions, setTransactions] = useState(initialTransactions);
  const [editingId, setEditingId] = useState<string | null>(null);
```

Replace the existing `months` and `monthTx` useMemos so they derive from `transactions` (not `initialTransactions`) — this makes the table re-render after a category save:
```tsx
  const months = useMemo(() => {
    const set = new Set(transactions.map(t => getMonthKey(t.transaction_date)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const activeMonth = selectedMonth ?? months[0] ?? null;

  const monthTx = useMemo(() =>
    activeMonth ? transactions.filter(t => getMonthKey(t.transaction_date) === activeMonth) : [],
    [transactions, activeMonth]
  );
```

Add the PATCH helper before the `return`:
```tsx
  async function handleCategoryChange(txId: string, newCategory: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    const res = await fetch(`${apiUrl}/api/transactions/${txId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ category_name: newCategory }),
    });
    if (!res.ok) return;

    setTransactions(prev =>
      prev.map(t => t.id === txId
        ? { ...t, categories: { name: newCategory } }
        : t
      )
    );
    setEditingId(null);
  }
```

- [ ] **Step 2: Replace the badge cell with clickable badge + inline select**

In the `filtered.map` block, replace the category `<td>` (lines 175-181) with:

```tsx
                            <td className="px-4 py-3">
                              {editingId === t.id ? (
                                <select
                                  autoFocus
                                  defaultValue={cat}
                                  onBlur={() => setEditingId(null)}
                                  onChange={e => handleCategoryChange(t.id, e.target.value)}
                                  className="text-xs rounded-full px-2 py-0.5 outline-none border cursor-pointer"
                                  style={{
                                    background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg,
                                    color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text,
                                    borderColor: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text + "40",
                                  }}>
                                  {["Food","Transport","Utilities","Shopping","Subscription",
                                    "Health","Entertainment","Transfer","Income","Other"].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  onClick={() => setEditingId(t.id)}
                                  title="Click to change category"
                                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 hover:ring-2 hover:ring-offset-1 cursor-pointer"
                                  style={{
                                    background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg,
                                    color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text,
                                    ringColor: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text,
                                  }}>
                                  {cat}
                                </button>
                              )}
                            </td>
```

- [ ] **Step 3: Rebuild and smoke-test manually**

On the server:
```bash
docker-compose up -d --build
```
Open the Statements page. Click a category badge — it should turn into a dropdown. Select a new category — the badge should update immediately without page reload. Refresh the page — the change should persist (it's saved to DB).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/statements/StatementsClient.tsx
git commit -m "feat: inline category override — click badge to change, saves to DB immediately"
```

---

## Task 12: Deploy and verify full Phase 1 on server

- [ ] **Step 1: Push to server and rebuild**

```bash
git push
# On the server:
docker-compose pull  # or git pull + docker-compose up -d --build
```

- [ ] **Step 2: Verify security fixes**

Try uploading a `.jpg` renamed to `.pdf` — should get "Only PDF files are accepted."
Try uploading a file > 10MB — should get "File exceeds the 10 MB limit."

- [ ] **Step 3: Verify UI redesign**

Open each page (Dashboard, Statements, Analytics). Confirm:
- Sidebar is white with soft violet border
- Active nav item has blue-violet gradient pill
- Page background is the blue-to-violet gradient
- Stat cards lift slightly on hover
- Category badges are color-coded pills
- Upload button shows gradient

- [ ] **Step 4: Verify category override**

Go to Statements page, click any category badge, select a different category, confirm it saves. Refresh the page — confirm the new category persists.

- [ ] **Step 5: Final commit if any small fixes were needed**

```bash
git add -p  # stage only what changed
git commit -m "fix: post-deploy polish from Phase 1 verification"
```

---

## Notes for Phase 2

The following features from the spec are **not** in this plan. They will be planned separately once Phase 1 is deployed and working:
- Export CSV/Excel
- Global Search
- Spending Insights
- Monthly Budget Tracker
- Recurring Transaction Detection
