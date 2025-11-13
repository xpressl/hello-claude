# Task 30: Export and Reporting Service

## Objective
Implement scheduled report generation, custom report builder, PDF export of analytics, and automated email delivery of reports.

## Context
- Automated daily/weekly reports
- Custom report builder for ad-hoc analysis
- PDF export for sharing
- Email delivery to stakeholders
- Historical report archive

## Requirements

### 1. Report Templates

**File:** `pricing-tool/lib/reports/templates.ts`

```typescript
export const reportTemplates = {
  daily_summary: {
    name: 'Daily Summary',
    schedule: 'daily',
    metrics: ['quotes_created', 'quotes_sent', 'quotes_accepted', 'revenue'],
    recipients: ['sales@company.com']
  },
  weekly_performance: {
    name: 'Weekly Performance',
    schedule: 'weekly',
    metrics: ['conversion_rate', 'avg_quote_value', 'top_products', 'margin_analysis'],
    recipients: ['management@company.com']
  }
}
```

### 2. Report Generator

**File:** `pricing-tool/lib/reports/generate-report.ts`

```typescript
export async function generateReport(templateId: string, dateRange: DateRange) {
  const template = reportTemplates[templateId]
  const data = await fetchReportData(template.metrics, dateRange)

  const html = renderReportHTML(template, data)
  const pdfBuffer = await generatePDF(html)

  return {
    template,
    data,
    pdfBuffer
  }
}

function renderReportHTML(template: ReportTemplate, data: any): string {
  return `
    <html>
      <head>
        <style>
          body { font-family: Arial; padding: 40px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
          th { background: #f8f9fa; }
        </style>
      </head>
      <body>
        <h1>${template.name}</h1>
        <p>Generated: ${new Date().toLocaleDateString()}</p>

        ${data.map(metric => `
          <section>
            <h2>${metric.name}</h2>
            <table>
              <thead>
                <tr>
                  ${Object.keys(metric.data[0] || {}).map(k => `<th>${k}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${metric.data.map(row => `
                  <tr>
                    ${Object.values(row).map(v => `<td>${v}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        `).join('')}
      </body>
    </html>
  `
}
```

### 3. Scheduled Reports

**File:** `pricing-tool/lib/reports/scheduler.ts`

```typescript
export async function scheduleReports() {
  // Run daily at 8am
  cron.schedule('0 8 * * *', async () => {
    await generateAndSendReport('daily_summary', {
      start: yesterday(),
      end: today()
    })
  })

  // Run weekly on Monday at 9am
  cron.schedule('0 9 * * 1', async () => {
    await generateAndSendReport('weekly_performance', {
      start: lastWeekStart(),
      end: lastWeekEnd()
    })
  })
}

async function generateAndSendReport(templateId: string, dateRange: DateRange) {
  const report = await generateReport(templateId, dateRange)

  // Send email
  await sendEmail({
    to: report.template.recipients,
    subject: `${report.template.name} - ${formatDate(dateRange.end)}`,
    html: 'Please see attached report',
    attachments: [{
      filename: `${templateId}_${formatDate(dateRange.end)}.pdf`,
      content: report.pdfBuffer
    }]
  })

  // Archive report
  await archiveReport(templateId, dateRange, report.pdfBuffer)
}
```

### 4. Custom Report Builder

**File:** `pricing-tool/app/admin/reports/builder/page.tsx`

```typescript
export default function ReportBuilderPage() {
  const [selectedMetrics, setSelectedMetrics] = useState([])
  const [dateRange, setDateRange] = useState({ start: thirtyDaysAgo(), end: today() })
  const [groupBy, setGroupBy] = useState('day')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Custom Report Builder</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="col-span-1 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Metrics</label>
              <MetricSelector
                value={selectedMetrics}
                onChange={setSelectedMetrics}
                options={availableMetrics}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date Range</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Group By</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="input">
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>

            <button onClick={generateReport} className="btn btn-primary w-full">
              Generate Report
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Preview</h3>
          <ReportPreview metrics={selectedMetrics} dateRange={dateRange} groupBy={groupBy} />

          <div className="mt-6 flex gap-3">
            <button onClick={exportPDF} className="btn btn-secondary">
              Export PDF
            </button>
            <button onClick={exportCSV} className="btn btn-secondary">
              Export CSV
            </button>
            <button onClick={emailReport} className="btn btn-primary">
              Email Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 5. Report Archive

```sql
CREATE TABLE IF NOT EXISTS report_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id TEXT NOT NULL,
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_archive_template ON report_archive(template_id, created_at DESC);
```

## Files to Create
- `pricing-tool/lib/reports/templates.ts`
- `pricing-tool/lib/reports/generate-report.ts`
- `pricing-tool/lib/reports/scheduler.ts`
- `pricing-tool/app/admin/reports/builder/page.tsx`
- Update `pricing-tool/supabase-schema.sql`

## Testing Requirements
1. Generate daily report
2. Schedule weekly report
3. Custom report with metrics
4. Export PDF
5. Email delivery

## Acceptance Criteria
- [ ] Scheduled reports run automatically
- [ ] Custom report builder functional
- [ ] PDF export works
- [ ] CSV export works
- [ ] Email delivery successful
- [ ] Reports archived

## Dependencies
- Task 28-29 (metrics, dashboard)
- Task 23 (email service)

## Estimated Effort
5-6 hours

## Review Checklist
- [ ] Scheduler runs reliably
- [ ] PDF quality acceptable
- [ ] Email attachments work
- [ ] Archive storage organized
- [ ] Error handling robust
- [ ] Performance acceptable
