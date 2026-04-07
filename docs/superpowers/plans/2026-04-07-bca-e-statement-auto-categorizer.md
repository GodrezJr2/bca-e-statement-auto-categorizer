# BCA e-Statement Auto-Categorizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that lets a BCA bank user upload their encrypted PDF e-statement, auto-categorize transactions via LLM, and visualize spending on a dashboard.

**Architecture:** A Next.js (App Router) frontend communicates with a Python FastAPI backend for PDF decryption and parsing (using `pdfplumber`), an LLM API for categorization, and Supabase (PostgreSQL + Auth) for persistence and RLS-secured data access.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Shadcn UI, Recharts, Python FastAPI, pdfplumber, Supabase (Auth + PostgreSQL), Gemini/OpenAI API

> **Note (per PRD §6):** The PRD requires user confirmation between each of the 4 phases below. After completing each phase, pause and wait for confirmation before proceeding.

---

## File Structure

```
f:/Project/E-Statement Project/
├── supabase/
│   └── schema.sql                    # Full DB schema + RLS policies
│
├── backend/                          # Python FastAPI service
│   ├── main.py                       # App entry point, CORS, router registration
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Env var template
│   ├── routers/
│   │   └── statements.py             # POST /upload-statement endpoint
│   ├── services/
│   │   ├── pdf_parser.py             # PDF decrypt + table extraction (pdfplumber)
│   │   └── categorizer.py           # LLM batch categorization
│   └── models/
│       └── schemas.py                # Pydantic request/response models
│
└── frontend/                         # Next.js app
    ├── package.json
    ├── tailwind.config.ts
    ├── app/
    │   ├── layout.tsx                # Root layout with Supabase auth provider
    │   ├── page.tsx                  # Auth redirect root
    │   ├── login/
    │   │   └── page.tsx              # Login form
    │   ├── dashboard/
    │   │   └── page.tsx              # Dashboard: charts + upload
    │   └── api/
    │       └── transactions/
    │           └── route.ts          # Next.js route: proxy to Supabase reads
    ├── components/
    │   ├── UploadForm.tsx            # PDF upload + password input form
    │   ├── SpendingPieChart.tsx      # Recharts pie chart by category
    │   └── DailyBarChart.tsx         # Recharts bar chart daily spending
    └── lib/
        ├── supabase.ts               # Supabase client (browser)
        └── supabase-server.ts        # Supabase client (server components)
```

---

## Phase 1: Supabase SQL Schema + RLS

### Task 1: Write the database schema SQL

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create the schema file**

```sql
-- supabase/schema.sql

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- categories table
create table categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('Income', 'Expense'))
);

-- Seed default categories
insert into categories (name, type) values
  ('Food',         'Expense'),
  ('Transport',    'Expense'),
  ('Utilities',    'Expense'),
  ('Shopping',     'Expense'),
  ('Subscription', 'Expense'),
  ('Health',       'Expense'),
  ('Entertainment','Expense'),
  ('Transfer',     'Expense'),
  ('Income',       'Income'),
  ('Other',        'Expense');

-- transactions table
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null,
  description      text not null,
  amount           numeric(18, 2) not null,   -- negative = debit, positive = credit
  category_id      uuid references categories(id),
  created_at       timestamptz default now()
);

-- Index for fast per-user queries
create index transactions_user_id_idx on transactions(user_id);
create index transactions_date_idx    on transactions(transaction_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table transactions enable row level security;
alter table categories    enable row level security;

-- categories: everyone can read, only service role can write
create policy "categories_read_all"
  on categories for select using (true);

-- transactions: users can only see/insert/update/delete their own rows
create policy "transactions_select_own"
  on transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on transactions for update
  using (auth.uid() = user_id);

create policy "transactions_delete_own"
  on transactions for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Run schema in Supabase SQL Editor**

Open your Supabase project → SQL Editor → paste the contents of `supabase/schema.sql` → Run.

Expected: all statements succeed, tables `categories` and `transactions` appear in the Table Editor, 10 seed rows visible in `categories`.

- [ ] **Step 3: Verify RLS is active**

In Supabase Table Editor → `transactions` → Auth Policies — confirm 4 policies listed.
In `categories` → Auth Policies — confirm 1 `select` policy.

> **PAUSE — wait for user confirmation before Phase 2.**

---

## Phase 2: Python FastAPI Backend (PDF Upload + Parsing)

### Task 2: Project scaffold and dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/main.py`

