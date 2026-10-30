import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { BannersPage } from './pages/BannersPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CouponsPage } from './pages/CouponsPage'
import { CustomersPage } from './pages/CustomersPage'
import { LoginPage } from './pages/LoginPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { PickListPage } from './pages/PickListPage'
import { ProductEditPage } from './pages/ProductEditPage'
import { ProductsPage } from './pages/ProductsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShopsPage } from './pages/ShopsPage'
import { StoresPage } from './pages/StoresPage'

// Loaded on demand: the map library is large and only this screen uses it.
const RoutesPage = lazy(() => import('./pages/RoutesPage').then((m) => ({ default: m.RoutesPage })))

export function App() {
  const { state } = useAuth()

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (state.status === 'signed-out') return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductEditPage />} />
        <Route path="products/:id" element={<ProductEditPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="banners" element={<BannersPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="pick-list" element={<PickListPage />} />
        <Route
          path="routes"
          element={
            <Suspense fallback={<Spinner />}>
              <RoutesPage />
            </Suspense>
          }
        />
        <Route path="stores" element={<StoresPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Route>
    </Routes>
  )
}
