# Task 03: Customer Quote Creation Page

## Objective
Create a customer-facing page for creating quotes with manual line-by-line entry, product search, and live pricing.

## Context
- Next.js 16 App Router (React Server Components + Client Components)
- Tailwind CSS for styling
- Existing components: SearchBox, ProductCard (in components/)
- Existing hooks: useDebounce (in lib/hooks.ts)
- Mobile-first responsive design

## Requirements

### 1. Page Route
Create: `pricing-tool/app/quote/new/page.tsx`

**URL:** `/quote/new`

### 2. Page Structure

```
┌─────────────────────────────────────────┐
│ Header                                   │
│ - Logo                                   │
│ - "Create Quote" title                   │
│ - Help/Contact link                      │
├─────────────────────────────────────────┤
│ Contact Information Form                 │
│ - Name (required)                        │
│ - Email (required)                       │
│ - Phone (optional)                       │
├─────────────────────────────────────────┤
│ Line Items Section                       │
│ ┌───────────────────────────────────┐  │
│ │ Product Search                    │  │
│ │ [Search box with autocomplete]    │  │
│ └───────────────────────────────────┘  │
│                                          │
│ Quote Lines (table or cards)             │
│ ┌─────────────────────────────────────┐│
│ │ Line 1: Product Name                ││
│ │ Qty: [__] Unit: [EA ▼] Price: $100 ││
│ │ [Duplicate] [Remove]                ││
│ └─────────────────────────────────────┘│
│                                          │
│ [+ Add Manual Line]                      │
├─────────────────────────────────────────┤
│ Summary Sidebar (sticky on desktop)     │
│ - Subtotal: $XXX                         │
│ - # of lines: X                          │
│ - Warnings: X                            │
│ - [Save Draft] [Submit Quote]            │
└─────────────────────────────────────────┘
```

### 3. State Management

Use React hooks for local state:
```typescript
const [quote, setQuote] = useState<QuoteDraft>({
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  lines: []
})

const [isSubmitting, setIsSubmitting] = useState(false)
const [errors, setErrors] = useState<Record<string, string>>({})
```

Auto-save draft to IndexedDB every 30 seconds:
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    saveDraftToIndexedDB(quote)
  }, 30000)
  return () => clearInterval(timer)
}, [quote])
```

### 4. Contact Information Form

**Fields:**
- Name: text input (required)
- Email: email input (required, validate format)
- Phone: tel input (optional)

**Validation:**
- Name: min 2 characters
- Email: valid email format
- Show inline errors on blur

### 5. Product Search

**Component to Create:** `pricing-tool/components/ProductSearchAutocomplete.tsx`

**Features:**
- Reuse existing SearchBox component as base
- Debounced search (300ms)
- Show top 10 results in dropdown
- Display: product name, SKU, unit price
- Click to add as new line
- Keyboard navigation (arrows, enter, escape)
- Show "No results" if empty

**Search logic:**
```typescript
// Use existing searchLocalProducts from lib/sync.ts
// Or fallback to Supabase if offline cache empty
```

### 6. Quote Lines

**Display as cards on mobile, table on desktop**

**Each line shows:**
- Line number
- Product name (linked to catalog if catalog_item_id exists)
- Description (editable for custom items)
- Quantity input (number, min 0.01)
- Unit selector (dropdown: EA, LF, SF, BOX, PKG, SET)
- Unit price (read-only if from catalog, editable for custom)
- Extended price (auto-calculated)
- Actions: Duplicate, Remove

**Add Manual Line:**
- Button to add custom line (no catalog item)
- Shows empty form with all fields editable

**Duplicate Line:**
- Copies existing line with incremented line number
- Allows quick quoting of similar items

**Remove Line:**
- Confirmation dialog: "Remove this line?"
- Recalculates totals

### 7. Live Calculations

**On any quantity or price change:**
```typescript
const calculateExtended = (quantity: number, unitPrice: number) => {
  return new Decimal(quantity).times(unitPrice).toDecimalPlaces(2).toNumber()
}

