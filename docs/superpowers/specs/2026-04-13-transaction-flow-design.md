# Transaction Flow Visualization Design

**Date:** 2026-04-13  
**Scope:** Interactive Sankey diagram visualization showing money flow between categories, accounts, time periods, and merchants. New dedicated `/dashboard/map` page with fully interactive filtering and drill-down capabilities.  
**Stack:** Next.js 15 App Router, Recharts Sankey extension, Python FastAPI, Supabase PostgreSQL.

---

## 1. Overview

### 1.1 Problem Statement
Users need to visualize "where money went" in a clear, interactive flow diagram that shows connections between spending categories, accounts, time periods, and specific merchants. The current analytics (pie/bar charts) show static breakdowns but don't illustrate the flow of money between entities.

### 1.2 Solution
An interactive Sankey diagram that:
- Shows money flowing between nodes (categories, accounts, merchants, time periods)
- Allows filtering by date range, accounts, categories, and minimum amount
- Provides click-to-drill-down into transaction details
- Offers multiple view modes (category, account, merchant, time-based)

### 1.3 Success Criteria
- Sankey diagram renders with real transaction data
- Interactive filtering works correctly
- Drill-down shows accurate transaction details
- Performance: <2s load time for 1000+ transactions
- Intuitive UX with clear navigation

---

## 2. Architecture

### 2.1 Frontend Components
```
frontend/
├── app/dashboard/map/
│   └── page.tsx              # Main flow visualization page
├── components/
│   ├── FlowSankey.tsx        # Sankey diagram visualization
│   ├── FlowFilters.tsx       # Interactive filter controls
│   └── TransactionDrilldown.tsx # Transaction details panel
└── lib/
    └── api/flows.ts          # Flow data API client
```

### 2.2 Backend Components
```
backend/
├── routers/
│   └── flows.py              # Flow data aggregation endpoints
└── services/
    └── flow_aggregator.py    # Transaction aggregation logic
```

### 2.3 Data Flow
1. Frontend requests flow data with filters via `GET /api/flows`
2. Backend aggregates transactions into Sankey nodes/links
3. Sankey renders visualization
4. User interacts (click/hover) → frontend updates filters or fetches details
5. Drill-down shows specific transactions via `GET /api/flows/transactions`

---

## 3. API Design

### 3.1 GET /api/flows
**Purpose:** Retrieve aggregated flow data for Sankey visualization

**Request:**
```json
{
  "start_date": "2026-01-01",
  "end_date": "2026-04-13",
  "account_ids": [],
  "category_names": ["Food", "Transport"],
  "min_amount": 10000,
  "group_by": "category" // "category", "account", "merchant", "time"
}
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "Food",
      "value": 1250000,
      "type": "category",
      "color": "#f97316"
    },
    {
      "id": "Transport", 
      "value": 750000,
      "type": "category",
      "color": "#0ea5e9"
    }
  ],
  "links": [
    {
      "source": "Income",
      "target": "Food",
      "value": 1250000,
      "transactions": 15
    },
    {
      "source": "Food",
      "target": "Merchant A",
      "value": 500000,
      "transactions": 8
    }
  ],
  "metadata": {
    "total_transactions": 50,
    "total_amount": 2000000,
    "period": "Jan 2026 - Apr 2026"
  }
}
```

### 3.2 GET /api/flows/transactions
**Purpose:** Retrieve specific transactions for drill-down

**Request:**
```json
{
  "source": "Food",
  "target": "Merchant A",
  "start_date": "2026-01-01",
  "end_date": "2026-04-13"
}
```

**Response:** Array of transaction objects matching existing `/api/transactions` format

### 3.3 Error Handling
- 400: Invalid date range, unknown category/account
- 401: Unauthorized (JWT missing/invalid)
- 404: No transactions found for filters
- 429: Rate limit exceeded (shares upload rate limiting)

---

## 4. Data Aggregation Logic

### 4.1 Flow Types
1. **Category Flow:** `Income → Category → Merchant`
   - Source: Income category or previous category
   - Target: Spending category or merchant

2. **Account Flow:** `Account A → Account B`
   - For transfer transactions between accounts
   - Requires account detection from transaction descriptions

3. **Time Flow:** `Month 1 → Month 2`
   - Shows savings/spending carryover between periods
   - Aggregates by month/quarter/year

4. **Merchant Flow:** `Category → Specific Merchant`
   - Shows distribution within categories
   - Top 10 merchants per category by default

### 4.2 Aggregation Rules

**Category Flow Logic:**
1. **For spending (debit/negative amounts):** 
   - Source: "Income" (representing money coming in)
   - Target: Spending category (Food, Transport, etc.)
   
