# S'Mart Retail Admin (React)

Admin panel: orders, catalog (products, prices, bulk slabs, photos, categories, banners), coupons and shop credit.
Talks to `../smart-retail-backend`.

React 19 · TypeScript · Vite 8 · React Router 8 · TanStack Query 5 · Tailwind CSS 4 · Vitest

## Run

Start the backend first (`cd ../smart-retail-backend && ./gradlew bootRun`), then:

```bash
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server forwards `/api` and `/uploads` to `http://localhost:8080`
(change with `BACKEND_URL=...`), so the browser never makes cross-origin calls.
Sign in with an account that has the ADMIN role; in dev that is the admin from
`../smart-retail-backend/src/main/resources/application-dev.yml`.

```bash
npm test           # unit and component tests (no backend needed)
npm run lint
npm run build      # production build in dist/
```

If `node` is not found in a new terminal, load nvm first: `source ~/.nvm/nvm.sh`.

## Screens

| Screen | What it does |
|---|---|
| Orders | Today's numbers (orders, revenue, new to confirm, UPI to check, COD to collect); filters by status, payment, date and search; refreshes every 30 s |
| Order detail | Items, totals, shop with tap-to-call, delivery address; buttons for the allowed next status (from the server); UPI screenshot with Payment received / Reject |
| Coupons | Create and edit percentage or fixed coupons with minimum order, cap, usage limit and dates; turn on/off |
| Shop credit | Find a shop owner and set a credit limit; see what each shop owes and has available |
| Products | Table with search, category and status filters, paging; low/out-of-stock badges; bulk starting price |
| Product editor | Details form with margin hint, bulk-price slab editor (checked like the backend before saving), photo upload / main photo / delete, hide or delete |
| Categories | Add, rename, reorder, hide/show, delete (refused while products use it) |
| Settings | Store open/closed, delivery charge, free delivery above, minimum order, UPI ID, store contact, GSTIN, FSSAI and whether to show them; checked like the backend before saving |
| Banners | Add/edit, image upload, move up/down, hide/show, delete, with a preview of the slide |

## Layout

```
src/
├── api/        client.ts (fetch + token refresh), catalog.ts (endpoints), types.ts
├── auth/       AuthProvider and useAuth (admin-only sign-in, session restore)
├── components/ Layout (sidebar) and shared UI pieces
├── lib/        formatting and confirm helpers
├── pages/      one file per screen; productForm.ts holds form and slab logic
└── test/       test setup and a fake backend for fetch
```

Order rules live on the server (`OrderWorkflow`): New → Confirmed → (Processing) → Packed → Out for delivery /
Shipped → Delivered, with Cancel until dispatch and Returned after. A UPI order can only be confirmed after its
payment is approved. Cancelling or returning puts the cases back in stock; cancelling also gives back the coupon
use. Delivering a cash-on-delivery order marks it paid. UPI screenshots are private files, loaded with the
admin's token (`GET /api/admin/orders/{id}/payment-screenshot`).

The access token is kept in memory and the refresh token in localStorage, so a reload keeps
the admin signed in. For production, consider moving the refresh token to an httpOnly cookie.
