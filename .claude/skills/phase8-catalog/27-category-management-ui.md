# Task 27: Category Management UI

## Objective
Create admin UI for managing categories with tree view, drag-and-drop reorganization, bulk product assignment, and category-specific settings.

## Context
- Visual tree view of category hierarchy
- Drag-and-drop to reorganize
- Add/edit/delete categories
- Bulk assign products to categories
- Set category-specific pricing markup

## Requirements

### 1. Category Tree View

**File:** `pricing-tool/app/admin/categories/page.tsx`

```typescript
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button onClick={handleAddCategory} className="btn btn-primary">
          Add Category
        </button>
      </div>

      <CategoryTreeView
        categories={categories}
        onMove={handleMoveCategory}
        onEdit={handleEditCategory}
        onDelete={handleDeleteCategory}
      />
    </div>
  )
}
```

### 2. Drag-and-Drop Tree

**File:** `pricing-tool/components/admin/CategoryTreeView.tsx`

```typescript
import { DndProvider, useDrag, useDrop } from 'react-dnd'

export function CategoryTreeView({ categories, onMove }: Props) {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-1">
        {categories.filter(c => !c.parent_id).map(category => (
          <CategoryNode
            key={category.id}
            category={category}
            children={categories.filter(c => c.parent_id === category.id)}
            level={0}
            onMove={onMove}
          />
        ))}
      </div>
    </DndProvider>
  )
}

function CategoryNode({ category, children, level, onMove }: NodeProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'category',
    item: { id: category.id },
    collect: (monitor) => ({isDragging: monitor.isDragging()})
  })

  const [{ isOver }, drop] = useDrop({
    accept: 'category',
    drop: (item: { id: string }) => onMove(item.id, category.id),
    collect: (monitor) => ({ isOver: monitor.isOver() })
  })

  return (
    <div ref={drag}>
      <div
        ref={drop}
        className={`p-3 border rounded ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-blue-50' : ''}`}
        style={{ marginLeft: level * 24 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400" />
            <Folder className="h-5 w-5" />
            <span className="font-medium">{category.name}</span>
            <span className="text-sm text-gray-500">({category.product_count})</span>
          </div>
          <CategoryActions category={category} />
        </div>
      </div>
      {children.map(child => (
        <CategoryNode
          key={child.id}
          category={child}
          children={categories.filter(c => c.parent_id === child.id)}
          level={level + 1}
          onMove={onMove}
        />
      ))}
    </div>
  )
}
```

### 3. Category Editor Modal

**File:** `pricing-tool/components/admin/CategoryEditorModal.tsx`

```typescript
export function CategoryEditorModal({ category, onSave, onClose }: Props) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    parent_id: category?.parent_id || null,
    image_url: category?.image_url || '',
    markup_percent: category?.metadata_json?.markup_percent || 0
  })

  return (
    <Modal open onClose={onClose}>
      <h2 className="text-xl font-bold mb-4">
        {category ? 'Edit Category' : 'Add Category'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input w-full"
          />
        </div>

        <div>
          <label>Parent Category</label>
          <CategorySelector
            value={formData.parent_id}
            onChange={(id) => setFormData({ ...formData, parent_id: id })}
          />
        </div>

        <div>
          <label>Default Markup %</label>
          <input
            type="number"
            value={formData.markup_percent}
            onChange={(e) => setFormData({ ...formData, markup_percent: parseFloat(e.target.value) })}
            className="input w-full"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

### 4. Bulk Product Assignment

**File:** `pricing-tool/components/admin/BulkProductAssignment.tsx`

```typescript
export function BulkProductAssignment({ categoryId }: Props) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  const handleAssign = async () => {
    await fetch(`/api/categories/${categoryId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productIds: selectedProducts })
    })
  }

  return (
    <div>
      <h3>Assign Products to Category</h3>
      <ProductSelector
        multiple
        value={selectedProducts}
        onChange={setSelectedProducts}
      />
      <button onClick={handleAssign} className="btn btn-primary">
        Assign {selectedProducts.length} Products
      </button>
    </div>
  )
}
```

## Files to Create
- `pricing-tool/app/admin/categories/page.tsx`
- `pricing-tool/components/admin/CategoryTreeView.tsx`
- `pricing-tool/components/admin/CategoryEditorModal.tsx`
- `pricing-tool/components/admin/BulkProductAssignment.tsx`

## Testing Requirements
1. Create parent category
2. Create child category
3. Drag category to new parent
4. Edit category details
5. Delete category (with confirmation)
6. Bulk assign products

## Acceptance Criteria
- [ ] Tree view displays hierarchy
- [ ] Drag-and-drop reorganization works
- [ ] Add/edit/delete categories functional
- [ ] Bulk product assignment works
- [ ] Category settings saved
- [ ] Confirmation before delete

## Dependencies
- Task 25 (categories schema)
- react-dnd library

## Estimated Effort
6-8 hours

## Review Checklist
- [ ] Drag-and-drop smooth
- [ ] Tree updates optimistically
- [ ] Circular references prevented
- [ ] Delete confirms and cascades
- [ ] Mobile layout acceptable
- [ ] Performance with 100+ categories