2. **For transfers between categories** (when users manually recategorize or if we detect patterns):
   - Source: Previous category assignment
   - Target: New category assignment
   
3. **For income (credit/positive amounts):**
   - Source: Description-based source (e.g., "Salary", "Transfer In")  
   - Target: "Income" category

**Implementation:**
```sql
-- Category flow: Income → Spending categories
SELECT 
  'Income' as source,
  c.name as target,
  SUM(ABS(t.amount)) as total_amount,
  COUNT(*) as transaction_count
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.user_id = :user_id
  AND t.transaction_date BETWEEN :start_date AND :end_date
  AND t.amount < 0  -- Debits (spending)
  AND c.type = 'Expense'
GROUP BY c.name
HAVING SUM(ABS(t.amount)) >= :min_amount
ORDER BY total_amount DESC
LIMIT 50;

-- Time-based flow: Previous period → Current period savings
-- This shows carryover of unspent money
SELECT 
  CONCAT(EXTRACT(YEAR FROM t1.transaction_date), '-', 
         EXTRACT(MONTH FROM t1.transaction_date)) as source,
  CONCAT(EXTRACT(YEAR FROM t2.transaction_date), '-', 
         EXTRACT(MONTH FROM t2.transaction_date)) as target,
  (SUM(CASE WHEN t1.amount > 0 THEN t1.amount ELSE 0 END) - 
   SUM(CASE WHEN t1.amount < 0 THEN ABS(t1.amount) ELSE 0 END)) as flow_amount
FROM transactions t1
JOIN transactions t2 ON t2.transaction_date > t1.transaction_date 
  AND EXTRACT(MONTH FROM t2.transaction_date) = EXTRACT(MONTH FROM t1.transaction_date) + 1
WHERE t1.user_id = :user_id
  AND t2.user_id = :user_id
GROUP BY source, target;
```

### 4.3 Performance Optimizations
- Use database indexes on `transaction_date`, `amount`, `category_id`
- Implement server-side pagination for large datasets
- Cache aggregated results for common date ranges (1 hour TTL)
- Limit maximum nodes to 50 for diagram clarity
- Use materialized views for complex aggregations

---

## 5. Frontend Implementation

### 5.1 Sankey Diagram Component
**Library:** Extend existing Recharts with Sankey support
**Props:**
```typescript
interface FlowSankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onNodeClick?: (node: SankeyNode) => void;
  onLinkClick?: (link: SankeyLink) => void;
  width?: number;
  height?: number;
}

interface SankeyNode {
  id: string;
  value: number;
  type: 'category' | 'account' | 'merchant' | 'time';
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  transactions: number;
}
```

**Features:**
- Responsive sizing (fills container)
- Color-coded by node type
- Interactive hover tooltips
- Click handlers for nodes/links
- Animation on data change

### 5.2 Filter Controls Component
**State:**
```typescript
interface FlowFilterState {
  dateRange: { start: Date; end: Date };
  categories: string[];  // Selected categories
  accounts: string[];    // Selected accounts
  minAmount: number;     // Minimum transaction amount
  groupBy: 'category' | 'account' | 'merchant' | 'time';
  viewMode: 'all' | 'income' | 'expense';
}
```

**UI Elements:**
- Date range picker (last 30/90/365 days, custom)
- Category multi-select dropdown
- Amount slider (Rp 10k - Rp 10M)
- Group by toggle buttons
- Reset filters button

### 5.3 Transaction Drilldown Panel
**Shown when:** User clicks a Sankey link
**Displays:**
- List of transactions in that flow
- Date, description, amount, category
- Link to full transaction details
- Export to CSV option

### 5.4 Styling & UX
**Matches existing Modern Gradient design:**
- Gradient backgrounds (`bg-gradient-to-br from-blue-50 to-violet-50`)
- White cards with colored borders
- Category color scheme consistent with app
- Smooth animations on filter changes

**Responsive Design:**
- Desktop: Full interactive Sankey
- Tablet: Simplified view with horizontal scrolling
- Mobile: Alternative visualization (consider waterfall chart)

---

## 6. Integration Points

### 6.1 Navigation
- Add "Flow Map" to sidebar navigation (`Sidebar.tsx`)
- Position after "Analytics", before "Settings"
- Use same gradient active pill styling

### 6.2 Authentication
- Use existing Supabase auth patterns
- Server-side RLS policies apply automatically
- JWT validation via existing middleware

