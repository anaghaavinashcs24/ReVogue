# Deploying Revogue

Three pieces: database (Atlas), backend (Render), frontend (Vercel). Total cost: ₹0.

## 0. Prerequisites

- Push this repo to GitHub (Render & Vercel both deploy from a Git remote)
- A GitHub account
- Free accounts on:
  - [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
  - [render.com](https://render.com)
  - [vercel.com](https://vercel.com)

```powershell
cd c:\Users\Anagha\Downloads\ReVogue-main\ReVogue-main
git init
git add .
git commit -m "Initial commit"
# create a new GitHub repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/revogue.git
git branch -M main
git push -u origin main
```

## 1. Database — MongoDB Atlas

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free **M0 cluster** (any region close to your users)
3. **Database Access** → "Add new user" → name `revogue`, generate a strong password (save it)
4. **Network Access** → "Add IP" → choose "Allow access from anywhere" (`0.0.0.0/0`). This is fine for Atlas because every request still requires the user+password.
5. **Database** → "Connect" → "Drivers" → copy the connection string. Looks like:
   ```
   mongodb+srv://revogue:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with the real password and add `/revogue` before the `?`:
   ```
   mongodb+srv://revogue:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/revogue?retryWrites=true&w=majority
   ```
   **Keep this string handy — you'll paste it into Render in the next step.**

## 2. Backend — Render

1. Sign up at [render.com](https://render.com), connect your GitHub account
2. **New +** → **Web Service** → pick your GitHub repo
3. Settings:
   | Field | Value |
   |---|---|
   | Name | `revogue-api` (URL becomes `https://revogue-api.onrender.com`) |
   | Region | nearest to you |
   | Branch | `main` |
   | **Root Directory** | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | Free |

4. **Environment Variables** — click "Advanced", add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | the Atlas string from step 1.6 |
   | `JWT_SECRET` | any long random string — e.g. paste output of `openssl rand -hex 32` |
   | `JWT_EXPIRES_IN` | `30d` |
   | `CLIENT_ORIGIN` | leave blank for now, you'll set it after deploying the frontend |
   | `MAX_UPLOAD_MB` | `8` |

5. Click **Create Web Service**. First deploy takes ~3 minutes.

6. Once it says "Live", visit `https://revogue-api.onrender.com/api/health` — should return JSON.

7. **Seed the database** — in Render's "Shell" tab (paid plans) or locally:
   ```powershell
   # Locally — temporarily point at the production Atlas DB to seed it
   cd backend
   $env:MONGO_URI="mongodb+srv://revogue:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/revogue?retryWrites=true&w=majority"
   npm run seed
   ```
   This is a one-time operation. Now the production DB has the demo data.

## 3. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com), connect GitHub
2. **Add New** → **Project** → pick your repo
3. Settings:
   | Field | Value |
   |---|---|
   | Framework Preset | Vite |
   | **Root Directory** | `revogue-app` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

4. **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://revogue-api.onrender.com` (your Render URL) |

5. Click **Deploy**. Takes ~2 minutes.

6. Vercel gives you a URL like `https://revogue-XXX.vercel.app`. Copy it.

## 4. Wire CORS

Back in Render → your service → **Environment** → edit `CLIENT_ORIGIN`:
```
https://revogue-XXX.vercel.app
```
(or comma-separated if you want multiple frontends: `https://revogue-XXX.vercel.app,https://revogue.yourdomain.com`)

Save → Render auto-redeploys → done.

## 5. Test

Open `https://revogue-XXX.vercel.app`, sign in with `demo@revogue.io` / `password123`. Everything works against the real Atlas database.

---

## Important caveats

### Render free tier sleeps
After 15 minutes of inactivity the backend hibernates. First request after that takes ~30 seconds to wake up — your users will see a spinner. Workarounds:
- Upgrade to Render's **Starter** plan ($7/mo) — no sleep, persistent disk for uploads
- Or use a free uptime monitor like [cron-job.org](https://cron-job.org) to hit `/api/health` every 10 minutes (keeps it warm)

### Image uploads are ephemeral on Render free tier
The `uploads/` folder gets wiped on every deploy and after sleep. Your seeded products use external image URLs so they survive — but listings created by users will lose their photos. Fixes:

**Option A — Cloudinary (free tier, recommended):**
1. Sign up at [cloudinary.com](https://cloudinary.com) (free 25GB)
2. Install: `cd backend; npm install multer-storage-cloudinary cloudinary`
3. Swap [backend/middleware/upload.js](ReVogue-main/backend/middleware/upload.js) to use Cloudinary storage:
   ```js
   const cloudinary = require('cloudinary').v2;
   const { CloudinaryStorage } = require('multer-storage-cloudinary');
   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET,
   });
   const storage = new CloudinaryStorage({
     cloudinary,
     params: { folder: 'revogue', allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
   });
   const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });
   module.exports = upload;
   ```
4. Adjust [backend/routes/uploads.js](ReVogue-main/backend/routes/uploads.js) to use `req.file.path` (which is now the Cloudinary URL) instead of building one from `req.file.filename`
5. Add Cloudinary env vars to Render

**Option B — pay for Render's persistent disk** ($1/mo, mount at `/var/data/uploads`)

### Atlas free tier limits
- 512 MB total storage
- Shared CPU/RAM
- Auto-paused after 60 days of zero connections (a single request unpauses it)

Plenty for demos and small production traffic.

### Domain
Vercel and Render both let you add a custom domain for free. In each dashboard: Settings → Domains → add yours, follow the DNS instructions.

---

## Alternative hosts (one-line per option)

- **Railway** ($5/mo trial credit, no sleep) — deploys both backend + frontend from one repo with great DX
- **Fly.io** — more setup, but globally distributed, generous free tier
- **Heroku** — works fine, free tier discontinued so you'll pay ~$5/mo for the backend dyno
- **Netlify** — alternative to Vercel for the frontend, identical setup
- **Self-host on a VPS** ($5/mo Hetzner, DigitalOcean) — full control, install MongoDB locally, run with PM2 + Nginx + Caddy for TLS

---

## Production checklist

Before going live for real users:

- [ ] Change `JWT_SECRET` to a fresh random value (not what's in `.env.example`)
- [ ] Lock Atlas Network Access to specific IPs instead of `0.0.0.0/0` (use Render's static IPs on paid plans)
- [ ] Move image uploads to Cloudinary or S3
- [ ] Add a real password reset flow (current API only does change-password while logged in)
- [ ] Add HTTPS-only cookies if you switch from `localStorage` JWT to cookie-based auth
- [ ] Add input validation for free-text fields beyond the basics
- [ ] Hook up an error tracker (Sentry has a generous free tier)
- [ ] Configure CORS to a specific origin (not `*`)
- [ ] Add rate limiting beyond just `/api/auth/*` — at minimum, on `/api/uploads`
- [ ] Set up the Render uptime ping or upgrade off the free tier
- [ ] Back up the Atlas database periodically (Atlas does this automatically on paid plans)
