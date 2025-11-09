import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(url, anon)

const Row = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit_type: z.enum(["EACH", "LF", "SF", "BF", "BOX", "CASE"]),
  unit_price: z.number().nonnegative(),
  aliases: z.array(z.string()).optional().default([]),
})
export type UpsertRow = z.infer<typeof Row>

export async function upsertProducts(rows: UpsertRow[]) {
  const parsed = z.array(Row).parse(rows)
  const { error } = await supabase.from("products").upsert(parsed, { onConflict: "sku" })
  if (error) throw new Error(error.message)
}

// Re-export Product type for compatibility
export type Product = {
  id: string
  sku: string
  name: string
  unit_type: string
  unit_price: number
  aliases?: string[]
  updated_at?: string
}
