import { z } from "zod"

// Quote status enum
export const QuoteStatus = z.enum([
  "draft",
  "submitted",
  "reviewed",
  "sent",
  "accepted",
  "declined",
  "expired",
])
export type QuoteStatusType = z.infer<typeof QuoteStatus>

// Metadata schema
export const MetadataSchema = z.object({
  source: z.enum(["web", "mobile"]).optional(),
  referrer: z.string().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
})

// Create Quote Schema
export const CreateQuoteSchema = z.object({
  customer_name: z.string().min(1).max(255).optional(),
  customer_email: z.string().email().max(255).optional(),
  customer_phone: z.string().max(50).optional(),
  metadata: MetadataSchema.optional(),
})
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>

// Update Quote Schema
export const UpdateQuoteSchema = z.object({
  customer_name: z.string().min(1).max(255).optional(),
  customer_email: z.string().email().max(255).optional(),
  customer_phone: z.string().max(50).optional(),
  status: QuoteStatus.optional(),
  currency: z.string().length(3).optional(),
  tax: z.number().nonnegative().optional(),
  margin_percent: z.number().min(0).max(100).optional(),
  expires_at: z.string().datetime().optional(),
})
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>

// Line source enum
export const LineSource = z.enum([
  "manual",
  "ocr",
  "asr",
  "paste",
  "spreadsheet",
  "voice",
])

// Create Quote Line Schema
export const CreateLineSchema = z.object({
  catalog_item_id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().max(20).optional().default("EA"),
  options: z.record(z.any()).optional(),
  unit_price: z.number().nonnegative(),
  source: LineSource.optional().default("manual"),
  confidence_score: z.number().min(0).max(1).optional(),
  mapping_warnings: z.record(z.any()).optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateLineInput = z.infer<typeof CreateLineSchema>

// Update Quote Line Schema
export const UpdateLineSchema = z.object({
  quantity: z.number().positive().optional(),
  unit_price: z.number().nonnegative().optional(),
  options: z.record(z.any()).optional(),
  description: z.string().min(1).max(500).optional(),
  notes: z.string().max(1000).optional(),
})
export type UpdateLineInput = z.infer<typeof UpdateLineSchema>

// List Quotes Query Schema
export const ListQuotesQuerySchema = z.object({
  status: QuoteStatus.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
export type ListQuotesQuery = z.infer<typeof ListQuotesQuerySchema>

// Helper to validate quote status
export function isValidQuoteStatus(status: string): status is QuoteStatusType {
  return QuoteStatus.safeParse(status).success
}

// Helper to check if quote is locked (cannot be modified)
export function isQuoteLocked(status: QuoteStatusType): boolean {
  return ["sent", "accepted", "declined", "expired"].includes(status)
}

// Helper to check if quote can be deleted
export function isQuoteDeletable(status: QuoteStatusType): boolean {
  return status === "draft"
}
