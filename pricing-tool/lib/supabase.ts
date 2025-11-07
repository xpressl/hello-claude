import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Zod Schemas
export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  unit_type: z.enum(['EA', 'LF', 'SF', 'BOX', 'PKG', 'SET']),
  unit_price: z.number().positive(),
  aliases: z.array(z.string()).optional().default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export const ProductInsertSchema = ProductSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({ aliases: true })

export const ProductUpdateSchema = ProductSchema.partial().required({ id: true })

export type Product = z.infer<typeof ProductSchema>
export type ProductInsert = z.infer<typeof ProductInsertSchema>
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>

// Database Types
export type Database = {
  public: {
    Tables: {
      products: {
        Row: Product
        Insert: ProductInsert
        Update: ProductUpdate
      }
      users: {
        Row: {
          id: string
          email: string
          role: 'ADMIN' | 'SALES'
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'ADMIN' | 'SALES'
        }
        Update: {
          id?: string
          email?: string
          role?: 'ADMIN' | 'SALES'
        }
      }
    }
  }
}

// Browser Client (for client components)
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Server Client (for server components, API routes)
export function createSupabaseServerClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Typed Query Functions

/**
 * List products with optional search filter
 * @param search - Optional search term to filter by name, sku, or aliases
 * @returns Array of products matching the search criteria
 */
export async function listProducts(search?: string): Promise<Product[]> {
  const supabase = createSupabaseServerClient()

  let query = supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`
    query = query.or(
      `name.ilike.${searchTerm},sku.ilike.${searchTerm},aliases.cs.{${search.trim()}}`
    )
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list products: ${error.message}`)
  }

  // Validate with Zod
  return z.array(ProductSchema).parse(data)
}

/**
 * Get a single product by ID
 * @param id - Product UUID
 * @returns Single product or null if not found
 */
export async function getProductById(id: string): Promise<Product | null> {
  // Validate ID format
  const idSchema = z.string().uuid()
  const validatedId = idSchema.parse(id)

  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', validatedId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to get product: ${error.message}`)
  }

  // Validate with Zod
  return ProductSchema.parse(data)
}

/**
 * Upsert (insert or update) multiple products
 * @param rows - Array of products to upsert
 * @returns Array of upserted products
 */
export async function upsertProducts(
  rows: Array<ProductInsert | ProductUpdate>
): Promise<Product[]> {
  // Validate payloads
  const validatedRows = rows.map((row) => {
    if ('id' in row && row.id) {
      return ProductUpdateSchema.parse(row)
    } else {
      return ProductInsertSchema.parse(row)
    }
  })

  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('products')
    .upsert(validatedRows, {
      onConflict: 'sku', // Upsert based on unique SKU
      ignoreDuplicates: false,
    })
    .select()

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`)
  }

  // Validate with Zod
  return z.array(ProductSchema).parse(data)
}

/**
 * Get current user's role from the database
 * @returns User role or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<'ADMIN' | 'SALES' | null> {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return data.role
}
