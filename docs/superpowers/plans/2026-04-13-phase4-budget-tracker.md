# Phase 4: Monthly Budget Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set per-category monthly spending limits and see live progress bars on the Dashboard comparing actual spending to those limits.

**Architecture:** A `budgets` table in Supabase (one row per user+category) stores limits; two FastAPI endpoints handle read/upsert; a new `BudgetTracker` React component fetches budgets on mount and renders progress bars using spending data already available in `DashboardClient`.

**Tech Stack:** FastAPI + Supabase Python client (backend), Next.js 15 + Supabase SSR client (frontend), Supabase Postgres with RLS, pytest + FastAPI TestClient (tests).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| SQL (run manually) | `backend/migrations/004_budgets.sql` | `budgets` table + RLS policy |
| Create | `backend/routers/budgets.py` | `GET /api/budgets` + `PUT /api/budgets/{category}` |
| Create | `backend/tests/test_budgets.py` | Pytest tests for both endpoints |
| Modify | `backend/models/schemas.py` | Add `BudgetItem`, `BudgetsResponse`, `BudgetUpsertRequest` |
| Modify | `backend/main.py` | Register budgets router |
| Create | `frontend/components/BudgetTracker.tsx` | Progress bars + inline edit UI |
| Modify | `frontend/app/dashboard/DashboardClient.tsx` | Import + render BudgetTracker |

---

## Task 1: Supabase migration — `budgets` table

**Files:**
- Create: `backend/migrations/004_budgets.sql`

This SQL must be run once against your Supabase project (SQL Editor → paste → Run).

- [ ] **Step 1: Write the migration file**

Create `backend/migrations/004_budgets.sql` with this exact content:

```sql
create table if not exists public.budgets (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  category      text        not null,
  monthly_limit integer     not null check (monthly_limit > 0),
  updated_at    timestamptz not null default now(),
  unique(user_id, category)
);

alter table public.budgets enable row level security;

create policy "Users manage own budgets"
  on public.budgets
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute procedure public.set_updated_at();
```

- [ ] **Step 2: Run it in Supabase**

Open your Supabase project → SQL Editor → paste the file content → Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the table exists**

In Supabase Table Editor, confirm `budgets` appears with columns: `id`, `user_id`, `category`, `monthly_limit`, `updated_at`.

- [ ] **Step 4: Commit the migration file**

```bash
git add backend/migrations/004_budgets.sql
git commit -m "chore: add budgets table migration"
```

---

## Task 2: Backend schemas

**Files:**
- Modify: `backend/models/schemas.py`

The existing file ends at line 31 (after `InsightsResponse`). Append three new models.

- [ ] **Step 1: Write the failing test**

In `backend/tests/test_budgets.py`, add a quick import check:

```python
def test_budget_schemas_importable():
    from models.schemas import BudgetItem, BudgetsResponse, BudgetUpsertRequest
    item = BudgetItem(category="Food", monthly_limit=500000)
    assert item.category == "Food"
    assert item.monthly_limit == 500000
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd backend && python -m pytest tests/test_budgets.py::test_budget_schemas_importable -v
```

Expected: FAIL — `ImportError: cannot import name 'BudgetItem'`

- [ ] **Step 3: Add the schemas**

Open `backend/models/schemas.py` and append after the last line:

```python
from pydantic import Field as _Field

class BudgetItem(BaseModel):
    category: str
    monthly_limit: int

class BudgetsResponse(BaseModel):
    budgets: list[BudgetItem]

class BudgetUpsertRequest(BaseModel):
    monthly_limit: int = _Field(gt=0, description="Monthly spending limit in IDR, must be > 0")
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd backend && python -m pytest tests/test_budgets.py::test_budget_schemas_importable -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models/schemas.py backend/tests/test_budgets.py
git commit -m "feat: add budget Pydantic schemas"
```

---

## Task 3: Backend router — GET /api/budgets

**Files:**
- Create: `backend/routers/budgets.py`
- Modify: `backend/tests/test_budgets.py`

