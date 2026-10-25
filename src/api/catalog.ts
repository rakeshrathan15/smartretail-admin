import { api } from './client'
import type {
  AdminProduct,
  Banner,
  BannerInput,
  Category,
  Page,
  ProductInput,
  ProductRow,
  Slab,
} from './types'

export interface ProductFilters {
  q?: string
  category?: string
  active?: boolean
  page?: number
  size?: number
}

export const catalogApi = {
  categories: () => api<Category[]>('/api/admin/categories'),
  createCategory: (body: { name: string; sortOrder?: number; active?: boolean }) =>
    api<Category>('/api/admin/categories', { method: 'POST', json: body }),
  updateCategory: (id: string, body: { name: string; sortOrder?: number; active?: boolean }) =>
    api<Category>(`/api/admin/categories/${id}`, { method: 'PUT', json: body }),
  deleteCategory: (id: string) => api<void>(`/api/admin/categories/${id}`, { method: 'DELETE' }),

  products: (filters: ProductFilters) =>
    api<Page<ProductRow>>('/api/admin/products', { query: { ...filters, sort: 'NAME' } }),
  product: (id: string) => api<AdminProduct>(`/api/admin/products/${id}`),
  createProduct: (body: ProductInput) => api<AdminProduct>('/api/admin/products', { method: 'POST', json: body }),
  updateProduct: (id: string, body: ProductInput) =>
    api<AdminProduct>(`/api/admin/products/${id}`, { method: 'PUT', json: body }),
  deleteProduct: (id: string) => api<void>(`/api/admin/products/${id}`, { method: 'DELETE' }),
  replaceSlabs: (id: string, slabs: Slab[]) =>
    api<AdminProduct>(`/api/admin/products/${id}/slabs`, { method: 'PUT', json: { slabs } }),
  uploadImage: (id: string, file: File) =>
    api<AdminProduct>(`/api/admin/products/${id}/images`, { method: 'POST', form: fileForm(file) }),
  makePrimaryImage: (id: string, imageId: string) =>
    api<AdminProduct>(`/api/admin/products/${id}/images/${imageId}/primary`, { method: 'PUT' }),
  deleteImage: (id: string, imageId: string) =>
    api<AdminProduct>(`/api/admin/products/${id}/images/${imageId}`, { method: 'DELETE' }),

  banners: () => api<Banner[]>('/api/admin/banners'),
  createBanner: (body: BannerInput) => api<Banner>('/api/admin/banners', { method: 'POST', json: body }),
  updateBanner: (id: string, body: BannerInput) =>
    api<Banner>(`/api/admin/banners/${id}`, { method: 'PUT', json: body }),
  uploadBannerImage: (id: string, file: File) =>
    api<Banner>(`/api/admin/banners/${id}/image`, { method: 'POST', form: fileForm(file) }),
  reorderBanners: (ids: string[]) => api<Banner[]>('/api/admin/banners/order', { method: 'PUT', json: { ids } }),
  deleteBanner: (id: string) => api<void>(`/api/admin/banners/${id}`, { method: 'DELETE' }),
}

function fileForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Same limits as the backend, checked before uploading so the admin gets a quick answer. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WebP images are allowed`
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: image must be 5 MB or smaller`
  return null
}
