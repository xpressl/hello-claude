"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Edit2, Trash2, Folder } from "lucide-react"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  product_count?: number
  level?: number
}

interface CategoryTreeViewProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  onMove?: (categoryId: string, newParentId: string | null) => void
}

export function CategoryTreeView({
  categories,
  onEdit,
  onDelete,
  onMove,
}: CategoryTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Build a tree structure from flat categories
  const buildTree = (parentId: string | null = null): Category[] => {
    return categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const hasChildren = (categoryId: string) => {
    return categories.some((c) => c.parent_id === categoryId)
  }

  return (
    <div className="p-4 space-y-1">
      <CategoryNodeList
        categories={buildTree()}
        expandedIds={expandedIds}
        draggedId={draggedId}
        allCategories={categories}
        level={0}
        onToggleExpanded={toggleExpanded}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        onDragStart={setDraggedId}
        onDragEnd={() => setDraggedId(null)}
        hasChildren={hasChildren}
        buildTree={buildTree}
      />
    </div>
  )
}

interface CategoryNodeListProps {
  categories: Category[]
  expandedIds: Set<string>
  draggedId: string | null
  allCategories: Category[]
  level: number
  onToggleExpanded: (id: string) => void
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  onMove?: (categoryId: string, newParentId: string | null) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  hasChildren: (id: string) => boolean
  buildTree: (parentId: string | null) => Category[]
}

function CategoryNodeList({
  categories,
  expandedIds,
  draggedId,
  allCategories,
  level,
  onToggleExpanded,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  hasChildren,
  buildTree,
}: CategoryNodeListProps) {
  return (
    <>
      {categories.map((category) => {
        const children = buildTree(category.id)
        const isExpanded = expandedIds.has(category.id)
        const isDragged = draggedId === category.id

        return (
          <div key={category.id}>
            <div
              draggable
              onDragStart={() => onDragStart(category.id)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedId && draggedId !== category.id && onMove) {
                  onMove(draggedId, category.id)
                }
              }}
              className={`flex items-center gap-2 p-3 rounded-lg cursor-move transition ${
                isDragged
                  ? "opacity-50 bg-gray-100"
                  : "hover:bg-gray-50 border border-transparent hover:border-gray-200"
              }`}
              style={{ marginLeft: `${level * 24}px` }}
            >
              {/* Expand/Collapse button */}
              <button
                onClick={() => onToggleExpanded(category.id)}
                className="flex-shrink-0 p-1"
                disabled={!hasChildren(category.id)}
              >
                {hasChildren(category.id) ? (
                  isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )
                ) : (
                  <div className="w-4" />
                )}
              </button>

              {/* Folder icon */}
              <Folder size={18} className="text-blue-500 flex-shrink-0" />

              {/* Category info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {category.name}
                </div>
                <div className="text-sm text-gray-500">
                  {category.product_count || 0} product
                  {(category.product_count || 0) !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => onEdit(category)}
                  className="p-1.5 hover:bg-blue-100 hover:text-blue-600 rounded transition"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(category.id)}
                  className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Children */}
            {isExpanded && children.length > 0 && (
              <CategoryNodeList
                categories={children}
                expandedIds={expandedIds}
                draggedId={draggedId}
                allCategories={allCategories}
                level={level + 1}
                onToggleExpanded={onToggleExpanded}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                hasChildren={hasChildren}
                buildTree={buildTree}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