The `GET /api/budgets` endpoint returns all budgets for the authenticated user, ordered by category name.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_budgets.py`:

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

BUDGET_ROWS = [
    {"category": "Food",      "monthly_limit": 500000},
    {"category": "Transport", "monthly_limit": 200000},
]


@pytest.fixture
def client():
    with patch("routers.budgets._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-abc"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        chain = MagicMock()
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.execute.return_value = MagicMock(data=BUDGET_ROWS)
        mock_supa.return_value.table.return_value.select.return_value = chain

        from main import app
        yield TestClient(app)


def test_get_budgets_returns_list(client):
    resp = client.get("/api/budgets", headers={"Authorization": "Bearer fake-jwt"})
    assert resp.status_code == 200
    body = resp.json()
    assert "budgets" in body
    assert len(body["budgets"]) == 2
    assert body["budgets"][0]["category"] == "Food"
    assert body["budgets"][0]["monthly_limit"] == 500000


def test_get_budgets_missing_auth_returns_422():
    with patch("routers.budgets._get_supabase"):
        from main import app
        tc = TestClient(app)
        resp = tc.get("/api/budgets")
        assert resp.status_code == 422
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd backend && python -m pytest tests/test_budgets.py::test_get_budgets_returns_list -v
```

Expected: FAIL — `ImportError` or 404 (router not yet registered)

- [ ] **Step 3: Implement the router**

Create `backend/routers/budgets.py`:

```python
import os
import logging
from fastapi import APIRouter, HTTPException, Header
from supabase import create_client, Client
from dotenv import load_dotenv
from models.schemas import BudgetItem, BudgetsResponse, BudgetUpsertRequest

load_dotenv()

router = APIRouter()
_logger = logging.getLogger(__name__)

_supabase: Client | None = None

_VALID_BUDGET_CATS = {
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Other",
}


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


def _auth_user_id(supabase: Client, authorization: str) -> str:
    """Validate Bearer token and return user_id, or raise 401."""
    jwt = authorization.removeprefix("Bearer ").strip()
    try:
        user_resp = supabase.auth.get_user(jwt)
    except Exception as exc:
        _logger.warning("auth.get_user failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    return str(user_resp.user.id)


@router.get("/budgets", response_model=BudgetsResponse)
async def get_budgets(authorization: str = Header(...)):
    supabase = _get_supabase()
    user_id = _auth_user_id(supabase, authorization)

    try:
        result = (
            supabase.table("budgets")
            .select("category, monthly_limit")
            .eq("user_id", user_id)
            .order("category")
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase query failed in get_budgets: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve budgets.")

    return BudgetsResponse(budgets=[BudgetItem(**row) for row in result.data])
```

- [ ] **Step 4: Register the router temporarily in main.py for the test**

Open `backend/main.py` and add after the existing `app.include_router` lines:

```python
from routers import budgets
app.include_router(budgets.router, prefix="/api")
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd backend && python -m pytest tests/test_budgets.py::test_get_budgets_returns_list tests/test_budgets.py::test_get_budgets_missing_auth_returns_422 -v
```

Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/budgets.py backend/main.py backend/tests/test_budgets.py
git commit -m "feat: add GET /api/budgets endpoint"
```

---

## Task 4: Backend router — PUT /api/budgets/{category}

**Files:**
- Modify: `backend/routers/budgets.py`
- Modify: `backend/tests/test_budgets.py`

The `PUT /api/budgets/{category}` endpoint upserts (insert-or-update) a budget row for the authenticated user.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_budgets.py`:

