import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface QuoteFunnelData {
  stage: string
  count: number
  conversion_rate: number
}

export interface RevenueMetrics {
  total_revenue: number
  average_quote_value: number
  accepted_quotes: number
  total_margin: number
}

export interface OCRMetrics {
  average_confidence: number
  total_extractions: number
  high_confidence_percent: number
}

export interface AnalyticsMetrics {
  funnel: QuoteFunnelData[]
  revenue: RevenueMetrics
  ocr: OCRMetrics
  totalQuotes: number
  conversionRate: number
}

/**
 * Get quote conversion funnel data
 */
export async function getQuoteFunnel(
  startDate: string,
  endDate: string
): Promise<QuoteFunnelData[]> {
  const { data, error } = await supabase.rpc('get_quote_funnel', {
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) {
    console.error('Error fetching quote funnel:', error)
    return []
  }

  return data || []
}

/**
 * Get revenue metrics
 */
export async function getRevenueMetrics(
  startDate: string,
  endDate: string
): Promise<RevenueMetrics> {
  const { data, error } = await supabase.rpc('get_revenue_metrics', {
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) {
    console.error('Error fetching revenue metrics:', error)
    return {
      total_revenue: 0,
      average_quote_value: 0,
      accepted_quotes: 0,
      total_margin: 0
    }
  }

  return data?.[0] || {
    total_revenue: 0,
    average_quote_value: 0,
    accepted_quotes: 0,
    total_margin: 0
  }
}

/**
 * Get OCR accuracy metrics
 */
export async function getOCRMetrics(): Promise<OCRMetrics> {
  const { data, error } = await supabase.rpc('track_ocr_accuracy')

  if (error) {
    console.error('Error fetching OCR metrics:', error)
    return {
      average_confidence: 0,
      total_extractions: 0,
      high_confidence_percent: 0
    }
  }

  return data?.[0] || {
    average_confidence: 0,
    total_extractions: 0,
    high_confidence_percent: 0
  }
}

/**
 * Get total quotes count
 */
export async function getTotalQuotes(
  startDate: string,
  endDate: string
): Promise<number> {
  const { count, error } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) {
    console.error('Error fetching total quotes:', error)
    return 0
  }

  return count || 0
}

/**
 * Get conversion rate percentage
 */
export async function getConversionRate(
  startDate: string,
  endDate: string
): Promise<number> {
  const { data: totalData } = await supabase
    .from('quotes')
    .select('id', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  const { data: acceptedData } = await supabase
    .from('quotes')
    .select('id', { count: 'exact' })
    .eq('status', 'accepted')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  const total = totalData?.length || 0
  const accepted = acceptedData?.length || 0

  if (total === 0) return 0
  return Math.round((accepted / total) * 100 * 100) / 100
}

/**
 * Get revenue trend data (daily)
 */
export async function getRevenueTrend(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; revenue: number; quotes: number }>> {
  const { data, error } = await supabase
    .from('quotes')
    .select('created_at, total')
    .eq('status', 'accepted')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching revenue trend:', error)
    return []
  }

  // Group by date
  const grouped: { [key: string]: { revenue: number; quotes: number } } = {}

  data?.forEach((quote: any) => {
    const date = new Date(quote.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

    if (!grouped[date]) {
      grouped[date] = { revenue: 0, quotes: 0 }
    }

    grouped[date].revenue += Number(quote.total) || 0
    grouped[date].quotes += 1
  })

  return Object.entries(grouped).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    quotes: data.quotes
  }))
}

/**
 * Get all analytics metrics
 */
export async function getAllMetrics(
  startDate: string,
  endDate: string
): Promise<AnalyticsMetrics> {
  const [funnel, revenue, ocr, totalQuotes, conversionRate] = await Promise.all([
    getQuoteFunnel(startDate, endDate),
    getRevenueMetrics(startDate, endDate),
    getOCRMetrics(),
    getTotalQuotes(startDate, endDate),
    getConversionRate(startDate, endDate)
  ])

  return {
    funnel,
    revenue,
    ocr,
    totalQuotes,
    conversionRate
  }
}

/**
 * Get quotes by status
 */
export async function getQuotesByStatus(
  startDate: string,
  endDate: string
): Promise<Array<{ status: string; count: number }>> {
  const { data, error } = await supabase
    .from('quotes')
    .select('status', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) {
    console.error('Error fetching quotes by status:', error)
    return []
  }

  const grouped: { [key: string]: number } = {}

  data?.forEach((quote: any) => {
    grouped[quote.status] = (grouped[quote.status] || 0) + 1
  })

  return Object.entries(grouped).map(([status, count]) => ({
    status,
    count
  }))
}

/**
 * Get margin analysis by product
 */
export async function getMarginByProduct(
  startDate: string,
  endDate: string
): Promise<Array<{ productName: string; totalRevenue: number; totalMargin: number; marginPercent: number }>> {
  const { data, error } = await supabase
    .from('quotes')
    .select('quote_lines!inner(product_name), total, margin_percent')
    .eq('status', 'accepted')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) {
    console.error('Error fetching margin analysis:', error)
    return []
  }

  const grouped: { [key: string]: { revenue: number; margin: number; count: number } } = {}

  data?.forEach((quote: any) => {
    quote.quote_lines?.forEach((line: any) => {
      const productName = line.product_name || 'Unknown'
      if (!grouped[productName]) {
        grouped[productName] = { revenue: 0, margin: 0, count: 0 }
      }
      grouped[productName].revenue += Number(quote.total) || 0
      grouped[productName].margin += (Number(quote.total) || 0) * (Number(quote.margin_percent) || 0) / 100
      grouped[productName].count += 1
    })
  })

  return Object.entries(grouped).map(([productName, data]) => ({
    productName,
    totalRevenue: data.revenue,
    totalMargin: data.margin,
    marginPercent: data.count > 0 ? Math.round((data.margin / data.revenue) * 100 * 100) / 100 : 0
  }))
}
