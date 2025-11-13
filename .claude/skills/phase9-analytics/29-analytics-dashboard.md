# Task 29: Analytics Dashboard

## Objective
Create comprehensive analytics dashboard with interactive charts for quote funnel, OCR accuracy, revenue trends, margin analysis, and CSV export.

## Context
- Visual dashboard for business insights
- Charts: funnel, line graphs, bar charts
- Date range selector
- Export to CSV
- Use Recharts library
- Real-time updates

## Requirements

### 1. Dashboard Page

**File:** `pricing-tool/app/admin/analytics/page.tsx`

```typescript
'use client'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({ start: thirtyDaysAgo(), end: today() })
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetchMetrics()
  }, [dateRange])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Quotes" value={metrics?.totalQuotes} />
        <MetricCard title="Conversion Rate" value={`${metrics?.conversionRate}%`} />
        <MetricCard title="Revenue" value={`$${metrics?.revenue?.toLocaleString()}`} />
        <MetricCard title="Avg Quote Value" value={`$${metrics?.avgQuoteValue?.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuoteFunnelChart data={metrics?.funnel} />
        <RevenueTrendChart dateRange={dateRange} />
        <OCRAccuracyChart data={metrics?.ocr} />
        <MarginByCategoryChart />
      </div>
    </div>
  )
}
```

### 2. Quote Funnel Chart

**File:** `pricing-tool/components/analytics/QuoteFunnelChart.tsx`

```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

export function QuoteFunnelChart({ data }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Quote Conversion Funnel</h3>
      <BarChart width={500} height={300} data={data}>
        <XAxis dataKey="stage" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#3b82f6" />
      </BarChart>
      <div className="mt-4 text-sm text-gray-600">
        {data?.map(stage => (
          <div key={stage.stage} className="flex justify-between">
            <span>{stage.stage}:</span>
            <span>{stage.conversion_rate}% conversion</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 3. Revenue Trend Chart

**File:** `pricing-tool/components/analytics/RevenueTrendChart.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export function RevenueTrendChart({ dateRange }: Props) {
  const [data, setData] = useState([])

  useEffect(() => {
    fetchRevenueTrend()
  }, [dateRange])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
      <LineChart width={500} height={300} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
      </LineChart>
    </div>
  )
}
```

### 4. CSV Export

**File:** `pricing-tool/lib/export-csv.ts`

```typescript
export function exportToCSV(data: any[], filename: string) {
  const csv = convertToCSV(data)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(header => JSON.stringify(row[header])).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}
```

### 5. Real-Time Updates

**File:** `pricing-tool/lib/analytics-realtime.ts`

```typescript
export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    const channel = supabase
      .channel('quote-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        fetchMetrics()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return metrics
}
```

## Files to Create
- `pricing-tool/app/admin/analytics/page.tsx`
- `pricing-tool/components/analytics/QuoteFunnelChart.tsx`
- `pricing-tool/components/analytics/RevenueTrendChart.tsx`
- `pricing-tool/components/analytics/OCRAccuracyChart.tsx`
- `pricing-tool/components/analytics/MarginByCategoryChart.tsx`
- `pricing-tool/lib/export-csv.ts`

## Testing Requirements
1. View dashboard with data
2. Change date range updates charts
3. Export CSV downloads file
4. Real-time updates work
5. Charts responsive on mobile

## Acceptance Criteria
- [ ] Dashboard displays all metrics
- [ ] Charts render correctly
- [ ] Date range filter works
- [ ] CSV export functions
- [ ] Real-time updates
- [ ] Mobile responsive
- [ ] Loading states shown

## Dependencies
- Task 28 (metrics tracking)
- Recharts library

## Estimated Effort
6-8 hours

## Review Checklist
- [ ] Charts accessible
- [ ] Color blind friendly colors
- [ ] Data refreshes on filter
- [ ] Export includes all data
- [ ] Performance acceptable
- [ ] Error states handled