```python
@pytest.fixture
def put_client():
    """Separate fixture for PUT tests — upsert returns one row."""
    with patch("routers.budgets._get_supabase") as mock_supa:
        mock_user = MagicMock()
        mock_user.user.id = "user-abc"
        mock_supa.return_value.auth.get_user.return_value = mock_user

        upsert_chain = MagicMock()
        upsert_chain.execute.return_value = MagicMock(
            data=[{"category": "Food", "monthly_limit": 600000}]
        )
        mock_supa.return_value.table.return_value.upsert.return_value = upsert_chain

        from main import app
        yield TestClient(app)


def test_put_budget_creates_entry(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": 600000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == "Food"
    assert body["monthly_limit"] == 600000


def test_put_budget_invalid_category(put_client):
    resp = put_client.put(
        "/api/budgets/InvalidCat",
        json={"monthly_limit": 100000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_put_budget_zero_limit_returns_422(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": 0},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422


def test_put_budget_negative_limit_returns_422(put_client):
    resp = put_client.put(
        "/api/budgets/Food",
        json={"monthly_limit": -1000},
        headers={"Authorization": "Bearer fake-jwt"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_budgets.py::test_put_budget_creates_entry tests/test_budgets.py::test_put_budget_invalid_category -v
```

Expected: FAIL — 404 (route not implemented yet)

- [ ] **Step 3: Add the PUT route to `backend/routers/budgets.py`**

Append after the `get_budgets` function:

```python
from datetime import datetime, timezone


@router.put("/budgets/{category}", response_model=BudgetItem)
async def upsert_budget(
    category: str,
    body: BudgetUpsertRequest,
    authorization: str = Header(...),
):
    if category not in _VALID_BUDGET_CATS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Must be one of: {sorted(_VALID_BUDGET_CATS)}",
        )

    supabase = _get_supabase()
    user_id = _auth_user_id(supabase, authorization)

    try:
        result = (
            supabase.table("budgets")
            .upsert(
                {
                    "user_id": user_id,
                    "category": category,
                    "monthly_limit": body.monthly_limit,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id,category",
            )
            .execute()
        )
    except Exception as exc:
        _logger.error("Supabase upsert failed in upsert_budget: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save budget.")

    row = result.data[0]
    return BudgetItem(category=row["category"], monthly_limit=row["monthly_limit"])
```

- [ ] **Step 4: Run all budget tests**

```bash
cd backend && python -m pytest tests/test_budgets.py -v
```

Expected: all 8 tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd backend && python -m pytest -v
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/budgets.py backend/tests/test_budgets.py
git commit -m "feat: add PUT /api/budgets/{category} endpoint"
```

---

## Task 5: Frontend BudgetTracker component

**Files:**
- Create: `frontend/components/BudgetTracker.tsx`

This component owns its own data fetching (budgets list from the API) and receives spending data as a prop from the parent.

- [ ] **Step 1: Read the existing color map in AnalyticsClient**

Open `frontend/app/dashboard/analytics/AnalyticsClient.tsx` lines 27–31 to confirm the `CAT_COLORS` map. You will copy it verbatim into BudgetTracker.

```tsx
const CAT_COLORS: Record<string, string> = {
  Food: "#F97316", Shopping: "#8B5CF6", Transport: "#06B6D4",
  Entertainment: "#EC4899", Health: "#10B981", Bills: "#F59E0B",
  Education: "#3B82F6", Travel: "#14B8A6", Investment: "#6366F1", Other: "#94A3B8",
  Utilities: "#F59E0B", Subscription: "#6366F1",
};
```

- [ ] **Step 2: Create `frontend/components/BudgetTracker.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Target, Pencil, Check, X, Plus } from "lucide-react";

interface Budget {
  category: string;
  monthly_limit: number;
}

const CAT_COLORS: Record<string, string> = {
  Food: "#F97316", Shopping: "#8B5CF6", Transport: "#06B6D4",
  Entertainment: "#EC4899", Health: "#10B981", Utilities: "#F59E0B",
  Subscription: "#6366F1", Other: "#94A3B8",
};

