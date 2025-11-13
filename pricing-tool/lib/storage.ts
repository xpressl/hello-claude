/**
 * Supabase Storage Utilities
 * Helper functions for generating signed URLs and managing storage
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Create Supabase client with service role key
 * Required for generating signed URLs
 */
function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Generate a signed URL for a single upload
 * Allows secure download of files without making them public
 *
 * @param storagePath - Path to file in storage (e.g., "quotes/123/file.pdf")
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedUploadUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = getServiceRoleClient()

    const { data, error } = await supabase
      .storage
      .from('quote-uploads')
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      console.error('Error generating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Unexpected error generating signed URL:', error)
    return null
  }
}

/**
 * Generate signed URLs for multiple uploads
 * Batch operation for efficiency
 *
 * @param storagePaths - Array of storage paths
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Map of path -> signed URL (excludes failed URLs)
 */
export async function getSignedUrls(
  storagePaths: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> {
  try {
    const supabase = getServiceRoleClient()

    const { data, error } = await supabase
      .storage
      .from('quote-uploads')
      .createSignedUrls(storagePaths, expiresIn)

    if (error) {
      console.error('Error generating signed URLs:', error)
      return {}
    }

    // Convert array to map, filtering out any errors
    const urlMap: Record<string, string> = {}
    data.forEach((item) => {
      if (item.signedUrl && !item.error) {
        urlMap[item.path] = item.signedUrl
      }
    })

    return urlMap
  } catch (error) {
    console.error('Unexpected error generating signed URLs:', error)
    return {}
  }
}

/**
 * Delete a file from storage
 * Used for rollback when database operations fail
 *
 * @param storagePath - Path to file in storage
 * @returns True if deleted successfully, false otherwise
 */
export async function deleteFile(storagePath: string): Promise<boolean> {
  try {
    const supabase = getServiceRoleClient()

    const { error } = await supabase
      .storage
      .from('quote-uploads')
      .remove([storagePath])

    if (error) {
      console.error('Error deleting file from storage:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Unexpected error deleting file:', error)
    return false
  }
}

/**
 * Delete multiple files from storage
 * Batch operation for efficiency
 *
 * @param storagePaths - Array of storage paths to delete
 * @returns Number of files successfully deleted
 */
export async function deleteFiles(storagePaths: string[]): Promise<number> {
  try {
    const supabase = getServiceRoleClient()

    const { data, error } = await supabase
      .storage
      .from('quote-uploads')
      .remove(storagePaths)

    if (error) {
      console.error('Error deleting files from storage:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('Unexpected error deleting files:', error)
    return 0
  }
}

/**
 * Get public URL for a file (only works if bucket is public)
 * Note: quote-uploads bucket is private, so this will not work without signed URL
 * This is included for completeness
 *
 * @param storagePath - Path to file in storage
 * @returns Public URL
 */
export function getPublicUrl(storagePath: string): string {
  const supabase = getServiceRoleClient()
  const { data } = supabase
    .storage
    .from('quote-uploads')
    .getPublicUrl(storagePath)

  return data.publicUrl
}

/**
 * Check if a file exists in storage
 *
 * @param storagePath - Path to file in storage
 * @returns True if file exists, false otherwise
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    const supabase = getServiceRoleClient()

    const { data, error } = await supabase
      .storage
      .from('quote-uploads')
      .list(storagePath.substring(0, storagePath.lastIndexOf('/')), {
        search: storagePath.substring(storagePath.lastIndexOf('/') + 1),
      })

    if (error) {
      return false
    }

    return data.length > 0
  } catch (error) {
    return false
  }
}
