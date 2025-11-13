# Task 04: Admin Quote List Dashboard

## Objective
Create an admin dashboard page for viewing, filtering, and managing all quotes in the system.

## Context
- Next.js 16 App Router (Server Components where possible)
- Tailwind CSS for styling
- Requires ADMIN or SALES role authentication
- Existing auth setup in lib/supabase.ts
- Desktop-first design (admin tool)

## Requirements

### 1. Page Route
Create: `pricing-tool/app/admin/quotes/page.tsx`

**URL:** `/admin/quotes`

**Auth:** Require user with ADMIN or SALES role (redirect to /login if not authenticated)

### 2. Page Structure

```
┌──────────────────────────────────────────────┐
│ Header                                        │
│ Admin Quotes Dashboard                        │
│ [Sync] [Export CSV]                          │
├──────────────────────────────────────────────┤
│ Filters                                       │
│ Status: [All ▼] Search: [________] Date: [...│
├──────────────────────────────────────────────┤
│ Quotes Table                                  │
│ ┌────────────────────────────────────────┐  │
│ │ ID | Customer | Lines | Total | Status │  │
│ │ #123 | John Doe | 5 | $1,234 | Draft  │  │
│ │ #124 | Jane     | 3 | $890   | Sent   │  │
│ └────────────────────────────────────────┘  │
│                                               │
│ Showing 1-20 of 150 [< 1 2 3 >]             │
└──────────────────────────────────────────────┘
```

### 3. Server Component (Initial Load)

Use React Server Component to fetch initial data:
```typescript
// app/admin/quotes/page.tsx
export default async function AdminQuotesPage() {
  const supabase = createServerClient() // SSR client

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check role
  const role = await getCurrentUserRole()
  if (!['ADMIN', 'SALES'].includes(role)) {
    return <div>Access Denied</div>
  }

  // Fetch initial quotes
  const quotes = await fetchQuotes({ limit: 20, offset: 0 })

  return <QuotesTable initialQuotes={quotes} />
}
```

### 4. Client Component for Interactivity

Create: `pricing-tool/components/QuotesTable.tsx`

**Features:**
- Receives initial data from server
- Handles filtering, sorting, pagination on client
- Fetches new data when filters change

### 5. Filters

**Status Filter:**
- Dropdown: All, Draft, Submitted, Reviewed, Sent, Accepted, Declined, Expired
- Updates URL query param: `?status=draft`
- Fetches filtered results from API

**Search Filter:**
- Text input (debounced 300ms)
- Searches: customer_name, customer_email, quote ID
- Updates URL query param: `?search=john`

**Date Range Filter:**
- Date inputs: From / To
- Filters by created_at
- Updates URL query params: `?from=2024-01-01&to=2024-12-31`

**Clear Filters Button:**
- Resets all filters to default
- Clears URL query params

### 6. Quotes Table

**Columns:**
1. **Quote ID** (e.g., "Q-00123")
   - Clickable link to `/admin/quotes/[id]`
   - Display format: Q-{id.slice(0, 8)}

2. **Customer**
   - Name + Email
   - Truncate if too long
   - Show "--" if anonymous draft

3. **# Lines**
   - Count of quote_lines
   - Badge style

4. **Total**
   - Formatted as currency ($1,234.56)
   - Bold text

5. **Status**
   - Badge with color:
     - draft: gray
     - submitted: blue
     - reviewed: yellow
     - sent: green
     - accepted: emerald
     - declined: red
     - expired: gray

6. **Created**
   - Relative time ("2 hours ago") or date
   - Tooltip shows full timestamp

7. **Actions**
   - View (eye icon) → link to detail page
   - Delete (trash icon, ADMIN only, drafts only)

**Table Features:**
- Sortable columns (click header to sort)
- Hover row highlight
- Responsive: horizontal scroll on mobile
- Empty state: "No quotes found" with illustration
- Loading state: skeleton rows

### 7. Pagination

**Bottom of table:**
- Show: "Showing X-Y of Z quotes"
- Buttons: Previous, 1, 2, 3, ..., Next
- Limit options: [20, 50, 100] per page
- Updates URL: `?limit=50&offset=100`

**Implementation:**
```typescript
const [pagination, setPagination] = useState({
  limit: 20,
  offset: 0,
  total: 0
})

const loadPage = async (offset: number) => {
  const response = await fetch(`/api/quotes?limit=${pagination.limit}&offset=${offset}`)
  const data = await response.json()
  setPagination({ ...pagination, offset, total: data.total })
}
```

### 8. Actions

