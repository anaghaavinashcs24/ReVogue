# Revogue Backend

REST API for the Revogue thrift-fashion app — Node.js + Express + MongoDB.

## Quick start

```bash
cd backend
cp .env.example .env        # then edit MONGO_URI + JWT_SECRET
npm install
npm run seed                 # seeds 24 sellers + demo buyer + 30 products + 6 posts
npm run dev                  # starts the API on http://localhost:5000
```

**Demo login**: `demo@revogue.io` / `password123` (also works for any seeded seller, e.g. `anaya_thrifts@revogue.demo`).

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `MONGO_URI` | — | MongoDB connection string |
| `JWT_SECRET` | — | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | `30d` | Token expiry |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `UPLOAD_DIR` | `uploads` | Local dir for image uploads (served at `/uploads`) |
| `MAX_UPLOAD_MB` | `8` | Max image upload size in MB |

## API surface

All endpoints are JSON unless noted. Protected endpoints expect `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/signup` | – | `{ name, contact, password, role? }` |
| POST | `/signin` | – | `{ contact, password }` |
| GET  | `/me` | yes | – |
| POST | `/change-password` | yes | `{ currentPassword, newPassword }` |

`contact` may be an email or a phone number — the API auto-detects.

### Users — `/api/users`
- `GET  /me` — current user
- `PATCH /me` — update name, username, role, profile, email, phone
- `PATCH /me/settings` — partial-merge settings (`notifications`, `darkMode`, …)
- `PATCH /me/avatar` — `{ avatarUrl?, avatarColor? }`
- `GET  /:idOrUsername` — public profile (respects `privateProfile`)
- `DELETE /me` — delete account

### Products — `/api/products`
- `GET  /` — supports `?category=&gender=&vibe=&q=&minPrice=&maxPrice=&sort=newest|price-low|price-high|popular&page=&limit=&seller=&mine=true`
- `GET  /meta` — categories, conditions, genders, vibes
- `GET  /:id`
- `POST /` *(auth)* — create listing
- `PATCH /:id` *(auth, owner)*
- `DELETE /:id` *(auth, owner)*
- `POST /:id/like` — increment likes

### Wishlist — `/api/wishlist` *(auth)*
- `GET /` · `POST /:productId` · `DELETE /:productId` · `DELETE /`

### Cart — `/api/cart` *(auth)*
- `GET /` — returns `{ items, subtotal, count }`
- `POST /` — `{ productId, qty?, size? }`
- `PATCH /:productId` — `{ qty }`
- `DELETE /:productId` · `DELETE /`

### Orders — `/api/orders` *(auth)*
- `GET /` — list user's orders
- `GET /:id`
- `POST /` — `{ addressId | shippingAddress, paymentMethodId | paymentMethod, items? }`
  - if `items` is omitted, the user's full cart is checked out
- `POST /:id/cancel`

Order creation marks the products as `sold`, removes them from the cart and updates the buyer's sustainability score.

### Style posts — `/api/posts`
- `GET /` — `?page=&limit=&tag=&user=&q=`
- `GET /:id`
- `POST /` *(auth)* — `{ image, caption?, fallbackImage?, tags?, products? }`
- `POST /:id/like` *(auth)* — toggle like
- `POST /:id/save` *(auth)* — toggle save
- `POST /:id/comments` *(auth)* — `{ text }`
- `DELETE /:id/comments/:commentId` *(auth, author or post owner)*
- `DELETE /:id` *(auth, owner)*

### Addresses — `/api/addresses` *(auth)*
- `GET /` · `POST /` · `PATCH /:id` · `DELETE /:id`

### Payment methods — `/api/payment-methods` *(auth)*
- `GET /` · `POST /` · `PATCH /:id` · `DELETE /:id`

### Uploads — `/api/uploads` *(auth, multipart/form-data)*
- `POST /` — single image, field name `image`
- `POST /multiple` — up to 6 images, field name `images`

Returns absolute URLs pointing at `/uploads/...`.

### Sustainability — `/api/sustainability` *(auth)*
- `GET /me` — `{ itemsRescued, co2SavedKg, waterSavedLiters, score, ordersCount, tier }`

### Health
- `GET /api/health`

## Wiring it into the React app

Add a `.env.local` to `revogue-app/`:

```
VITE_API_URL=http://localhost:5000
```

Then in code, fetch with the saved token:

```js
const API = import.meta.env.VITE_API_URL;
const token = localStorage.getItem('rv_token');
fetch(`${API}/api/products?category=Tops`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

For sign-in:

```js
const res = await fetch(`${API}/api/auth/signin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contact: email, password }),
});
const { token, user } = await res.json();
localStorage.setItem('rv_token', token);
```

## Project layout

```
backend/
├── server.js
├── seed.js
├── config/db.js
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── error.js
├── models/
│   ├── User.js          User + cart + wishlist + settings + profile + sustainability
│   ├── Product.js       Listings (catalog + user-created)
│   ├── Order.js         Orders with line items + snapshot address/payment
│   ├── Post.js          Style posts + embedded comments
│   ├── Address.js
│   └── PaymentMethod.js
└── routes/
    ├── auth.js
    ├── users.js
    ├── products.js
    ├── wishlist.js
    ├── cart.js
    ├── orders.js
    ├── posts.js
    ├── addresses.js
    ├── paymentMethods.js
    ├── uploads.js
    └── sustainability.js
```

## Notes & assumptions

- Passwords are hashed with bcrypt; JWTs are signed HS256 with `JWT_SECRET`.
- Uploads are saved to disk under `uploads/` and served as static files. Swap in S3/Cloudinary for production.
- `Product.status` is `active | sold | archived` — sold items are excluded from search but still appear in past orders.
- Sustainability impact per item: 5.4 kg CO₂ saved, 2700 L water saved (rough industry estimates).
- Free shipping kicks in at ₹999; otherwise ₹49 flat.
- Rate-limiting is applied to `/api/auth/*` (50 requests / 15 min / IP).
