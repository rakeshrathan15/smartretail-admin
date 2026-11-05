import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ClipboardCheck,
  Image,
  IndianRupee,
  LayoutGrid,
  type LucideIcon,
  Package,
  ReceiptText,
  Route,
  Settings,
  ShoppingBag,
  Store,
  TicketPercent,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { orderStatsQuery } from '../api/orders'
import { useAuth } from '../auth/useAuth'

const groups: { title: string; links: { to: string; label: string; icon: LucideIcon }[] }[] = [
  {
    title: 'Sales',
    links: [
      { to: '/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/shops', label: 'Shops', icon: Store },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Catalog',
    links: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/categories', label: 'Categories', icon: LayoutGrid },
      { to: '/banners', label: 'Banners', icon: Image },
      { to: '/coupons', label: 'Coupons', icon: TicketPercent },
    ],
  },
  {
    title: 'Stock',
    links: [
      { to: '/inventory', label: 'Inventory', icon: Warehouse },
      { to: '/stock-receipts', label: 'Stock receipts', icon: ReceiptText },
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/expenses', label: 'Expenses', icon: IndianRupee },
    ],
  },
  {
    title: 'Delivery',
    links: [
      { to: '/pick-list', label: 'Pick-list', icon: ClipboardCheck },
      { to: '/routes', label: 'Delivery routes', icon: Route },
      { to: '/stores', label: 'Stores', icon: Building2 },
    ],
  },
  { title: 'System', links: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]

export function Layout() {
  const { state, logout } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  const stats = useQuery(orderStatsQuery)
  const newOrders = stats.data?.awaitingConfirmation ?? 0

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-line bg-white md:sticky md:top-0 md:h-screen md:w-62 md:border-r md:border-b-0 print:hidden">
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <img src="/favicon.png" alt="" className="h-9 w-9" />
          <div>
            <div className="leading-tight font-bold">S'Mart Retail</div>
            <div className="text-xs text-slate-500">Admin</div>
          </div>
          <button type="button" onClick={logout} className="ml-auto text-sm text-slate-500 underline hover:text-slate-900 md:hidden">
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-0 md:overflow-y-auto">
          {groups.map((group) => (
            <div key={group.title} className="contents md:block">
              <div className="mt-3 mb-1 hidden px-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase md:block">
                {group.title}
              </div>
              {group.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.75 text-[13px] whitespace-nowrap ${
                      isActive ? 'bg-brand-light font-semibold text-brand' : 'font-medium text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon size={18} strokeWidth={1.9} />
                  {label}
                  {to === '/orders' && newOrders > 0 && (
                    <span aria-label={`${newOrders} new`} className="ml-auto rounded-full bg-amber-500 px-1.75 text-[11px] leading-4.5 font-bold text-white">
                      {newOrders}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mx-3 hidden border-t border-line px-2.5 py-3 text-[13px] text-slate-500 md:block">
          <div className="truncate">{user?.email ?? user?.phone}</div>
          <button type="button" onClick={logout} className="mt-0.5 underline hover:text-slate-900">
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:px-8 md:py-7 print:p-0">
        <Outlet />
      </main>
    </div>
  )
}
