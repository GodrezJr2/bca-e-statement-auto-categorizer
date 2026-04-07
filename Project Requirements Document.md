# Project Requirements Document (PRD): BCA e-Statement Auto-Categorizer

## 1. Project Overview
A web-based application to automate the extraction, parsing, and categorization of BCA (Bank Central Asia) monthly e-statements (PDFs). The app will provide a dashboard for personal financial analytics.

## 2. Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn UI, Recharts (for analytics).
- **Backend (API & PDF Processing):** Python (FastAPI). Node.js/Next.js API is strictly prohibited for PDF parsing due to poor tabular extraction capabilities. Use `pdfplumber` or `PyMuPDF`.
- **Database & Auth:** Supabase (PostgreSQL).
- **Categorization Engine:** LLM API (Gemini/OpenAI) with structured JSON output.

## 3. Core Features & User Flow
1. **Authentication:** User login via Supabase Auth.
2. **Upload & Decrypt:** User uploads the BCA e-statement PDF and inputs the PDF password (DOB format: DDMMYYYY).
3. **Data Extraction (Python Backend):**
   - Decrypt PDF in memory (ephemeral, do not save to disk).
   - Extract tabular transaction data using Regex to filter out headers/footers.
   - Standardize data fields: `Date`, `Description`, `Amount` (Debit/Credit), `Balance`.
4. **Auto-Categorization (LLM):**
   - Send batched transaction descriptions to LLM.
   - Receive standardized categories (e.g., Food, Transport, Utilities, Income, Subscription).
5. **Data Persistence:** Save structured data to Supabase PostgreSQL.
6. **Dashboard:** Display monthly spending by category (Pie Chart) and daily spending trends (Bar Chart).

## 4. Database Schema (Supabase)
Draft the SQL schema for the following tables:
- `users`: Managed by Supabase Auth.
- `transactions`: 
  - `id` (UUID, PK)
  - `user_id` (UUID, FK)
  - `transaction_date` (Date)
  - `description` (Text)
  - `amount` (Numeric/Decimal, negative for debit, positive for credit)
  - `category_id` (UUID, FK)
  - `created_at` (Timestamp)
- `categories`:
  - `id` (UUID, PK)
  - `name` (String)
  - `type` (Enum: Income, Expense)

## 5. Security & Privacy Constraints
- PDF files and passwords must not be stored in the database or server logs.
- PDF processing must happen in memory (RAM).
- Supabase Row Level Security (RLS) must be enabled so users can only access their own data.

## 6. Action Items for Claude
Based on this PRD, please execute the following steps sequentially. Wait for my confirmation after each step before proceeding to the next.

1. **Step 1:** Generate the complete Supabase SQL schema including Row Level Security (RLS) policies.
2. **Step 2:** Write the Python FastAPI backend code for PDF upload, decryption, and parsing using `pdfplumber`.
3. **Step 3:** Write the LLM integration logic for auto-categorization, enforcing a JSON output schema.
4. **Step 4:** Generate the Next.js frontend structure, including the upload form and Recharts dashboard.