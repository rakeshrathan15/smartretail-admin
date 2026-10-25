import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'

const links = [
  { to: '/orders', label: 'Orders' },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/banners', label: 'Banners' },
  { to: '/coupons', label: 'Coupons' },
  { to: '/shops', label: 'Shop credit' },
]

export function Layout() {
  const { state, logout } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-brand text-white md:w-56">
        <div className="flex items-center gap-2 px-5 py-4">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <div className="font-semibold leading-tight">S'Mart Retail</div>
            <div className="text-xs text-white/70">Admin</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/15 px-5 py-4 text-sm md:block">
          <div className="truncate text-white/80">{user?.email ?? user?.phone}</div>
          <button type="button" onClick={logout} className="mt-1 text-white/70 underline hover:text-white">
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