const calculateSubtotal = (lines: QuoteLine[]) => {
  return lines.reduce((sum, line) => sum + line.extended_price, 0)
}
```

Use `decimal.js` library (already installed) for precision.

### 8. Summary Sidebar

**Display:**
- Number of lines
- Subtotal (formatted as currency)
- Warnings (e.g., "Missing customer email")
- Action buttons

**Save Draft Button:**
- Saves to IndexedDB
- Shows toast: "Draft saved"
- Generates draft ID for later retrieval

**Submit Quote Button:**
- Disabled if validation fails
- Shows loader during submission
- Validation:
  - Must have customer_name and customer_email
  - Must have at least 1 line
  - All lines must have quantity > 0 and unit_price >= 0

**On successful submit:**
- POST to /api/quotes with customer info
- POST to /api/quotes/[id]/lines for each line
- POST to /api/quotes/[id]/submit to finalize
- Redirect to success page: `/quote/[id]/success`

### 9. Error Handling

**Display errors:**
- Inline field errors (red text under inputs)
- Toast notifications for API errors
- Network error: "Unable to submit. Check connection."
- Validation error: Show specific field issues

**Retry logic:**
- On network failure, keep draft in IndexedDB
- Show "Retry" button
- Don't lose user data

### 10. Responsive Design

**Mobile (< 640px):**
- Stack layout (vertical)
- Contact form full width
- Lines as cards, not table
- Summary at bottom (not sticky)
- Collapsible sections

**Tablet (640px - 1024px):**
- Two columns where possible
- Summary sidebar on right

**Desktop (> 1024px):**
- Three column layout
- Sticky summary sidebar
- Table view for lines
- Search autocomplete wider

### 11. Accessibility

- Proper labels on all inputs
- Keyboard navigation works
- Focus indicators visible
- ARIA labels for icon buttons
- Form submits on Enter
- Screen reader announcements for dynamic content

## Files to Create

**Page:**
- `pricing-tool/app/quote/new/page.tsx`

**Components:**
- `pricing-tool/components/ProductSearchAutocomplete.tsx`
- `pricing-tool/components/QuoteLineItem.tsx`
- `pricing-tool/components/QuoteSummary.tsx`
- `pricing-tool/components/ContactForm.tsx`

**Utilities:**
- `pricing-tool/lib/quote-draft.ts` (IndexedDB operations for drafts)

**Types:**
- Update `pricing-tool/lib/types.ts` with:
  ```typescript
  interface QuoteDraft {
    id?: string
    customer_name: string
    customer_email: string
    customer_phone?: string
    lines: QuoteLineDraft[]
  }

  interface QuoteLineDraft {
    id?: string
    catalog_item_id?: string
    description: string
    quantity: number
    unit: string
    unit_price: number
    extended_price: number
  }
  ```

## Testing Requirements

1. **Manual Testing:**
   - Add product from search
   - Add custom line
   - Duplicate line
   - Remove line
   - Edit quantities and see prices update
   - Submit valid quote
   - Try to submit invalid quote (missing email)
   - Test on mobile viewport

2. **Edge Cases:**
   - Empty search results
   - Network timeout during submit
   - Very large quantity (9999999)
   - Decimal quantities (2.5 boxes)
   - Draft recovery after page refresh

## Acceptance Criteria

- [ ] Page renders without errors
- [ ] Contact form validates correctly
- [ ] Product search works with autocomplete
- [ ] Can add lines from catalog
- [ ] Can add custom lines
- [ ] Duplicate and remove work
- [ ] Live calculations are accurate
- [ ] Subtotal updates on any change
- [ ] Submit creates quote via API
- [ ] Success redirect works
- [ ] Draft auto-save works
- [ ] Mobile responsive
- [ ] Keyboard navigation works
- [ ] Loading states shown during submit
- [ ] Errors displayed clearly

## Dependencies

- Task 02 (API routes must exist)
- Existing components (SearchBox, ProductCard)
- Existing lib/sync.ts (product search)

## Estimated Effort

6-8 hours

## Review Checklist for Review Agent

- [ ] No console.log statements left
- [ ] TypeScript strict mode passes
- [ ] Components are properly typed
- [ ] Event handlers prevent default where needed
- [ ] State updates are immutable
- [ ] No unnecessary re-renders
- [ ] Tailwind classes are semantic
- [ ] Mobile breakpoints tested
- [ ] Form validation is user-friendly
- [ ] Loading states prevent double-submit
- [ ] IndexedDB operations handle errors
- [ ] Currency formatting consistent (use lib/pricing.ts)
- [ ] Decimal math uses Decimal.js (no raw float math)
- [ ] ARIA attributes present where needed