**Sync Button:**
- Fetches latest quotes from server
- Shows loading spinner
- Updates table
- Toast: "Synced X quotes"

**Export CSV Button:**
- Generates CSV of current filtered results
- Columns: ID, Customer Name, Email, Phone, Lines, Subtotal, Total, Status, Created
- Downloads as `quotes-export-{date}.csv`
- Use papaparse for CSV generation

**Delete Action (ADMIN only):**
- Confirmation modal: "Delete this quote?"
- Only enabled for drafts
- DELETE /api/quotes/[id]
- Removes row from table
- Toast: "Quote deleted"

### 9. Real-time Updates (Optional Enhancement)

If time permits, add Supabase Realtime:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('quotes-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'quotes' },
      handleChange
    )
    .subscribe()

  return () => { channel.unsubscribe() }
}, [])
```

### 10. Performance Optimizations

- Use React.memo for table rows
- Virtual scrolling if >1000 quotes (use @tanstack/react-virtual)
- Cache filtered results
- Debounce search input
- Prefetch next page on hover

### 11. Mobile Responsive

**Mobile (< 768px):**
- Show simplified table (hide some columns)
- Or switch to card layout
- Filters in collapsible section
- Actions in dropdown menu per row

**Desktop:**
- Full table with all columns
- Sticky header on scroll
- Filters always visible

## Files to Create

**Page:**
- `pricing-tool/app/admin/quotes/page.tsx` (Server Component)

**Components:**
- `pricing-tool/components/QuotesTable.tsx` (Client Component)
- `pricing-tool/components/QuoteRow.tsx` (Table row)
- `pricing-tool/components/QuoteFilters.tsx` (Filter controls)
- `pricing-tool/components/StatusBadge.tsx` (Reusable status badge)
- `pricing-tool/components/ConfirmDialog.tsx` (Reusable confirmation)

**Utilities:**
- `pricing-tool/lib/format.ts`:
  ```typescript
  export function formatQuoteId(id: string): string
  export function formatRelativeTime(date: string): string
  export function formatCurrency(amount: number): string
  ```

- `pricing-tool/lib/export.ts`:
  ```typescript
  export function exportQuotesToCSV(quotes: Quote[]): void
  ```

## Testing Requirements

1. **Authentication:**
   - Redirect if not logged in
   - Show access denied for non-ADMIN/SALES

2. **Data Loading:**
   - Initial load shows quotes
   - Empty state if no quotes

3. **Filtering:**
   - Status filter works
   - Search filter works
   - Date range filter works
   - Combined filters work
   - Clear filters resets

4. **Sorting:**
   - Click column headers to sort
   - Toggle asc/desc

5. **Pagination:**
   - Next/Previous work
   - Page numbers work
   - Limit selector works

6. **Actions:**
   - View link navigates correctly
   - Delete removes quote
   - Sync refreshes data
   - Export downloads CSV

7. **Edge Cases:**
   - No quotes found
   - Large number of quotes (1000+)
   - Very long customer names
   - Network errors
   - Deleted quote during view

## Acceptance Criteria

- [ ] Page requires authentication
- [ ] Role check prevents unauthorized access
- [ ] Initial quotes load from server
- [ ] Filters update URL and fetch new data
- [ ] Search is debounced (doesn't spam API)
- [ ] Table displays all required columns
- [ ] Status badges have correct colors
- [ ] Pagination works correctly
- [ ] Sort works on key columns
- [ ] Delete action works (drafts only, ADMIN only)
- [ ] Export CSV generates correct format
- [ ] Sync button refreshes data
- [ ] Mobile responsive (at least basic layout)
- [ ] Loading states shown
- [ ] Error states handled gracefully
- [ ] Empty state message shown if no quotes

## Dependencies

- Task 02 (API routes must exist)
- Task 01 (database schema must exist)
- Existing auth setup

## Estimated Effort

5-7 hours

## Review Checklist for Review Agent

- [ ] Server Component used for initial auth check
- [ ] Client Component handles interactivity
- [ ] URL state synced with filters (shareable links)
- [ ] No unnecessary API calls
- [ ] Debounced search implemented correctly
- [ ] TypeScript types for all props
- [ ] Error boundaries for table
- [ ] Loading skeletons look good
- [ ] Status badge colors meet accessibility contrast
- [ ] CSV export includes all necessary fields
- [ ] Delete confirmation prevents accidents
- [ ] ADMIN-only actions properly gated
- [ ] Mobile experience is usable
- [ ] No hydration errors (SSR/CSR mismatch)
- [ ] Performance is acceptable with 100+ quotes
