# Running the full Revogue app (frontend + backend)

## One-time setup

### 1. MongoDB
Either install MongoDB Community locally, or create a free Atlas cluster:
- **Local**: download from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) (tick "Run as a service" during install) — URI is `mongodb://127.0.0.1:27017/revogue`
- **Atlas**: free M0 cluster, copy the SRV connection string

### 2. Backend env

```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main\backend
Copy-Item .env.example .env
notepad .env
```

Set:
```
MONGO_URI=mongodb://127.0.0.1:27017/revogue
JWT_SECRET=some-long-random-string
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Install + seed

```powershell
npm install
npm run seed
```

That seeds 24 sellers, a demo buyer, 30 products and 6 style posts.
Demo login: **demo@revogue.io** / **password123**

### 4. Frontend env

Already created at `revogue-app/.env.local`:
```
VITE_API_URL=http://localhost:5000
```

```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main\revogue-app
npm install
```

## Daily startup

**Window 1 — backend:**
```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main\backend
npm run dev
```

**Window 2 — frontend:**
```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main\revogue-app
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with `demo@revogue.io` / `password123`.

## What's wired end-to-end

| Feature | Endpoint |
|---|---|
| Sign in / sign up / auto-login | `POST /api/auth/signin\|signup`, `GET /api/auth/me` |
| Product catalog + filters | `GET /api/products` |
| Wishlist | `POST/DELETE /api/wishlist/:id` |
| Cart | `GET/POST/DELETE /api/cart` |
| Checkout | `POST /api/orders` (also clears cart, marks items sold, updates sustainability) |
| My orders | `GET /api/orders` |
| Style feed + likes/saves/comments | `GET/POST /api/posts/:id/...` |
| Post a fit | `POST /api/uploads` → `POST /api/posts` |
| List an item | `POST /api/uploads/multiple` → `POST /api/products` |
| Addresses CRUD | `/api/addresses` |
| Payment methods CRUD | `/api/payment-methods` |
| Profile + avatar | `PATCH /api/users/me` |
| Settings toggles | `PATCH /api/users/me/settings` |
| Sustainability stats | `GET /api/sustainability/me` |
| Sign out | clears JWT from localStorage |

## Offline-friendly

If the backend isn't running, the frontend still loads with the bundled fallback products & posts. Auth-gated actions (cart/wishlist/orders) degrade gracefully to local state, so the demo never breaks.

## Resetting the database

```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main\backend
npm run seed
```

Re-seeds from scratch (wipes existing users/products/posts/orders).

## Troubleshooting

- **CORS error in the browser console** → check `CLIENT_ORIGIN=http://localhost:5173` in `backend/.env`, then restart the backend.
- **`Failed to fetch`** → backend isn't running, or `VITE_API_URL` is wrong. Hit [http://localhost:5000/api/health](http://localhost:5000/api/health) directly.
- **401 after refresh** → the auto-login effect calls `GET /api/auth/me` on mount; if your token expired (default 30d), you'll be sent back to the sign-in screen.
- **Vite changes ignored** → Vite reads `.env.local` once at startup; restart `npm run dev` after editing it.
- **Image upload 413** → bump `MAX_UPLOAD_MB` in `backend/.env`.
