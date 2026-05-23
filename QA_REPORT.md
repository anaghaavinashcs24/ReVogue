# Revogue QA Report

## Backend — automated (63/63 passing)

I ran [backend/e2e-test.js](backend/e2e-test.js) end-to-end against a freshly-booted in-memory MongoDB, covering every endpoint:

```
=== HEALTH & META ===            2/2
=== PRODUCTS (anonymous) ===     9/9
=== AUTH ===                     8/8
=== USER PROFILE ===             3/3
=== WISHLIST ===                 4/4
=== CART ===                     5/5
=== ADDRESSES ===                4/4
=== PAYMENT METHODS ===          4/4
=== ORDERS ===                   7/7   (incl. cancel + restock)
=== STYLE POSTS ===              8/8
=== SELLER FLOW ===              5/5   (incl. ownership 403)
=== SUSTAINABILITY ===           1/1
=== RATE LIMITING ===            1/1
=== UPLOADS ===                  1/1   (positive multipart upload verified separately)
=== CLEANUP ===                  1/1

RESULT: 63 passed, 0 failed
```

You can re-run this anytime:
```powershell
cd backend
node e2e-test.js
```

## Bugs found and fixed during review

A code review surfaced 9 real bugs in the integration. All fixed:

| # | Bug | Impact | Fix |
|---|---|---|---|
| 1 | `normalizeProduct`/`normalizePost`/`normalizeOrder` would crash on `null` input | If a referenced product was deleted server-side, hydrating cart/orders would throw and the app would white-screen | Added null-guards; missing fields default safely |
| 2 | Hydration filtered nothing → cart items with `c.product === null` crashed `renderBag` | Same white-screen risk | `.filter(c => c && c.product)` before normalize |
| 3 | Sign-out left `postLikes`, `postSaves`, `postComments`, `sustainStats`, `userProfile` lingering | If User A signs out and User B signs in same browser, B sees A's liked posts | Sign-out now resets every per-user state slice + hydrated flag |
| 4 | Sell-flow `publish()` would send giant data URLs to MongoDB if user clicked before uploads finished | Document size error or extremely slow/broken listings | Refuses publish with a clear "Photos still uploading" message |
| 5 | Bottom-tab "Sell" used a dead ternary `userRole === 'seller' ? renderSell() : renderSell()` | No behavioral impact, just dead code | Simplified |
| 6 | Hydrate fetch could overwrite optimistic cart/wishlist mutations made within ~100ms of landing | Items briefly added would disappear | Added a one-shot `hydrated` guard |
| 7 | Detail page crashed if `p.seller` was empty string (`''[0].toUpperCase()`) | Edge case crash on degraded data | Defensive `(p.seller || 'S')[0]` |
| 8 | After ordering, `userListings` retained sold items | Seller could re-buy their own already-sold item | Refreshes `mine=true` after `createOrder` |
| 9 | Avatar uploaded as data URL only — never sent to backend, lost on reload | Avatar disappeared on logout/reload | Uploads to `/api/uploads` immediately, swaps in the URL |

## Frontend — manual UI checklist

What I **cannot** automate (no browser in this environment). You need to walk through these once. Open both servers (`npm run dev` from repo root) and `http://localhost:5173`.

### Auth (sign-up, sign-in, auto-login, sign-out)
- [ ] **Sign-up** as a brand new user (any email + 6-char password) — should land on home
- [ ] **Sign-out** from Profile → Sign out — should return to the sign-in screen
- [ ] **Sign-in** as `demo@revogue.io` / `password123` — home loads with seeded data
- [ ] **Wrong password** shows the inline error, doesn't crash
- [ ] **Refresh the page** while logged in — auto-login should skip the role screen and land on home
- [ ] **Phone-as-contact** (e.g. `9876543210` / `qatest123`) — sign-up + sign-in both work

### Catalog browsing
- [ ] Home shows 30 seeded products in a grid
- [ ] Tap a vibe chip (e.g. "Cottagecore") → grid filters
- [ ] Tap a category tile (e.g. "Tops") → grid filters
- [ ] Switch gender tabs (All / Women / Men / Unisex)
- [ ] Search "denim" — results appear
- [ ] **Clear filters** button appears when filters active and resets them
- [ ] Search tab loads "Trending searches" suggestions on empty query
- [ ] Tap any product card → detail page opens with full info

### Wishlist
- [ ] Tap the heart on a card → toast "Saved to wishlist"
- [ ] Wishlist tab icon shows the count badge
- [ ] Open Wishlist tab → item is there
- [ ] Tap heart again → removed; toast "Removed"
- [ ] **Refresh the page** → wishlist still persists (backend state)
- [ ] Sign out, sign back in → wishlist still there

### Cart + Checkout
- [ ] On a product detail, tap "Add to bag" → toast + navigates to Bag tab
- [ ] Bag shows the item with price, size, condition
- [ ] Trash icon removes it
- [ ] Add 2+ items → subtotal, shipping (free if ≥ ₹999), 2% platform fee, total all match
- [ ] **Proceed to Payment**
- [ ] Pick UPI; tap "Pay" → order placed, confirmation screen
- [ ] Open Profile → My Orders → order is listed with status "Placed"
- [ ] Try buying the same product again → should be 404 (now sold) — graceful toast
- [ ] **Refresh** — order persists in My Orders

