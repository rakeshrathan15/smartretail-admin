import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { catalogApi, imageProblem } from '../api/catalog'
import type { Banner, BannerInput } from '../api/types'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'

const emptyBanner: BannerInput = { title: '', subtitle: null, ctaText: null, link: null, active: true }

export function BannersPage() {
  const queryClient = useQueryClient()
  const banners = useQuery({ queryKey: ['banners'], queryFn: catalogApi.banners })
  const [editing, setEditing] = useState<Banner | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['banners'] })

  const reorder = useMutation({
    mutationFn: catalogApi.reorderBanners,
    onSuccess: (list) => queryClient.setQueryData(['banners'], list),
    onError: (e) => setError(e.message),
  })

  function move(index: number, by: -1 | 1) {
    const ids = banners.data!.map((b) => b.id)
    const target = index + by
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  const list = banners.data ?? []
  return (
    <>
      <PageHeader
        title="Banners"
        subtitle="The carousel at the top of the app's home screen, in this order."
        actions={editing === null && <Button onClick={() => setEditing('new')}>+ New banner</Button>}
      />
      <ErrorBanner message={error ?? banners.error?.message} />

      {editing !== null && (
        <BannerForm
          banner={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {banners.isPending && <Spinner />}
      <div className="mt-4 space-y-3">
        {list.map((banner, index) => (
          <BannerCard
            key={banner.id}
            banner={banner}
            first={index === 0}
            last={index === list.length - 1}
            busy={reorder.isPending}
            onMove={(by) => move(index, by)}
            onEdit={() => setEditing(banner)}
            onChanged={refresh}
            onError={setError}
          />
        ))}
        {banners.isSuccess && list.length === 0 && <p className="text-sm text-slate-500">No banners yet.</p>}
      </div>
    </>
  )
}

function BannerCard({
  banner,
  first,
  last,
  busy,
  onMove,
  onEdit,
  onChanged,
  onError,
}: {
  banner: Banner
  first: boolean
  last: boolean
  busy: boolean
  onMove: (by: -1 | 1) => void
  onEdit: () => void
  onChanged: () => void
  onError: (message: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)

  const toggle = useMutation({
    mutationFn: () => catalogApi.updateBanner(banner.id, { ...toInput(banner), active: !banner.active }),
    onSuccess: onChanged,
    onError: (e) => onError(e.message),
  })
  const remove = useMutation({
    mutationFn: () => catalogApi.deleteBanner(banner.id),
    onSuccess: onChanged,
    onError: (e) => onError(e.message),
  })

  async function upload(file: File | undefined) {
    if (!file) return
    const problem = imageProblem(file)
    if (problem) return onError(problem)
    setUploading(true)
    try {
      await catalogApi.uploadBannerImage(banner.id, file)
      onError(null)
      onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div
        className="relative flex h-28 w-full shrink-0 flex-col justify-center overflow-hidden rounded-md bg-gradient-to-r from-brand to-blue-500 p-4 text-white sm:w-72"
        style={banner.imageUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)), url(${banner.imageUrl})`, backgroundSize: 'cover' } : undefined}
      >
        <div className="truncate font-semibold">{banner.title}</div>
        {banner.subtitle && <div className="line-clamp-2 text-xs text-white/90">{banner.subtitle}</div>}
        {banner.ctaText && <span className="mt-2 self-start rounded bg-white px-2 py-0.5 text-xs text-brand">{banner.ctaText}</span>}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <div className="mb-1">{banner.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Hidden</Badge>}</div>
        <div className="text-slate-500">Opens: {banner.link ?? 'nothing'}</div>
        <label className="mt-1 inline-block cursor-pointer text-brand hover:underline">
          {uploading ? 'Uploading…' : banner.imageUrl ? 'Change image' : 'Add image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`Image for ${banner.title}`}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void upload(file)
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" aria-label="Move up" disabled={first || busy} onClick={() => onMove(-1)}>
          ↑
        </Button>
        <Button variant="ghost" aria-label="Move down" disabled={last || busy} onClick={() => onMove(1)}>
          ↓
        </Button>
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="secondary" busy={toggle.isPending} onClick={() => toggle.mutate()}>
          {banner.active ? 'Hide' : 'Show'}
        </Button>
        <Button
          variant="danger"
          busy={remove.isPending}
          onClick={() => confirmAction(`Delete the banner "${banner.title}"?`) && remove.mutate()}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

function BannerForm({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const [values, setValues] = useState<BannerInput>(banner ? toInput(banner) : emptyBanner)
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...values,
        title: values.title.trim(),
        subtitle: values.subtitle?.trim() || null,
        ctaText: values.ctaText?.trim() || null,
        link: values.link?.trim() || null,
      }
      return banner ? catalogApi.updateBanner(banner.id, body) : catalogApi.createBanner(body)
    },
    onSuccess: onDone,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  const set = (key: keyof BannerInput) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5">
      <h2 className="font-semibold">{banner ? 'Edit banner' : 'New banner'}</h2>
      <ErrorBanner message={save.error?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title *">
          <input className="input" required value={values.title} onChange={(e) => set('title')(e.target.value)} />
        </Field>
        <Field label="Subtitle">
          <input className="input" value={values.subtitle ?? ''} onChange={(e) => set('subtitle')(e.target.value)} />
        </Field>
        <Field label="Button text" hint="e.g. Shop now. Leave empty for no button.">
          <input className="input" value={values.ctaText ?? ''} onChange={(e) => set('ctaText')(e.target.value)} />
        </Field>
        <Field label="Opens in the app" hint="An app path: /shop, /shop?category=colas, /shop?deals=1">
          <input className="input" value={values.link ?? ''} onChange={(e) => set('link')(e.target.value)} placeholder="/shop" />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Add the image after saving, from the banner's card.</p>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending} disabled={!values.title.trim()}>
          {banner ? 'Save' : 'Create banner'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function toInput(banner: Banner): BannerInput {
  return {
    title: banner.title,
    subtitle: banner.subtitle,
    ctaText: banner.ctaText,
    link: banner.link,
    active: banner.active,
  }
}
