# Revogue

A thrift fashion marketplace mobile webapp. Browse, list, and shop pre-loved clothing.

## Run locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173) on your phone — both devices need to be on the same Wi-Fi.

## Deploy (5 minutes — pick one)

### Option A — Vercel (recommended, free)

1. Push this folder to a GitHub repo (`git init`, push to a new repo)
2. Go to https://vercel.com → New Project → Import the repo
3. Vercel auto-detects Vite. Click Deploy.
4. You get a `https://revogue-xxx.vercel.app` URL in ~30 seconds

### Option B — Netlify (free, drag-and-drop)

1. Run `npm install && npm run build` locally
2. Go to https://app.netlify.com/drop
3. Drag the `dist/` folder onto the page
4. You get a live URL instantly

### Option C — Cloudflare Pages

1. Push to GitHub
2. https://pages.cloudflare.com → Create project → Connect repo
3. Build command: `npm run build` · Output directory: `dist`

## Use it on your phone

Once deployed:

1. Open the URL in **Safari** (iOS) or **Chrome** (Android)
2. Tap the **Share** icon → **Add to Home Screen**
3. The Revogue icon now launches the app fullscreen, no browser chrome

## What's inside

- React 18 + Vite
- `lucide-react` for icons
- No backend — all state is in-memory (cart, wishlist, listings, orders, profile)
- Real Unsplash model photos as primary image source, with dummyjson product photos and SVG illustrations as fallbacks
- Light + dark mode, in-app toast notifications, photo upload (data-URL stored locally per session)

## Customize

- Product catalog: edit the `PRODUCTS` array near the top of `src/Revogue.jsx`
- Style posts (Lookbook): edit `STYLE_POSTS`
- Vibes / categories: edit `VIBES` and `CATEGORIES`
- Theme palette: search for `--cream`, `--terracotta`, `--sage` in the CSS template literal inside `Revogue.jsx`

## Notes

State doesn't persist across reloads (no backend, no localStorage by design — Claude artifact constraints carried over). To add persistence, wrap the relevant `useState` calls in a `useLocalStorage` hook or wire to Supabase / Firebase / your own API.
