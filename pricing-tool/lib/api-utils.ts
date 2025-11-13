import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { QuoteStatusType } from "./validations"

// Create Supabase client for API routes
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// Error response helper
export function errorResponse(
  message: string,
  status: number,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
    },
    { status }
  )
}

// Success response helper
export function successResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

// Auth result type
export interface AuthResult {
  userId: string
  email: string
  role: "ADMIN" | "SALES"
}

// Get authentication token from request
function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader) return null

  // Support both "Bearer token" and just "token"
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }
  return authHeader
}

// Require authentication
export async function requireAuth(
  request: Request
): Promise<{ error: NextResponse } | { auth: AuthResult }> {
  const token = getAuthToken(request)
  if (!token) {
    return {
      error: errorResponse("Authentication required", 401),
    }
  }

  const supabase = getSupabaseClient()

  // Verify the token and get user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return {
      error: errorResponse("Invalid authentication token", 401),
    }
  }

  // Get user's role from the users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single()

  if (userError || !userData) {
    return {
      error: errorResponse("User not found in database", 403),
    }
  }

  return {
    auth: {
      userId: user.id,
      email: userData.email,
      role: userData.role as "ADMIN" | "SALES",
    },
  }
}

// Require specific role(s)
export async function requireRole(
  request: Request,
  allowedRoles: ("ADMIN" | "SALES")[]
): Promise<{ error: NextResponse } | { auth: AuthResult }> {
  const authResult = await requireAuth(request)

  if ("error" in authResult) {
    return authResult
  }

  if (!allowedRoles.includes(authResult.auth.role)) {
    return {
      error: errorResponse(
        `Forbidden. Required role: ${allowedRoles.join(" or ")}`,
        403
      ),
    }
  }

  return authResult
}

// Validate quote status
export function validateQuoteStatus(status: string): boolean {
  const validStatuses: QuoteStatusType[] = [
    "draft",
    "submitted",
    "reviewed",
    "sent",
    "accepted",
    "declined",
    "expired",
  ]
  return validStatuses.includes(status as QuoteStatusType)
}

// Get client IP from request headers
export function getClientIP(request: Request): string | null {
  // Try various headers that might contain the client IP
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip", // Cloudflare
    "x-client-ip",
  ]

  for (const header of headers) {
    const value = request.headers.get(header)
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return value.split(",")[0].trim()
    }
  }

  return null
}

// Get user agent from request
export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")
}

// Parse and validate JSON body
export async function parseJsonBody<T>(
  request: Request,
  schema: { parse: (data: any) => T }
): Promise<{ error: NextResponse } | { data: T }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data }
  } catch (error: any) {
    // Check if it's a Zod validation error
    if (error.errors && Array.isArray(error.errors)) {
      return {
        error: errorResponse("Validation error", 422, {
          validation_errors: error.errors,
        }),
      }
    }
    return {
      error: errorResponse("Invalid JSON body", 400, {
        message: error.message,
      }),
    }
  }
}

// Helper to recalculate quote totals
export async function recalculateQuoteTotals(
  quoteId: string
): Promise<{ subtotal: number; total: number }> {
  const supabase = getSupabaseClient()

  // Get all lines for the quote
  const { data: lines, error } = await supabase
    .from("quote_lines")
    .select("extended_price")
    .eq("quote_id", quoteId)

  if (error) {
    throw new Error(`Failed to fetch quote lines: ${error.message}`)
  }

  // Calculate subtotal
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.extended_price),
    0
  )

  // Get tax from quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("tax")
    .eq("id", quoteId)
    .single()

  if (quoteError) {
    throw new Error(`Failed to fetch quote: ${quoteError.message}`)
  }

  const tax = Number(quote.tax || 0)
  const total = subtotal + tax

  // Update quote totals
  const { error: updateError } = await supabase
    .from("quotes")
    .update({ subtotal, total })
    .eq("id", quoteId)

  if (updateError) {
    throw new Error(`Failed to update quote totals: ${updateError.message}`)
  }

  return { subtotal, total }
}

// Helper to get next line number
export async function getNextLineNumber(quoteId: string): Promise<number> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from("quote_lines")
    .select("line_number")
    .eq("quote_id", quoteId)
    .order("line_number", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to get max line number: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return 1
  }

  return data[0].line_number + 1
}

// Helper to create event
export async function createEvent(
  quoteId: string,
  eventType: string,
  payload: any = {},
  userId?: string,
  request?: Request
): Promise<void> {
  const supabase = getSupabaseClient()

  const eventData: any = {
    quote_id: quoteId,
    event_type: eventType,
    payload_json: payload,
  }

  if (userId) {
    eventData.user_id = userId
  }

  if (request) {
    const ip = getClientIP(request)
    const userAgent = getUserAgent(request)

    if (ip) eventData.ip_address = ip
    if (userAgent) eventData.user_agent = userAgent
  }

  const { error } = await supabase.from("events").insert(eventData)

  if (error) {
    // Log but don't fail the request if event creation fails
    console.error("Failed to create event:", error.message)
  }
}