### 6.3 Data Consistency
- Real-time updates when transactions added/edited
- Subscribe to Supabase realtime for transaction changes
- Refresh flow data on category override changes

### 6.4 Error States
- Empty state: "No transactions in selected period"
- Loading state: Shimmer animation
- Error state: Retry button with error message
- Filter mismatch: "No flows match your filters"

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
1. Backend flow aggregation endpoint (`/api/flows`)
2. Basic Sankey visualization component
3. Time range filtering
4. New `/dashboard/map` page skeleton

**Deliverables:**
- Working Sankey with sample data
- Date range filtering
- Basic page layout

### Phase 2: Interactivity (Week 2)
1. Node/link click handlers
2. Transaction drill-down panel
3. Category and amount filtering
4. Multiple view modes (category/account)

**Deliverables:**
- Full interactive Sankey
- Transaction details on click
- Category filtering

### Phase 3: Polish & Advanced Features (Week 3)
1. Merchant and time-based views
2. Export flow as image/PDF
3. Save favorite filter combinations
4. Performance optimizations
5. Mobile responsiveness

**Deliverables:**
- All view modes working
- Export functionality
- Optimized performance

---

## 8. Technical Considerations

### 8.1 Performance
- **Client:** Virtualize Sankey rendering for >100 nodes
- **Server:** Database-level aggregation, query optimization
- **Caching:** Redis for frequent filter combinations
- **Lazy loading:** Code split Sankey library

### 8.2 Accessibility
- Keyboard navigation through nodes/links
- Screen reader support for flow descriptions
- High contrast mode support
- ARIA labels for interactive elements

### 8.3 Testing
- Unit tests for flow aggregation logic
- Integration tests for API endpoints
- Visual regression tests for Sankey rendering
- Performance tests with large datasets

### 8.4 Monitoring
- Track Sankey render performance
- Monitor API response times
- Log filter usage patterns
- Alert on aggregation failures

---

## 9. Dependencies

### 9.1 New Dependencies
- `recharts` (already in use) + `d3-sankey` for Sankey diagram implementation
- `date-fns` for date manipulation (if not already)
- `react-query` for data fetching (optional)
- Note: Recharts doesn't have built-in Sankey support, will use d3-sankey with custom Recharts integration

### 9.2 Existing Dependencies Used
- `recharts` (already in use)
- `tailwindcss` (styling)
- `@supabase/supabase-js` (data)
- `next/navigation` (routing)

### 9.3 Backend Dependencies
- `fastapi` (existing)
- `sqlalchemy` (existing)
- `pydantic` (existing)

---

## 10. Success Metrics & Validation

### 10.1 Functional Validation
- [ ] Sankey renders with real transaction data
- [ ] Interactive filtering works correctly
- [ ] Drill-down shows accurate transaction details
- [ ] Performance: <2s load time for 1000+ transactions
- [ ] All filter combinations produce valid results

### 10.2 User Experience Validation
- [ ] Intuitive navigation and controls
- [ ] Clear visualization of money flows
- [ ] Responsive on desktop/tablet/mobile
- [ ] Accessibility: Keyboard navigation, screen reader support
- [ ] Error states handled gracefully

### 10.3 Integration Validation
- [ ] Works with existing authentication
- [ ] Consistent with Modern Gradient design system
- [ ] Real-time updates when data changes
- [ ] No breaking changes to existing features

---

## 11. Risks & Mitigations

### 11.1 Performance with Large Datasets
**Risk:** Sankey diagram becomes slow with 1000+ transactions
**Mitigation:** 
- Server-side aggregation limits
- Client-side virtualization
- Progressive loading

### 11.2 Complex Flow Logic
**Risk:** Money flow logic becomes too complex
**Mitigation:**
- Start with simple category flows
- Iteratively add complexity
- User testing at each stage

### 11.3 Mobile Usability
**Risk:** Sankey diagram doesn't work well on mobile
**Mitigation:**
- Alternative mobile visualization
- Horizontal scrolling
- Simplified view mode

---

## 12. Future Enhancements

### 12.1 Short-term (Post-launch)
- Compare flows between time periods
- Animated transitions between filter states
- Custom color schemes

### 12.2 Medium-term
- Predictive flows (where money will go)
- Integration with budget tracking
- Export to PNG/PDF with annotations

### 12.3 Long-term
- Multi-user collaboration views
- Advanced analytics on flow patterns
- Machine learning for flow predictions

---

**Approval:** ✅ Design approved for implementation

**Next Steps:** 
1. Create implementation plan with `writing-plans` skill
2. Implement Phase 1 (Foundation)
3. User testing and iteration
4. Implement Phases 2 & 3