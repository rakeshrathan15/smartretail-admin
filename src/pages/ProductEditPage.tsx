import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { catalogApi, imageProblem } from '../api/catalog'
import { ApiError } from '../api/client'
import type { AdminProduct } from '../api/types'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatRupees } from '../lib/format'
import {
  emptyProductForm,
  formFromProduct,
  inputFromForm,
  parseSlabs,
  productFormErrors,
  rowsFromSlabs,
  type ProductFormValues,
  type SlabRow,
} from './productForm'

/** /products/new creates a product; /products/:id edits one, including slabs and photos. */
export function ProductEditPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.product(id!),
    enabled: !isNew,
  })

  if (!isNew && product.isPending) return <Spinner />
  if (!isNew && product.error) return <ErrorBanner message={product.error.message} />

  return <ProductEditor key={id ?? 'new'} existing={product.data ?? null} />
}

function ProductEditor({ existing }: { existing: AdminProduct | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const [form, setForm] = useState<ProductFormValues>(existing ? formFromProduct(existing) : emptyProductForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const justCreated = (location.state as { created?: boolean } | null)?.created === true

  const save = useMutation({
    mutationFn: () => {
      const body = inputFromForm(form)
      return existing ? catalogApi.updateProduct(existing.product.id, body) : catalogApi.createProduct(body)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['product', saved.product.id], saved)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (!existing) navigate(`/products/${saved.product.id}`, { replace: true, state: { created: true } })
    },
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  const remove = useMutation({
    mutationFn: () => catalogApi.deleteProduct(existing!.product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/products')
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = productFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const set = (key: keyof ProductFormValues) => (value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))
  const textInput = (key: keyof ProductFormValues, props: Record<string, unknown> = {}) => (
    <input
      className="input"
      value={form[key] as string}
      onChange={(e) => set(key)(e.target.value)}
      aria-invalid={errors[key] ? true : undefined}
      {...props}
    />
  )

  const margin =
    form.costPrice.trim() !== '' && form.price.trim() !== '' ? Number(form.price) - Number(form.costPrice) : null

  return (
    <>
      <PageHeader
        title={existing ? existing.product.name : 'New product'}
        subtitle={existing ? `/${existing.product.slug}` : 'Fill in the details, then add bulk prices and photos.'}
        actions={
          <>
            <Link to="/products" className="self-center text-sm text-slate-600 hover:underline">
              ← All products
            </Link>
            {existing && (
              <Button
                variant="danger"
                busy={remove.isPending}
                onClick={() => {
                  if (confirmAction(`Delete "${existing.product.name}"? This cannot be undone. Hide it instead to keep its history.`)) {
                    remove.mutate()
                  }
                }}
              >
                Delete
              </Button>
            )}
          </>
        }
      />

      {justCreated && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Product created. Add bulk prices and photos below.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form onSubmit={submit} className="card space-y-5 p-5" noValidate>
          <h2 className="font-semibold">Details</h2>
          <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
          <ErrorBanner message={remove.error?.message} />

          <Section>
            <Field label="Product name *" error={errors.name}>
              {textInput('name', { placeholder: 'Thums Up 750ml PET' })}
            </Field>
            <Field label="Category" error={errors.categoryId}>
              <select className="input" value={form.categoryId} onChange={(e) => set('categoryId')(e.target.value)}>
                <option value="">No category</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.active ? '' : ' (hidden)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand" error={errors.brand}>
              {textInput('brand')}
            </Field>
            <Field label="Flavour" error={errors.flavor}>
              {textInput('flavor')}
            </Field>
          </Section>

          <Section>
            <Field label="Volume per unit (ml)" error={errors.unitVolumeMl}>
              {textInput('unitVolumeMl', { type: 'number', min: 1 })}
            </Field>
            <Field label="Units per case *" error={errors.unitsPerCase}>
              {textInput('unitsPerCase', { type: 'number', min: 1 })}
            </Field>
          </Section>

          <Section>
            <Field label="Price per case (₹) *" error={errors.price}>
              {textInput('price', { type: 'number', min: 0, step: '0.01' })}
            </Field>
            <Field label="Original price (₹)" error={errors.originalPrice} hint="Shown struck through when higher than the price">
              {textInput('originalPrice', { type: 'number', min: 0, step: '0.01' })}
            </Field>
            <Field
              label="Cost price (₹)"
              error={errors.costPrice}
              hint={margin !== null ? `Margin ${formatRupees(margin)} per case` : 'What you pay the supplier; never shown to shops'}
            >
              {textInput('costPrice', { type: 'number', min: 0, step: '0.01' })}
            </Field>
          </Section>

          <Section>
            <Field
              label={existing ? 'Stock (cases)' : 'Opening stock (cases)'}
              error={errors.stockQuantity}
              hint={existing ? 'Change it under Inventory or Stock receipts, so there is a record' : undefined}
            >
              {textInput('stockQuantity', { type: 'number', min: 0, disabled: existing !== null })}
            </Field>
            <Field label="Low-stock alert at" error={errors.lowStockThreshold}>
              {textInput('lowStockThreshold', { type: 'number', min: 0 })}
            </Field>
            <Field label="Barcode" error={errors.barcode}>
              {textInput('barcode')}
            </Field>
            <Field label="Badge" error={errors.badge} hint="e.g. Bestseller, New">
              {textInput('badge')}
            </Field>
          </Section>

          <Field label="Description" error={errors.description}>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </Field>
          <Field label="Ingredients" error={errors.ingredients}>
            <textarea className="input" rows={2} value={form.ingredients} onChange={(e) => set('ingredients')(e.target.value)} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active')(e.target.checked)} />
            Visible to shops (uncheck to hide without deleting)
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" busy={save.isPending}>
              {existing ? 'Save changes' : 'Create product'}
            </Button>
            {save.isSuccess && existing && <span className="text-sm text-green-700">Saved</span>}
          </div>
        </form>

        {existing ? (
          <div className="space-y-6">
            <SlabsEditor product={existing} />
            <ImagesEditor product={existing} />
          </div>
        ) : (
          <div className="card p-5 text-sm text-slate-500">Bulk prices and photos can be added after the product is created.</div>
        )}
      </div>
    </>
  )
}

function Section({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

function SlabsEditor({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient()
  const basePrice = product.product.price
  const [rows, setRows] = useState<SlabRow[]>(() => rowsFromSlabs(product.product.slabs))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Reset the rows when the saved slabs change, e.g. after saving.
  const [syncedSlabs, setSyncedSlabs] = useState(product.product.slabs)
  if (product.product.slabs !== syncedSlabs) {
    setSyncedSlabs(product.product.slabs)
    setRows(rowsFromSlabs(product.product.slabs))
  }

  const save = useMutation({
    mutationFn: (slabs: Parameters<typeof catalogApi.replaceSlabs>[1]) => catalogApi.replaceSlabs(product.product.id, slabs),
    onSuccess: (updated) => {
      queryClient.setQueryData(['product', updated.product.id], updated)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSaved(true)
    },
    onError: (e) => setError(e.message),
  })

  function submit() {
    setSaved(false)
    const result = parseSlabs(rows, basePrice)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setError(null)
    save.mutate(result.slabs)
  }

  const update = (index: number, key: keyof SlabRow, value: string) => {
    setSaved(false)
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const suggestNext = () => {
    const last = rows.at(-1)
    const nextMin = last ? Number(last.maxQty || last.minQty) + 1 : 10
    setRows([...rows, { minQty: String(nextMin), maxQty: '', pricePerCase: '' }])
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">Bulk prices</h2>
        <span className="text-sm text-slate-500">Base {formatRupees(basePrice)} / case</span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Ordering at least <em>min cases</em> pays the slab price for every case. Leave max empty for "and above".
      </p>
      <ErrorBanner message={error} />
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-2">Min cases</th>
            <th className="py-2 pr-2">Max cases</th>
            <th className="py-2 pr-2">Price / case (₹)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-slate-500">
                No bulk prices. Every order pays the base price.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <input className="input" type="number" min={1} aria-label={`Min cases, slab ${i + 1}`} value={row.minQty} onChange={(e) => update(i, 'minQty', e.target.value)} />
              </td>
              <td className="py-1 pr-2">
                <input className="input" type="number" min={1} placeholder="and above" aria-label={`Max cases, slab ${i + 1}`} value={row.maxQty} onChange={(e) => update(i, 'maxQty', e.target.value)} />
              </td>
              <td className="py-1 pr-2">
                <input className="input" type="number" min={0} step="0.01" aria-label={`Price per case, slab ${i + 1}`} value={row.pricePerCase} onChange={(e) => update(i, 'pricePerCase', e.target.value)} />
                {row.pricePerCase !== '' && Number(row.pricePerCase) < basePrice && (
                  <span className="text-xs text-green-700">
                    {Math.round(((basePrice - Number(row.pricePerCase)) / basePrice) * 100)}% off
                  </span>
                )}
              </td>
              <td className="py-1 text-right">
                <Button variant="ghost" aria-label={`Remove slab ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" onClick={suggestNext}>
          + Add slab
        </Button>
        <Button onClick={submit} busy={save.isPending}>
          Save bulk prices
        </Button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </section>
  )
}

function ImagesEditor({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient()
  const id = product.product.id
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const apply = (updated: AdminProduct) => {
    queryClient.setQueryData(['product', id], updated)
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const makePrimary = useMutation({
    mutationFn: (imageId: string) => catalogApi.makePrimaryImage(id, imageId),
    onSuccess: apply,
    onError: (e) => setError(e.message),
  })
  const remove = useMutation({
    mutationFn: (imageId: string) => catalogApi.deleteImage(id, imageId),
    onSuccess: apply,
    onError: (e) => setError(e.message),
  })

  async function upload(files: File[]) {
    if (files.length === 0) return
    setError(null)
    const problems = files.map(imageProblem).filter(Boolean)
    if (problems.length > 0) {
      setError(problems.join('. '))
      return
    }
    setUploading(true)
    try {
      for (const file of files) apply(await catalogApi.uploadImage(id, file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const images = product.product.images
  return (
    <section className="card p-5">
      <h2 className="mb-1 font-semibold">Photos</h2>
      <p className="mb-4 text-sm text-slate-500">JPG, PNG or WebP up to 5 MB. The main photo is shown in lists.</p>
      <ErrorBanner message={error} />
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image) => (
          <figure key={image.id} className="overflow-hidden rounded-md border border-slate-200">
            <img src={image.url} alt="" className="aspect-square w-full object-cover" />
            <figcaption className="flex items-center justify-between gap-1 p-2">
              {image.primary ? (
                <Badge tone="blue">Main</Badge>
              ) : (
                <button type="button" className="text-xs text-brand hover:underline" onClick={() => makePrimary.mutate(image.id)}>
                  Make main
                </button>
              )}
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => confirmAction('Delete this photo?') && remove.mutate(image.id)}
              >
                Delete
              </button>
            </figcaption>
          </figure>
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand hover:text-brand">
          {uploading ? <Spinner /> : <span className="text-2xl">+</span>}
          <span>{uploading ? 'Uploading…' : 'Add photos'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            aria-label="Upload photos"
            disabled={uploading}
            onChange={(e) => {
              // Copy the files first: clearing the input (so the same file can be picked again) empties its list.
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              void upload(files)
            }}
          />
        </label>
      </div>
    </section>
  )
}
