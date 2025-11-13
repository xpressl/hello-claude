import { db } from "./dexie"
import { QuoteDraft } from "./types"

/**
 * Generate a unique draft ID
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save a quote draft to IndexedDB
 */
export async function saveDraftToIndexedDB(draft: QuoteDraft): Promise<string> {
  const now = new Date().toISOString()
  const draftToSave: QuoteDraft = {
    ...draft,
    id: draft.id || generateDraftId(),
    updated_at: now,
    created_at: draft.created_at || now
  }

  await db.quoteDrafts.put(draftToSave)
  return draftToSave.id!
}

/**
 * Load a quote draft from IndexedDB by ID
 */
export async function loadDraftFromIndexedDB(id: string): Promise<QuoteDraft | undefined> {
  return await db.quoteDrafts.get(id)
}

/**
 * Get all quote drafts
 */
export async function getAllDrafts(): Promise<QuoteDraft[]> {
  return await db.quoteDrafts.toArray()
}

/**
 * Delete a quote draft from IndexedDB
 */
export async function deleteDraft(id: string): Promise<void> {
  await db.quoteDrafts.delete(id)
}

/**
 * Get the most recent draft
 */
export async function getMostRecentDraft(): Promise<QuoteDraft | undefined> {
  const drafts = await db.quoteDrafts.orderBy('updated_at').reverse().limit(1).toArray()
  return drafts[0]
}
