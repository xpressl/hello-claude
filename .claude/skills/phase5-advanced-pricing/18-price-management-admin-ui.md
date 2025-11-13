# Task 18: Price Management Admin UI

## Objective
Create comprehensive admin interface for managing price lists, pricing rules, manual overrides, and approval workflows with visual rule builder and scenario testing.

## Context
- Admins need intuitive UI for complex pricing configuration
- Visual rule builder prevents configuration errors
- Preview pricing scenarios before applying
- Approval queue for pending overrides
- Price history and audit trail visibility
- Must be accessible on desktop and tablet

## Requirements

### 1. Price Lists Management Page

**File:** `pricing-tool/app/admin/pricing/price-lists/page.tsx`

**Layout:**
```tsx
export default function PriceListsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Price Lists"
        description="Manage pricing for different customer segments and promotions"
        action={
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            Create Price List
          </button>
        }
      />

      <PriceListsTable />
    </div>
  )
}
```

**Price Lists Table Component:**
```typescript
// pricing-tool/components/admin/pricing/PriceListsTable.tsx

interface PriceList {
  id: string
  name: string
  type: string
  priority: number
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  item_count: number
}

export function PriceListsTable() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([])

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Period</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {priceLists.map(list => (
            <PriceListRow key={list.id} priceList={list} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 2. Price List Editor

**File:** `pricing-tool/components/admin/pricing/PriceListEditor.tsx`

**Features:**
- Create/edit price list metadata
- Bulk import prices from CSV
- Quantity tier configuration
- Product selection with search
- Inline editing of prices

```typescript
export function PriceListEditor({ priceListId }: { priceListId?: string }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'customer_segment',
    priority: 10,
    valid_from: null,
    valid_to: null,
    is_active: true
  })

  const [items, setItems] = useState<PriceListItem[]>([])

  return (
    <div className="space-y-6">
      {/* Metadata form */}
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Price List Details</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Contractor Pricing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input w-full"
            >
              <option value="base">Base</option>
              <option value="customer_segment">Customer Segment</option>
              <option value="promotional">Promotional</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="input w-full"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher priority lists override lower ones
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valid From
            </label>
            <input
              type="datetime-local"
              value={formData.valid_from || ''}
              onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valid To
            </label>
            <input
              type="datetime-local"
              value={formData.valid_to || ''}
              onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
      </section>

      {/* Price items */}
      <section className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Price Items</h3>
          <div className="flex gap-2">
            <button onClick={handleImportCSV} className="btn btn-sm btn-secondary">
              Import CSV
            </button>
            <button onClick={handleAddItem} className="btn btn-sm btn-primary">
              Add Product
            </button>
          </div>
        </div>

        <PriceItemsGrid
          items={items}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
        />
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button onClick={handleSave} className="btn btn-primary">
          Save Price List
        </button>
      </div>
    </div>
  )
}
```

### 3. Visual Pricing Rule Builder

**File:** `pricing-tool/components/admin/pricing/PricingRuleBuilder.tsx`

**Features:**
- Drag-and-drop rule conditions
- Visual representation of rule logic
- Test rule against sample products
- Duplicate rules easily

```typescript
export function PricingRuleBuilder({ ruleId }: { ruleId?: string }) {
  const [rule, setRule] = useState({
    name: '',
    rule_type: 'percentage',
    adjustment_value: 0,
    scope: 'all',
    scope_value: null,
    conditions: {},
    priority: 0,
    is_active: true
  })

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Rule Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              className="input w-full"
              placeholder="e.g., Bulk Order Discount"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Type
              </label>
              <select
                value={rule.rule_type}
                onChange={(e) => setRule({ ...rule, rule_type: e.target.value })}
                className="input w-full"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="fixed_price">Fixed Price</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={rule.adjustment_value}
                  onChange={(e) => setRule({ ...rule, adjustment_value: parseFloat(e.target.value) })}
                  className="input w-full pr-10"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {rule.rule_type === 'percentage' ? '%' : '$'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <input
                type="number"
                value={rule.priority}
                onChange={(e) => setRule({ ...rule, priority: parseInt(e.target.value) })}
                className="input w-full"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apply To
            </label>
            <div className="grid grid-cols-2 gap-4">
              <select
                value={rule.scope}
                onChange={(e) => setRule({ ...rule, scope: e.target.value })}
                className="input"
              >
                <option value="all">All Products</option>
                <option value="category">Specific Category</option>
                <option value="product">Specific Product</option>
                <option value="tag">Products with Tag</option>
              </select>

              {rule.scope !== 'all' && (
                <input
                  type="text"
                  value={rule.scope_value || ''}
                  onChange={(e) => setRule({ ...rule, scope_value: e.target.value })}
                  className="input"
                  placeholder={`Select ${rule.scope}...`}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Conditions builder */}
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Conditions</h3>

        <ConditionsBuilder
          conditions={rule.conditions}
          onChange={(conditions) => setRule({ ...rule, conditions })}
        />
      </section>

      {/* Preview */}
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Preview</h3>

        <RulePreview rule={rule} />
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button className="btn btn-secondary">Cancel</button>
        <button className="btn btn-primary">Save Rule</button>
      </div>
    </div>
  )
}
```

### 4. Conditions Builder Component

**File:** `pricing-tool/components/admin/pricing/ConditionsBuilder.tsx`

```typescript
export function ConditionsBuilder({
  conditions,
  onChange
}: {
  conditions: Record<string, any>
  onChange: (conditions: Record<string, any>) => void
}) {
  const addCondition = (type: string) => {
    const newConditions = { ...conditions }

    switch (type) {
      case 'min_order_value':
        newConditions.min_order_value = 0
        break
      case 'customer_type':
        newConditions.customer_type = 'retail'
        break
      case 'day_of_week':
        newConditions.day_of_week = []
        break
      case 'min_quantity':
        newConditions.min_quantity = 1
        break
    }

    onChange(newConditions)
  }

  const removeCondition = (key: string) => {
    const newConditions = { ...conditions }
    delete newConditions[key]
    onChange(newConditions)
  }

  return (
    <div className="space-y-3">
      {/* Existing conditions */}
      {Object.entries(conditions).map(([key, value]) => (
        <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
          <div className="flex-1">
            <ConditionEditor
              type={key}
              value={value}
              onChange={(newValue) => onChange({ ...conditions, [key]: newValue })}
            />
          </div>
          <button
            onClick={() => removeCondition(key)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}

      {/* Add condition dropdown */}
      <div>
        <select
          onChange={(e) => {
            if (e.target.value) {
              addCondition(e.target.value)
              e.target.value = ''
            }
          }}
          className="input"
          defaultValue=""
        >
          <option value="">Add Condition...</option>
          <option value="min_order_value">Minimum Order Value</option>
          <option value="customer_type">Customer Type</option>
          <option value="day_of_week">Day of Week</option>
          <option value="min_quantity">Minimum Quantity</option>
        </select>
      </div>
    </div>
  )
}
```

### 5. Override Approval Queue

**File:** `pricing-tool/app/admin/pricing/approvals/page.tsx`

```typescript
export default function ApprovalQueuePage() {
  const [overrides, setOverrides] = useState<PriceOverride[]>([])

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  async function fetchPendingApprovals() {
    const res = await fetch('/api/pricing/overrides?status=pending')
    const data = await res.json()
    setOverrides(data.overrides)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Price Override Approvals"
        description="Review and approve price override requests"
      />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Quote</th>
              <th className="px-6 py-3 text-left">Product</th>
              <th className="px-6 py-3 text-right">Original Price</th>
              <th className="px-6 py-3 text-right">Override Price</th>
              <th className="px-6 py-3 text-right">Discount</th>
              <th className="px-6 py-3 text-left">Reason</th>
              <th className="px-6 py-3 text-left">Requested By</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {overrides.map(override => (
              <ApprovalRow
                key={override.id}
                override={override}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### 6. Pricing Scenario Tester

**File:** `pricing-tool/components/admin/pricing/ScenarioTester.tsx`

**Purpose:** Test pricing before applying changes

```typescript
export function ScenarioTester() {
  const [scenario, setScenario] = useState({
    product_id: '',
    quantity: 1,
    price_list_id: null,
    customer_type: 'retail',
    quote_date: new Date()
  })

  const [result, setResult] = useState<PricingResultV2 | null>(null)

  const testScenario = async () => {
    const res = await fetch('/api/pricing/test-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario)
    })

    const data = await res.json()
    setResult(data.result)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h3 className="text-lg font-semibold">Test Pricing Scenario</h3>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Product</label>
          <input
            type="text"
            value={scenario.product_id}
            onChange={(e) => setScenario({ ...scenario, product_id: e.target.value })}
            className="input w-full"
            placeholder="Product ID or SKU"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="number"
            value={scenario.quantity}
            onChange={(e) => setScenario({ ...scenario, quantity: parseInt(e.target.value) })}
            className="input w-full"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Customer Type</label>
          <select
            value={scenario.customer_type}
            onChange={(e) => setScenario({ ...scenario, customer_type: e.target.value })}
            className="input w-full"
          >
            <option value="retail">Retail</option>
            <option value="contractor">Contractor</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
      </div>

      <button onClick={testScenario} className="btn btn-primary">
        Calculate Price
      </button>

      {/* Results */}
      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Unit Price</p>
              <p className="text-2xl font-bold">${result.unit_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Extended Price</p>
              <p className="text-2xl font-bold">${result.extended_price.toFixed(2)}</p>
            </div>
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-blue-600">
              View Price Breakdown
            </summary>
            <div className="mt-3 space-y-2">
              {result.trace.map((step, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">Step {step.step}:</span> {step.description}
                  <span className="text-gray-600 ml-2">→ ${step.result.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
```

### 7. API Routes

**File:** `pricing-tool/app/api/pricing/overrides/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createRouteHandlerClient({ cookies })

  let query = supabase
    .from('price_overrides')
    .select('*, quote:quotes(customer_name), created_by_user:users(name)')

  if (status) {
    query = query.eq('approval_status', status)
  }

  const { data, error } = await query

  return NextResponse.json({ overrides: data })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { overrideId, action, notes } = body

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('price_overrides')
    .update({
      approval_status: action, // 'approved' or 'rejected'
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes
    })
    .eq('id', overrideId)

  return NextResponse.json({ success: !error })
}
```

## Files to Create

**Pages:**
- `pricing-tool/app/admin/pricing/price-lists/page.tsx`
- `pricing-tool/app/admin/pricing/rules/page.tsx`
- `pricing-tool/app/admin/pricing/approvals/page.tsx`

**Components:**
- `pricing-tool/components/admin/pricing/PriceListsTable.tsx`
- `pricing-tool/components/admin/pricing/PriceListEditor.tsx`
- `pricing-tool/components/admin/pricing/PricingRuleBuilder.tsx`
- `pricing-tool/components/admin/pricing/ConditionsBuilder.tsx`
- `pricing-tool/components/admin/pricing/ScenarioTester.tsx`
- `pricing-tool/components/admin/pricing/ApprovalQueue.tsx`

**API:**
- `pricing-tool/app/api/pricing/overrides/route.ts`
- `pricing-tool/app/api/pricing/test-scenario/route.ts`

## Testing Requirements

1. **Price Lists:**
   - Create new price list
   - Edit existing price list
   - Bulk import from CSV
   - Delete price list
   - Activate/deactivate list

2. **Rules:**
   - Create percentage rule
   - Create fixed amount rule
   - Add conditions
   - Test rule scenarios
   - Priority ordering

3. **Approvals:**
   - View pending approvals
   - Approve override
   - Reject override with notes
   - Approval notification sent

## Acceptance Criteria

- [ ] Price lists CRUD works
- [ ] Rule builder creates valid rules
- [ ] Scenario tester shows accurate prices
- [ ] Approval queue displays pending items
- [ ] Approve/reject updates status
- [ ] Bulk import validates data
- [ ] Responsive on desktop and tablet
- [ ] Loading states shown
- [ ] Error handling user-friendly
- [ ] Price history visible

## Dependencies

- Task 16 (schema)
- Task 17 (engine v2)

## Estimated Effort

8-10 hours

## Review Checklist

- [ ] TypeScript types accurate
- [ ] Form validation complete
- [ ] Confirmation dialogs for destructive actions
- [ ] Keyboard shortcuts helpful
- [ ] Mobile layout acceptable
- [ ] API error handling
- [ ] Loading states prevent duplicate actions
- [ ] Success/error toasts shown
- [ ] Date pickers work correctly
- [ ] CSV import validates format
