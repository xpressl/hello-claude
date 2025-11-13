# Task 02: Quote API Routes

## Objective
Create Next.js API route handlers for quote CRUD operations with proper validation, error handling, and authentication.

## Context
- Next.js 16 App Router (use route.ts files)
- Supabase client for database operations
- TypeScript with Zod for validation
- Existing auth setup in lib/supabase.ts

## Requirements

### 1. Create Quote (POST /api/quotes)

**Request Body:**
```typescript
{
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  metadata?: {
    source: 'web' | 'mobile'
    referrer?: string
  }
}
```

**Response (201):**
```typescript
{
  id: string
  status: 'draft'
  created_at: string
  // ... all quote fields
}
```

**Logic:**
- Allow anonymous creation (no auth required)
- Capture IP, user agent from headers
- Set status to 'draft'
- Generate UUID
- Return created quote

### 2. List Quotes (GET /api/quotes)

**Query Params:**
- `status` (optional): filter by status
- `search` (optional): search customer name/email
- `limit` (optional, default 50, max 100)
- `offset` (optional, default 0)

**Response (200):**
```typescript
{
  quotes: Quote[]
  total: number
  limit: number
  offset: number
}
```

**Auth:**
- Require authenticated user with SALES or ADMIN role
- Use RLS to filter automatically

### 3. Get Quote (GET /api/quotes/[id])

**Response (200):**
```typescript
{
  quote: Quote & {
    lines: QuoteLine[]
    uploads: Upload[]
  }
}
```

**Auth:**
- ADMIN/SALES: can view any quote
- Anonymous: can view if they have the correct token (future enhancement)

### 4. Update Quote (PATCH /api/quotes/[id])

**Request Body:**
```typescript
{
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  status?: QuoteStatus
  // ... other updateable fields
}
```

**Response (200):**
```typescript
{
  quote: Quote
}
```

**Auth:**
- Require ADMIN role
- Cannot update if status is 'sent' or later (locked)

### 5. Delete Quote (DELETE /api/quotes/[id])

**Response (204):** No content

**Auth:**
- Require ADMIN role
- Only allow delete if status is 'draft'

### 6. Add Line to Quote (POST /api/quotes/[id]/lines)

**Request Body:**
```typescript
{
  catalog_item_id?: string
  description: string
  quantity: number
  unit?: string
  options?: Record<string, any>
  unit_price: number
  source?: 'manual' | 'ocr' | etc.
  notes?: string
}
```

**Response (201):**
```typescript
{
  line: QuoteLine
  quote: {
    id: string
    subtotal: number
    total: number
  }
}
```

**Logic:**
- Calculate extended_price = quantity * unit_price
- Auto-assign line_number
- Update quote totals
- Validate catalog_item_id exists if provided

### 7. Update Line (PATCH /api/quotes/[id]/lines/[lineId])

**Request Body:**
```typescript
{
  quantity?: number
  unit_price?: number
  options?: Record<string, any>
  description?: string
  notes?: string
}
```

**Response (200):**
```typescript
{
  line: QuoteLine
  quote: {
    id: string
    subtotal: number
    total: number
  }
}
```

### 8. Delete Line (DELETE /api/quotes/[id]/lines/[lineId])

**Response (204):** No content

**Logic:**
- Delete line
- Update quote totals
- Re-sequence remaining line numbers

### 9. Submit Quote (POST /api/quotes/[id]/submit)

**Response (200):**
```typescript
{
  quote: Quote
}
```

**Logic:**
- Validate: must have customer email
- Validate: must have at least one line
- Change status from 'draft' to 'submitted'
- Set submitted_at timestamp
- Create 'submitted' event

## Files to Create
```
pricing-tool/app/api/quotes/route.ts
pricing-tool/app/api/quotes/[id]/route.ts
pricing-tool/app/api/quotes/[id]/lines/route.ts
pricing-tool/app/api/quotes/[id]/lines/[lineId]/route.ts
pricing-tool/app/api/quotes/[id]/submit/route.ts
```

## Shared Utilities to Create
`pricing-tool/lib/api-utils.ts`:
```typescript
// Error responses
export function errorResponse(message: string, status: number)

// Success responses
export function successResponse(data: any, status?: number)

// Auth helpers
export async function requireAuth(request: Request)
export async function requireRole(request: Request, roles: string[])

// Validation
export function validateQuoteStatus(status: string): boolean
```

## Zod Schemas to Create
`pricing-tool/lib/validations.ts`:
```typescript
export const CreateQuoteSchema = z.object({...})
export const UpdateQuoteSchema = z.object({...})
export const CreateLineSchema = z.object({...})
export const UpdateLineSchema = z.object({...})
```

## Error Handling
- 400: Bad Request (invalid input)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (wrong role)
- 404: Not Found (quote doesn't exist)
- 409: Conflict (e.g., updating locked quote)
- 422: Validation Error (Zod validation failed)
- 500: Internal Server Error

Return errors in consistent format:
```typescript
{
  error: string
  details?: any
}
```

## Testing Requirements
1. Test anonymous quote creation
2. Test auth requirement on protected routes
3. Test role-based access (SALES vs ADMIN)
4. Test validation (Zod schemas)
5. Test quote totals recalculation
6. Test locked quote cannot be modified
7. Test line number auto-increment
8. Test cascade operations (delete quote deletes lines)

## Acceptance Criteria
- [ ] All 9 API routes implemented
- [ ] Zod validation on all inputs
- [ ] Proper HTTP status codes
- [ ] Consistent error format
- [ ] Auth checks working
- [ ] RLS policies respected
- [ ] Database queries are efficient (no N+1)
- [ ] TypeScript types are strict
- [ ] Error handling covers edge cases

## Dependencies
- Task 01 (quote schema must exist)

## Estimated Effort
4-5 hours

## Review Checklist for Review Agent
- [ ] SQL injection prevention (use parameterized queries)
- [ ] Input validation comprehensive
- [ ] Auth checks on all protected routes
- [ ] Error messages don't leak sensitive info
- [ ] Response types match documentation
- [ ] Database transactions where needed (multi-step ops)
- [ ] Proper use of HTTP methods (GET, POST, PATCH, DELETE)
- [ ] Rate limiting considered (mention if not implemented)
- [ ] CORS headers if needed
