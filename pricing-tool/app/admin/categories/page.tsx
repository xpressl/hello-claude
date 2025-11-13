"use client"

// Force dynamic rendering - this page uses Supabase
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { CategoryTreeView } from "@/components/admin/CategoryTreeView"
import { CategoryEditorModal } from "@/components/admin/CategoryEditorModal"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  image_url: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  metadata_json: Record<string, any> | null
  product_count?: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load categories
  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc("get_category_tree")

      if (error) {
        setError(error.message)
        return
      }

      setCategories(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleAddCategory = () => {
    setEditingCategory(null)
    setShowEditor(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setShowEditor(true)
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (
      !confirm(
        "Are you sure? This will also delete all child categories and remove category assignments."
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId)

      if (error) {
        setError(error.message)
        return
      }

      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category")
    }
  }

  const handleMoveCategory = async (
    categoryId: string,
    newParentId: string | null
  ) => {
    try {
      const { error } = await supabase
        .from("categories")
        .update({ parent_id: newParentId })
        .eq("id", categoryId)

      if (error) {
        setError(error.message)
        return
      }

      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move category")
    }
  }

  const handleSaveCategory = async (
    categoryData: Partial<Category>
  ) => {
    try {
      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", editingCategory.id)

        if (error) {
          setError(error.message)
          return
        }
      } else {
        // Create new
        const { error } = await supabase
          .from("categories")
          .insert([categoryData])

        if (error) {
          setError(error.message)
          return
        }
      }

      setShowEditor(false)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category")
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1">
            Manage product categories and hierarchy
          </p>
        </div>
        <button
          onClick={handleAddCategory}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Add Category
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <CategoryTreeView
            categories={categories}
            onEdit={handleEditCategory}
            onDelete={handleDeleteCategory}
            onMove={handleMoveCategory}
          />
        </div>
      )}

      {showEditor && (
        <CategoryEditorModal
          category={editingCategory}
          categories={categories}
          onSave={handleSaveCategory}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