- [ ] **Step 1: Create `requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
pdfplumber==0.11.0
pikepdf==8.15.1
python-multipart==0.0.9
supabase==2.5.0
python-dotenv==1.0.1
openai==1.30.1
google-generativeai==0.6.0
pydantic==2.7.1
```

- [ ] **Step 2: Create `.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LLM_PROVIDER=gemini          # or "openai"
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

Copy to `.env` and fill in real values.

- [ ] **Step 3: Install dependencies**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 4: Create `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import statements

app = FastAPI(title="BCA e-Statement API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(statements.router, prefix="/api")
```

- [ ] **Step 5: Start the server**

```bash
uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.` in console. `http://localhost:8000/docs` shows Swagger UI.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: scaffold FastAPI backend with dependencies"
```

---

### Task 3: Pydantic schemas

**Files:**
- Create: `backend/models/schemas.py`

- [ ] **Step 1: Create `backend/models/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/models/schemas.py`**

```python
from pydantic import BaseModel
from datetime import date
from typing import Optional
import uuid


class Transaction(BaseModel):
    transaction_date: date
    description: str
    amount: float           # negative = debit, positive = credit
    balance: Optional[float] = None


class CategorizedTransaction(BaseModel):
    transaction_date: date
    description: str
    amount: float
    category_name: str


class UploadResponse(BaseModel):
    inserted: int
    transactions: list[CategorizedTransaction]
```

- [ ] **Step 3: Commit**

```bash
git add backend/models/
git commit -m "feat: add Pydantic schemas for transactions"
```

---

### Task 4: PDF parser service

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/pdf_parser.py`

- [ ] **Step 1: Create `backend/services/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/services/pdf_parser.py`**

```python
import io
import re
from datetime import date
import pikepdf
import pdfplumber
from models.schemas import Transaction


# Matches BCA statement rows: DD/MM/YY  description  debit  credit  balance
# Example: "07/01/25  TRANSFER DANA  500.000,00    1.234.567,89"
_ROW_RE = re.compile(
    r"(\d{2}/\d{2}/\d{2})\s+"          # date
    r"(.+?)\s+"                         # description (non-greedy)
    r"([\d.,]+)?\s*"                    # debit (optional)
    r"([\d.,]+)?\s*"                    # credit (optional)
    r"([\d.,]+)\s*$"                    # balance (required at line end)
)


def _parse_amount(raw: str | None) -> float | None:
    """Convert Indonesian number format '1.234.567,89' → 1234567.89"""
    if not raw:
        return None
    return float(raw.replace(".", "").replace(",", "."))


def decrypt_and_extract(pdf_bytes: bytes, password: str) -> list[Transaction]:
    """
    Decrypt a password-protected BCA PDF in memory and extract transactions.
    Returns a list of Transaction objects.
    Raises ValueError if password is wrong or no transactions found.
    """
    # Step 1: decrypt in memory using pikepdf
    try:
        with pikepdf.open(io.BytesIO(pdf_bytes), password=password) as pdf:
            decrypted_buf = io.BytesIO()
            pdf.save(decrypted_buf)
            decrypted_buf.seek(0)
    except pikepdf.PasswordError:
        raise ValueError("Incorrect PDF password.")

    # Step 2: extract text lines with pdfplumber
    transactions: list[Transaction] = []
    with pdfplumber.open(decrypted_buf) as plumber_pdf:
        for page in plumber_pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                m = _ROW_RE.match(line.strip())
                if not m:
                    continue
                date_str, desc, debit_raw, credit_raw, balance_raw = m.groups()
                day, month, year = date_str.split("/")
                tx_date = date(2000 + int(year), int(month), int(day))

                debit  = _parse_amount(debit_raw)
                credit = _parse_amount(credit_raw)
                balance = _parse_amount(balance_raw)

                # BCA: debit column = money out (negative), credit = money in (positive)
                if credit is not None:
                    amount = credit
                elif debit is not None:
                    amount = -debit
                else:
                    continue

                transactions.append(Transaction(
                    transaction_date=tx_date,
                    description=desc.strip(),
                    amount=amount,
                    balance=balance,
                ))

    if not transactions:
        raise ValueError("No transactions found. Check PDF format or password.")

    return transactions
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/pdf_parser.py backend/services/__init__.py
git commit -m "feat: implement in-memory PDF decryption and transaction parsing"
```

---

### Task 5: Upload endpoint (without categorization yet)

**Files:**
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/statements.py`

- [ ] **Step 1: Create `backend/routers/__init__.py`** (empty file)

- [ ] **Step 2: Create `backend/routers/statements.py`**

```python
import os
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Header
from supabase import create_client, Client
from dotenv import load_dotenv
from services.pdf_parser import decrypt_and_extract
from services.categorizer import categorize_transactions
from models.schemas import UploadResponse, CategorizedTransaction

load_dotenv()

router = APIRouter()

def _get_supabase() -> Client:
    url  = os.environ["SUPABASE_URL"]
    key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@router.post("/upload-statement", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    password: str    = Form(...),
    authorization: str = Header(...),   # Bearer <supabase JWT>
):
    # 1. Authenticate user via Supabase JWT
    supabase = _get_supabase()
    jwt = authorization.removeprefix("Bearer ").strip()
    user_resp = supabase.auth.get_user(jwt)
    if not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")
    user_id = str(user_resp.user.id)

    # 2. Read PDF bytes in memory (never write to disk)
    pdf_bytes = await file.read()

    # 3. Decrypt + parse
    try:
        transactions = decrypt_and_extract(pdf_bytes, password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # 4. Auto-categorize
    categorized = await categorize_transactions(transactions)

    # 5. Look up category UUIDs from DB
    cats_resp = supabase.table("categories").select("id, name").execute()
    cat_map = {row["name"]: row["id"] for row in cats_resp.data}

    # 6. Bulk-insert transactions
    rows = [
        {
            "user_id":          user_id,
            "transaction_date": str(ct.transaction_date),
            "description":      ct.description,
            "amount":           ct.amount,
            "category_id":      cat_map.get(ct.category_name, cat_map.get("Other")),
        }
        for ct in categorized
    ]
    supabase.table("transactions").insert(rows).execute()

    return UploadResponse(inserted=len(rows), transactions=categorized)
```

- [ ] **Step 3: Verify app still starts**

```bash
uvicorn main:app --reload --port 8000
```

Expected: startup succeeds, `/docs` shows `POST /api/upload-statement`.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/
git commit -m "feat: add /api/upload-statement endpoint"
```

> **PAUSE — wait for user confirmation before Phase 3.**

---

## Phase 3: LLM Auto-Categorization

### Task 6: Categorizer service

**Files:**
- Create: `backend/services/categorizer.py`

- [ ] **Step 1: Create `backend/services/categorizer.py`**

```python
import os
import json
from dotenv import load_dotenv
from models.schemas import Transaction, CategorizedTransaction

load_dotenv()

CATEGORIES = [
    "Food", "Transport", "Utilities", "Shopping",
    "Subscription", "Health", "Entertainment", "Transfer", "Income", "Other"
]

_SYSTEM_PROMPT = (
    "You are a financial transaction categorizer. "
    "Given a list of bank transaction descriptions, return a JSON array "
    "where each element is one of these categories: "
    + ", ".join(CATEGORIES) + ". "
    "Respond ONLY with the JSON array, no explanation. "
    "The array must have exactly the same length as the input array."
)


async def _call_gemini(descriptions: list[str]) -> list[str]:
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config={"response_mime_type": "application/json"},
    )
    prompt = _SYSTEM_PROMPT + "\n\nDescriptions:\n" + json.dumps(descriptions)
    response = model.generate_content(prompt)
    return json.loads(response.text)


async def _call_openai(descriptions: list[str]) -> list[str]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": "Descriptions:\n" + json.dumps(descriptions)},
        ],
    )
    # Model returns {"categories": [...]} when using json_object mode
    data = json.loads(response.choices[0].message.content)
    # Handle both {"categories": [...]} and direct array
    if isinstance(data, list):
        return data
    return data.get("categories", [])


_BATCH_SIZE = 50   # stay within token limits


async def categorize_transactions(
    transactions: list[Transaction],
) -> list[CategorizedTransaction]:
    """
    Send transaction descriptions to the configured LLM in batches.
    Returns CategorizedTransaction list in the same order.
    """
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
    call_fn  = _call_gemini if provider == "gemini" else _call_openai

    all_categories: list[str] = []

    for i in range(0, len(transactions), _BATCH_SIZE):
        batch = transactions[i : i + _BATCH_SIZE]
        descs = [t.description for t in batch]
        cats  = await call_fn(descs)

        # Safety: if LLM returns wrong length, fall back to "Other"
        if len(cats) != len(batch):
            cats = ["Other"] * len(batch)

        # Validate each category name
        valid = set(CATEGORIES)
        all_categories.extend(c if c in valid else "Other" for c in cats)

    return [
        CategorizedTransaction(
            transaction_date=t.transaction_date,
            description=t.description,
            amount=t.amount,
            category_name=cat,
        )
        for t, cat in zip(transactions, all_categories)
    ]
```

- [ ] **Step 2: Verify import works**

```bash
cd backend && python -c "from services.categorizer import categorize_transactions; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/categorizer.py
git commit -m "feat: LLM categorization service supporting Gemini and OpenAI"
```

---

### Task 7: Manual smoke test of the full backend

- [ ] **Step 1: Start backend**

```bash
cd backend && uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Test with curl (replace `<JWT>` and `<PDF_PATH>` and `<DOB>`)**

```bash
curl -X POST http://localhost:8000/api/upload-statement \
  -H "Authorization: Bearer <JWT>" \
  -F "file=@<PDF_PATH>" \
  -F "password=<DOB>"
```

Expected: JSON response with `inserted` count and `transactions` array containing `category_name` values from the CATEGORIES list.

- [ ] **Step 3: Check Supabase table**

In Supabase Table Editor → `transactions` → verify rows were inserted with correct `user_id`, `amount`, and `category_id`.

> **PAUSE — wait for user confirmation before Phase 4.**

---

## Phase 4: Next.js Frontend

### Task 8: Scaffold Next.js project

**Files:**
- Create: `frontend/` (Next.js project)

- [ ] **Step 1: Create Next.js app**

```bash
cd "f:/Project/E-Statement Project"
npx create-next-app@latest frontend \
  --typescript --tailwind --app --no-src-dir \
  --import-alias "@/*" --no-eslint
```

Expected: `frontend/` directory created.

- [ ] **Step 2: Install extra dependencies**

```bash
cd frontend
npm install @supabase/supabase-js @supabase/ssr recharts lucide-react
npx shadcn@latest init -y
npx shadcn@latest add button input label card
```

Expected: no errors.

- [ ] **Step 3: Create `frontend/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 4: Commit scaffold**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold Next.js frontend with Tailwind and Shadcn"
```

---

### Task 9: Supabase client helpers

**Files:**
- Create: `frontend/lib/supabase.ts`
- Create: `frontend/lib/supabase-server.ts`

- [ ] **Step 1: Create `frontend/lib/supabase.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create `frontend/lib/supabase-server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/
git commit -m "feat: add Supabase browser and server client helpers"
```

---

### Task 10: Authentication (login page + root redirect)

**Files:**
- Create: `frontend/app/login/page.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create `frontend/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Replace `frontend/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  else redirect("/login");
}
```

- [ ] **Step 3: Update `frontend/app/layout.tsx`** — keep the default but ensure no body padding conflicts with full-screen pages:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCA e-Statement",
  description: "Auto-categorize your BCA bank statements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Start dev server and verify redirect**

```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:3000` — should redirect to `/login`. Login with a Supabase user → should redirect to `/dashboard` (404 is OK for now).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/
git commit -m "feat: auth login page with Supabase and root redirect"
```

---

### Task 11: Upload form component

**Files:**
- Create: `frontend/components/UploadForm.tsx`

- [ ] **Step 1: Create `frontend/components/UploadForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadFormProps {
  onSuccess: () => void;  // called after successful upload to refresh data
}

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus]     = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setMessage(null);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus("error"); setMessage("Not authenticated."); return; }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/upload-statement`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      setStatus("error");
      setMessage(err.detail ?? "Upload failed.");
      return;
    }

    const data = await res.json();
    setStatus("done");
    setMessage(`Inserted ${data.inserted} transactions.`);
    setFile(null);
    setPassword("");
    onSuccess();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Upload e-Statement</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pdf">PDF File</Label>
            <Input id="pdf" type="file" accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdfpw">PDF Password (DDMMYYYY)</Label>
            <Input id="pdfpw" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. 01011990" required />
          </div>
          {message && (
            <p className={`text-sm ${status === "error" ? "text-red-500" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <Button type="submit" disabled={status === "uploading"} className="w-full">
            {status === "uploading" ? "Processing…" : "Upload & Analyze"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/UploadForm.tsx
git commit -m "feat: UploadForm component with JWT auth and in-memory PDF handling"
```

---

### Task 12: Recharts components

**Files:**
- Create: `frontend/components/SpendingPieChart.tsx`
- Create: `frontend/components/DailyBarChart.tsx`

- [ ] **Step 1: Create `frontend/components/SpendingPieChart.tsx`**

```tsx
"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = [
  "#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899",
  "#8b5cf6","#f97316","#14b8a6","#ef4444","#a3e635",
];

interface ChartEntry { name: string; value: number; }

interface Props { data: ChartEntry[]; }

export function SpendingPieChart({ data }: Props) {
  if (!data.length) return <p className="text-sm text-gray-400">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => `Rp ${v.toLocaleString("id-ID")}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create `frontend/components/DailyBarChart.tsx`**

```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ChartEntry { date: string; amount: number; }

interface Props { data: ChartEntry[]; }

export function DailyBarChart({ data }: Props) {
  if (!data.length) return <p className="text-sm text-gray-400">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
        <Tooltip formatter={(v: number) => `Rp ${v.toLocaleString("id-ID")}`} />
        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SpendingPieChart.tsx frontend/components/DailyBarChart.tsx
git commit -m "feat: Recharts pie and bar chart components"
```

---

### Task 13: Dashboard page

**Files:**
- Create: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Create `frontend/app/dashboard/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch transactions with category name
  const { data: transactions } = await supabase
    .from("transactions")
    .select("transaction_date, description, amount, categories(name)")
    .order("transaction_date", { ascending: false });

  return <DashboardClient initialTransactions={transactions ?? []} />;
}
```

- [ ] **Step 2: Create `frontend/app/dashboard/DashboardClient.tsx`**

```tsx
"use client";
import { useState } from "react";
import { UploadForm } from "@/components/UploadForm";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import { createClient } from "@/lib/supabase";

interface Transaction {
  transaction_date: string;
  description: string;
  amount: number;
  categories: { name: string } | null;
}

interface Props { initialTransactions: Transaction[]; }

function buildPieData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue; // skip income for expense chart
    const cat = t.categories?.name ?? "Other";
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function buildBarData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const d = t.transaction_date;
    map[d] = (map[d] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
}

export default function DashboardClient({ initialTransactions }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);

  async function refreshTransactions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("transaction_date, description, amount, categories(name)")
      .order("transaction_date", { ascending: false });
    setTransactions(data ?? []);
  }

  const pieData = buildPieData(transactions);
  const barData = buildBarData(transactions);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-6">BCA e-Statement Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <UploadForm onSuccess={refreshTransactions} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Spending by Category</h2>
            <SpendingPieChart data={pieData} />
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Daily Spending</h2>
            <DailyBarChart data={barData} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify dashboard renders**

```bash
cd frontend && npm run dev
```

Log in → should see the dashboard layout with upload form and empty charts.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/
git commit -m "feat: dashboard page with charts and upload integration"
```

---

## Self-Review Against Spec

| PRD Requirement | Covered in |
|---|---|
| Auth via Supabase | Task 10, login page + server-side redirect |
| Upload PDF + input password | Task 11, UploadForm component |
| Decrypt PDF in memory | Task 4, `decrypt_and_extract` uses pikepdf in RAM |
| Extract tabular data with regex | Task 4, `_ROW_RE` regex in `pdf_parser.py` |
| Standardize Date/Description/Amount/Balance | Task 4, `Transaction` Pydantic model |
| LLM batch categorization | Task 6, `categorize_transactions` |
| JSON output from LLM | Task 6, Gemini `response_mime_type=application/json` / OpenAI `json_object` |
| Persist to Supabase | Task 5, bulk insert in `/api/upload-statement` |
| RLS: users see only their data | Task 1, 4 RLS policies on `transactions` |
| PDF/password never stored | Task 4, 5 — `pdf_bytes` is in-memory, password never logged |
| Pie chart (category) | Task 12, `SpendingPieChart` |
| Bar chart (daily) | Task 12, `DailyBarChart` |
| Node.js NOT used for PDF parsing | Python FastAPI handles all PDF work |
