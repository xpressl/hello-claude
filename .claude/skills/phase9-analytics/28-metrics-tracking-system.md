# Task 28: Metrics Tracking System

## Objective
Implement comprehensive metrics tracking using events table with key business metrics, aggregate queries, time-series data, and performance monitoring.

## Context
- Track quote volume, conversion rates, revenue
- Use events table as foundation
- Aggregate queries for dashboards
- Time-series for trend analysis
- Real-time and historical views

## Requirements

### 1. Metrics Schema

```sql
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metrics_name_time ON metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_dimensions ON metrics USING GIN(dimensions);
```

### 2. Key Metrics Functions

```sql
-- Quote conversion funnel
CREATE OR REPLACE FUNCTION get_quote_funnel(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  conversion_rate NUMERIC
) AS $$
WITH funnel AS (
  SELECT
    'Created' as stage,
    COUNT(*) as count,
    1 as order_num
  FROM quotes WHERE created_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Submitted', COUNT(*), 2
  FROM quotes WHERE submitted_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Sent', COUNT(*), 3
  FROM quotes WHERE sent_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Accepted', COUNT(*), 4
  FROM quotes WHERE status = 'accepted' AND created_at BETWEEN p_start_date AND p_end_date
)
SELECT
  stage,
  count,
  ROUND(count::NUMERIC / FIRST_VALUE(count) OVER (ORDER BY order_num) * 100, 2) as conversion_rate
FROM funnel
ORDER BY order_num;
$$ LANGUAGE SQL;
```

### 3. Revenue Metrics

```sql
CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_revenue NUMERIC,
  average_quote_value NUMERIC,
  accepted_quotes BIGINT,
  total_margin NUMERIC
) AS $$
  SELECT
    SUM(total) as total_revenue,
    AVG(total) as average_quote_value,
    COUNT(*) as accepted_quotes,
    SUM(total * (margin_percent / 100)) as total_margin
  FROM quotes
  WHERE status = 'accepted'
    AND created_at BETWEEN p_start_date AND p_end_date;
$$ LANGUAGE SQL;
```

### 4. OCR Accuracy Tracking

```sql
CREATE OR REPLACE FUNCTION track_ocr_accuracy()
RETURNS TABLE (
  average_confidence NUMERIC,
  total_extractions BIGINT,
  high_confidence_percent NUMERIC
) AS $$
  SELECT
    AVG(confidence_score) as average_confidence,
    COUNT(*) as total_extractions,
    ROUND(COUNT(*) FILTER (WHERE confidence_score > 0.8)::NUMERIC / COUNT(*) * 100, 2) as high_confidence_percent
  FROM uploads
  WHERE file_type IN ('pdf', 'image')
    AND status = 'completed';
$$ LANGUAGE SQL;
```

### 5. Metrics API

**File:** `pricing-tool/app/api/metrics/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('end') || new Date().toISOString()

  const [funnel, revenue, ocr] = await Promise.all([
    supabase.rpc('get_quote_funnel', { p_start_date: startDate, p_end_date: endDate }),
    supabase.rpc('get_revenue_metrics', { p_start_date: startDate, p_end_date: endDate }),
    supabase.rpc('track_ocr_accuracy')
  ])

  return NextResponse.json({
    funnel: funnel.data,
    revenue: revenue.data?.[0],
    ocr: ocr.data?.[0]
  })
}
```

## Files to Create
- Update `pricing-tool/supabase-schema.sql`
- `pricing-tool/app/api/metrics/route.ts`

## Testing Requirements
1. Track quote created event
2. Calculate conversion rate
3. Verify revenue totals
4. Check OCR accuracy metrics
5. Test date range filtering

## Acceptance Criteria
- [ ] Metrics calculated correctly
- [ ] Performance < 500ms
- [ ] Time-series queries optimized
- [ ] Real-time metrics available
- [ ] Historical data preserved

## Dependencies
- Task 01 (quotes, events tables)
- Task 12 (uploads for OCR metrics)

## Estimated Effort
4-5 hours

## Review Checklist
- [ ] Aggregate queries optimized
- [ ] Indexes on time columns
- [ ] Metrics accurate
- [ ] No N+1 query issues
- [ ] Handles large datasets
- [ ] Functions return correct types