### Addresses
- [ ] Profile → Shipping Addresses → seeded "Home" address shows up
- [ ] Tap +, add a new address ("Office"...) → appears in list
- [ ] Set the new one as default → old default unmarked
- [ ] Edit the new address → changes persist
- [ ] Delete an address → removed
- [ ] Refresh — all changes persisted

### Payment methods
- [ ] Profile → Payment Methods → seeded UPI present
- [ ] Add a card with last 4 digits → appears with the 💳 icon
- [ ] Make it default → switches
- [ ] Remove → removed
- [ ] Refresh — persists

### Selling (list an item)
- [ ] Tap the center + tab → Sell screen
- [ ] Tap "Add photos" — upload 1-2 from your phone/disk
- [ ] **Photos show immediately as preview** (data URL) then swap to remote URLs after upload (look at Network tab — `/api/uploads/multiple`)
- [ ] Click Publish too fast (before upload completes) → shows "Photos still uploading" error
- [ ] Wait for upload, fill in title/brand/price/MRP/size/category/condition/vibe tags/description → Publish
- [ ] Toast confirms; lands on Home; new listing visible in "Listed by you" carousel + main feed
- [ ] Profile → My Listings → it's there
- [ ] Tap your own listing → detail page renders correctly

### Style feed (Lookbook)
- [ ] Lookbook tab shows the 6 seeded posts
- [ ] Tap a heart on a post → count increments; persists on refresh
- [ ] Tap bookmark → saves; persists
- [ ] Tap comment icon → bottom sheet opens; existing comments visible
- [ ] Type a comment + Post → appears in the list
- [ ] **Refresh** → your comment is still there (proves it persists server-side)
- [ ] Tap a tagged product in the post footer → opens its detail page

### Post a fit
- [ ] Lookbook → + button → upload a photo, write a caption, pick vibes
- [ ] Post → new post appears at top of feed
- [ ] **Refresh** → still there
- [ ] You can delete your own posts (no UI exposed for this yet, but `DELETE /api/posts/:id` works)

### Profile
- [ ] Edit profile: change name, bio, location, email/phone, avatar color → Save
- [ ] Refresh — changes persist
- [ ] Avatar photo upload — pick an image → uploads immediately (network tab) → save → refresh → still there
- [ ] Switch buyer ↔ seller in Settings — persists on refresh

### Settings
- [ ] Toggle Dark Mode — UI switches; refresh — still dark
- [ ] Toggle other switches — each persists

### Sustainability score
- [ ] Profile → Sustainability — shows your tier, score, items rescued, CO₂ kg, water L
- [ ] After placing one order, numbers update (12 points per item, 5.4 kg CO₂, 2700 L per item)

### Mobile-specific (open on your phone)
Find your computer's LAN IP (`ipconfig` → IPv4 Address, e.g. `192.168.1.42`):
```powershell
$env:CLIENT_ORIGIN="http://localhost:5173,http://192.168.1.42:5173"
npm run dev
```
Then on your phone (same Wi-Fi), open `http://192.168.1.42:5173` and check:
- [ ] App fills the screen, no horizontal scroll
- [ ] Bottom tab bar sits above the iOS home indicator
- [ ] Inputs don't trigger iOS auto-zoom on focus (16px font is set)
- [ ] Tap targets feel right (cards, hearts, buttons)
- [ ] Add to Home Screen (Safari: Share → Add to Home Screen) → opens fullscreen with Revogue branding

## Known limitations (not bugs, just things to be aware of)

1. **No password reset flow** — only change-password while logged in. Add forgot-password before public launch.
2. **No order tracking detail** — orders have a `trackingNumber` but the UI just shows status. Fine for a thrift marketplace where logistics are usually manual.
3. **No real payment integration** — UPI/card/COD are mock. Wire up Razorpay or Stripe before taking real money.
4. **Image uploads are local** — `backend/uploads/` folder. On Render's free tier this is wiped on deploy. Switch to Cloudinary for production (see [DEPLOYMENT.md](DEPLOYMENT.md) section "Image uploads").
5. **No admin/moderation tooling** — anyone can post anything to the Lookbook. Add reporting + a small admin panel before public launch.
6. **Search is regex-LIKE** — fast enough for ~thousands of products. For 100k+ switch to a text index (already created) and use `$text` queries.
7. **No analytics** — wire up Plausible or PostHog (both have free tiers) to know what users do.

## App-store-ready? My honest take

For the **web app** ("install via Add to Home Screen"): **yes, after you tick the manual checklist above**. The backend is solid, the integration is solid, all the per-user flows persist and recover correctly.

For an **actual native app on the App Store / Play Store**: this is a React web app, not a native app. To put it on either store you'd:

1. Wrap it with [Capacitor](https://capacitorjs.com/) (3-day job for someone familiar with it)
2. Replace `multer` disk storage with Cloudinary/S3 (1 hour)
3. Wire up a real payment SDK (Razorpay India for ₹) — for the App Store you cannot collect physical-goods payments via in-app purchase, so Razorpay/Stripe checkout flows are fine
4. Build assets — app icon, splash screen, screenshots, description (a few hours)
5. Apple Developer Program ($99/yr) + Play Console ($25 one-time) accounts
6. Submit + iterate on reviewer feedback (Apple is picky about: privacy policy, terms of use, account-deletion flow, copy that mentions "free trial" but doesn't have one, etc.)

Realistic timeline if it's your first time: ~2 weeks to first submission, +1-2 weeks for review.

If you want, I can do step 1 (Capacitor wrap) and step 2 (Cloudinary) now — both are straightforward. Steps 3-6 are operational, not code, and you have to drive those.