const VALID_CATS = [
  "Food", "Transport", "Utilities", "Shopping",
  "Subscription", "Health", "Entertainment", "Other",
];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export function BudgetTracker({ spendByCategory }: { spendByCategory: Record<string, number> }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newCat, setNewCat] = useState(VALID_CATS[0]);
  const [newLimit, setNewLimit] = useState("");

  useEffect(() => { fetchBudgets(); }, []);

  async function fetchBudgets() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res = await fetch(`${apiUrl}/api/budgets`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBudgets(data.budgets ?? []);
    } catch (err) {
      console.error("Failed to fetch budgets:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveBudget(category: string, monthly_limit: number) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res = await fetch(`${apiUrl}/api/budgets/${encodeURIComponent(category)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ monthly_limit }),
      });
      if (!res.ok) return;
      const saved: Budget = await res.json();
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.category === category);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved].sort((a, b) => a.category.localeCompare(b.category));
      });
    } catch (err) {
      console.error("Failed to save budget:", err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cat: string, currentLimit: number) {
    setEditingCat(cat);
    setEditValue(String(currentLimit));
  }

  async function commitEdit(cat: string) {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val > 0) {
      await saveBudget(cat, val);
    }
    setEditingCat(null);
  }

  async function commitNew() {
    const val = parseInt(newLimit, 10);
    if (!isNaN(val) && val > 0) {
      await saveBudget(newCat, val);
    }
    setAddingNew(false);
    setNewLimit("");
    setNewCat(VALID_CATS[0]);
  }

  const availableCats = VALID_CATS.filter(c => !budgets.find(b => b.category === c));

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-gradient)" }}>
            <Target size={13} style={{ color: "#fff" }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
            Monthly Budgets
          </h3>
        </div>
        {!addingNew && availableCats.length > 0 && (
          <button
            onClick={() => { setAddingNew(true); setNewCat(availableCats[0]); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-main)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Plus size={12} /> Set Budget
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl shimmer" />)}
        </div>
      )}

      {/* Budget rows */}
      {!loading && budgets.length === 0 && !addingNew && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No budgets set. Use "Set Budget" to add a monthly spending limit.
        </p>
      )}

      {!loading && (
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = spendByCategory[budget.category] ?? 0;
            const pct   = Math.min(100, (spent / budget.monthly_limit) * 100);
            const over  = spent > budget.monthly_limit;
            const color = over ? "#EF4444" : (CAT_COLORS[budget.category] ?? "#94A3B8");
            const isEditing = editingCat === budget.category;

            return (
              <div key={budget.category}>
                {isEditing ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "var(--bg-main)" }}>
                    <span className="text-xs font-semibold w-24 shrink-0"
                      style={{ color: "var(--text-primary)" }}>{budget.category}</span>
                    <span className="text-xs mr-1" style={{ color: "var(--text-muted)" }}>Rp</span>
                    <input
                      type="number" min={1} value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(budget.category); if (e.key === "Escape") setEditingCat(null); }}
                      autoFocus
                      className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                    <button onClick={() => commitEdit(budget.category)} disabled={saving}
                      className="p-1 rounded-lg hover:opacity-80 transition-all"
                      style={{ background: "#10B98120" }}>
                      <Check size={13} style={{ color: "#10B981" }} />
                    </button>
                    <button onClick={() => setEditingCat(null)}
                      className="p-1 rounded-lg hover:opacity-80 transition-all"
                      style={{ background: "#EF444420" }}>
                      <X size={13} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                ) : (
                  <div className="group px-3 py-2 rounded-xl" style={{ background: "var(--bg-main)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                          {budget.category}
                        </span>
                        {over && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#EF444420", color: "#EF4444" }}>
                            over budget
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: over ? "#EF4444" : "var(--text-muted)" }}>
                          Rp {formatCurrency(spent)} / Rp {formatCurrency(budget.monthly_limit)}
                        </span>
                        <button
                          onClick={() => startEdit(budget.category, budget.monthly_limit)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ background: "var(--bg-card)" }}>
                          <Pencil size={11} style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new budget inline form */}
          {addingNew && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "var(--bg-main)", border: "1px dashed var(--border)" }}>
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                className="text-xs rounded-lg px-2 py-1 outline-none w-28"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Rp</span>
              <input
                type="number" min={1} value={newLimit} placeholder="e.g. 500000"
                onChange={e => setNewLimit(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") setAddingNew(false); }}
                autoFocus
                className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button onClick={commitNew} disabled={saving || !newLimit}
                className="p-1 rounded-lg hover:opacity-80 transition-all"
                style={{ background: "#10B98120" }}>
                <Check size={13} style={{ color: "#10B981" }} />
              </button>
              <button onClick={() => setAddingNew(false)}
                className="p-1 rounded-lg hover:opacity-80 transition-all"
                style={{ background: "#EF444420" }}>
                <X size={13} style={{ color: "#EF4444" }} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/BudgetTracker.tsx
git commit -m "feat: add BudgetTracker component with progress bars and inline edit"
```

---

## Task 6: Wire BudgetTracker into DashboardClient

**Files:**
- Modify: `frontend/app/dashboard/DashboardClient.tsx`

Add the `spendByCategory` memo and render `<BudgetTracker>` below the main grid when a specific month is selected.

- [ ] **Step 1: Open DashboardClient.tsx and locate the imports (line 1–10) and the useMemo block (lines 54–62)**

The current `useMemo` block computes `pieData`, `barData`, `totalExpense`, `totalIncome`. You will add a new `useMemo` for `spendByCategory` after line 62.

- [ ] **Step 2: Add the import and new memo**

At the top of the file, add the import after the existing imports:

```tsx
import { BudgetTracker } from "@/components/BudgetTracker";
```

After the `totalIncome` useMemo (around line 62), add:

```tsx
const spendByCategory = useMemo(() => {
  const map: Record<string, number> = {};
  for (const t of filtered) {
    if (t.amount >= 0) continue;
    const cat = t.categories?.name ?? "Other";
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return map;
}, [filtered]);
```

- [ ] **Step 3: Add BudgetTracker below the main grid**

In the JSX, after the closing `</div>` of the main grid (the `grid grid-cols-1 lg:grid-cols-3 gap-4` div, around line 130), add:

```tsx
{/* Budget Tracker — only when a specific month is selected */}
{selectedMonth !== "all" && (
  <div className="mt-4">
    <BudgetTracker spendByCategory={spendByCategory} />
  </div>
)}
```

- [ ] **Step 4: Start the frontend dev server and verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/dashboard` in the browser.
- Select a month → BudgetTracker card appears at the bottom
- Click "Set Budget" → inline form with category dropdown and number input
- Set a budget for Food → progress bar appears using the month's actual food spending
- Hover a budget row → pencil edit icon appears
- Click pencil → inline input, Enter saves, Escape cancels
- Switch to "All Time" → BudgetTracker disappears

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/DashboardClient.tsx
git commit -m "feat: wire BudgetTracker into Dashboard page"
```

---

## Task 7: Push to remote

- [ ] **Step 1: Run all backend tests one final time**

```bash
cd backend && python -m pytest -v
```

Expected: all tests PASS (no regressions)

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ `budgets` table with RLS — Task 1
- ✅ `GET /api/budgets` — Task 3
- ✅ `PUT /api/budgets/{category}` — Task 4
- ✅ Backend tests (8 tests covering happy paths, auth, validation) — Tasks 2–4
- ✅ Progress bars on Dashboard — Task 5
- ✅ Inline edit of limits — Task 5
- ✅ Add new budget for a category — Task 5
- ✅ Over-budget visual indicator — Task 5 (red bar + "over budget" badge)
- ✅ Only shown for a specific month (not "all") — Task 6

**Placeholder scan:** None found. All steps have exact code.

**Type consistency:**
- `BudgetItem` used in `BudgetsResponse.budgets[]`, returned by `upsert_budget`, consumed in `BudgetTracker` as `Budget` interface — both have `category: string, monthly_limit: number`. ✅
- `spendByCategory: Record<string, number>` defined in DashboardClient and accepted by BudgetTracker prop. ✅
