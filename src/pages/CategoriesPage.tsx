import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { catalogApi } from '../api/catalog'
import type { Category } from '../api/types'
import { Badge, Button, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const create = useMutation({
    mutationFn: () => catalogApi.createCategory({ name: name.trim(), sortOrder: (categories.data?.length ?? 0) + 1 }),
    onSuccess: () => {
      setName('')
      setError(null)
      refresh()
    },
    onError: (e) => setError(e.message),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) create.mutate()
  }

  return (
    <>
      <PageHeader title="Categories" subtitle="Shown as chips in the app, in this order." />
      <form onSubmit={submit} className="card mb-4 flex flex-wrap items-center gap-2 p-4">
        <input
          className="input max-w-xs"
          placeholder="New category name, e.g. Soda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New category name"
        />
        <Button type="submit" busy={create.isPending} disabled={!name.trim()}>
          Add category
        </Button>
      </form>
      <ErrorBanner message={error ?? categories.error?.message} />

      <div className="card mt-2 overflow-x-auto">
        {categories.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.data?.map((category) => (
                <CategoryRow key={category.id} category={category} onChanged={refresh} onError={setError} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function CategoryRow({
  category,
  onChanged,
  onError,
}: {
  category: Category
  onChanged: () => void
  onError: (message: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder))

  const save = useMutation({
    mutationFn: (changes: Partial<Pick<Category, 'name' | 'sortOrder' | 'active'>>) =>
      catalogApi.updateCategory(category.id, {
        name: changes.name ?? category.name,
        sortOrder: changes.sortOrder ?? category.sortOrder,
        active: changes.active ?? category.active,
      }),
    onSuccess: () => {
      setEditing(false)
      onError(null)
      onChanged()
    },
    onError: (e) => onError(e.message),
  })
  const remove = useMutation({
    mutationFn: () => catalogApi.deleteCategory(category.id),
    onSuccess: () => {
      onError(null)
      onChanged()
    },
    onError: (e) => onError(e.message),
  })

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        {editing ? (
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Category name" />
        ) : (
          <>
            <span className="font-medium">{category.name}</span>
            <Link to={`/products?category=${category.slug}`} className="ml-2 text-xs text-brand hover:underline">
              products
            </Link>
          </>
        )}
      </td>
      <td className="w-28 px-4 py-3">
        {editing ? (
          <input className="input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort order" />
        ) : (
          category.sortOrder
        )}
      </td>
      <td className="px-4 py-3">{category.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
      <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
        {editing ? (
          <>
            <Button busy={save.isPending} onClick={() => save.mutate({ name: name.trim(), sortOrder: Number(sortOrder) })}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="secondary" busy={save.isPending} onClick={() => save.mutate({ active: !category.active })}>
              {category.active ? 'Hide' : 'Show'}
            </Button>
            <Button
              variant="danger"
              busy={remove.isPending}
              onClick={() => confirmAction(`Delete the category "${category.name}"?`) && remove.mutate()}
            >
              Delete
            </Button>
          </>
        )}
      </td>
    </tr>
  )
}
