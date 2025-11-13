import { NextRequest, NextResponse } from "next/server"
import { getAllMetrics } from "@/lib/analytics/metrics"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Get date range from query parameters or use defaults (last 30 days)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const startDate = searchParams.get('start') || thirtyDaysAgo.toISOString()
  const endDate = searchParams.get('end') || now.toISOString()

  try {
    const metrics = await getAllMetrics(startDate, endDate)

    return NextResponse.json({
      success: true,
      data: metrics,
      dateRange: {
        start: startDate,
        end: endDate
      }
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
