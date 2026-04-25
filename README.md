# Japan 2026 · Holiday Companion App

A shared, URL-accessible holiday app for the May 2026 family trip (Japan + Seoul).
All 5 of you can read and edit from your phones; edits sync across devices via Supabase.

**Tech:** Vite + React + Tailwind + Supabase (Postgres + Storage). Deployed on Vercel.

---

## What's in the app

- **Home tab** — trip hero, today's plan, next booking deadlines, quick access
- **Days tab** — all 15 days with Aiden's status per day; tap into any day for full detail
- **Travel tab** — flights (Peach MM705, Virgin VS209) + accommodation (2 hotels booked, Seoul TBD)
- **Bookings tab** — checklist with deadlines, tap to mark done, sorted by urgency
- **Docs tab** — passports, insurance, IDP. Attach PDFs.
- **Contacts tab** — tappable phone numbers
- **Packing tab** — tickable list tailored for this trip
- **Notes tab** — etiquette tips, Japanese phrases, toddler-friendly food picks

All items (day activities, flights, hotels, docs) support **file attachments** — PDFs, ticket images, confirmations.

All edits save automatically to Supabase. Everyone sees changes on refresh.

---

## Setup (one-time, ~30-45 min)

### Part 1 — Supabase (database + file storage)

1. Go to **https://supabase.com** → sign up with GitHub
2. **New project**: name `japan-2026`, pick West EU (London) region, Free plan
3. Wait ~2 min for provisioning
4. **SQL Editor** → **New query** → paste the entire contents of `supabase-schema.sql` → **Run**
   - You should see "Success"
5. **Storage** → you should see a new `attachments` bucket (if not, create one: name = `attachments`, **Public: ON**)
6. **Project Settings (gear) → API** → copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (long string)

### Part 2 — Test locally (optional but recommended)

```bash
cd japan-app
npm install
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL + anon key
npm run dev
```

Open http://localhost:5173. You should see the full Japan 2026 itinerary. Edit anything, refresh — it persists.

### Part 3 — Push to GitHub

1. Create a new GitHub repo (private is fine)
2. From the project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/japan-2026.git
git push -u origin main
```

### Part 4 — Deploy on Vercel

1. Go to **https://vercel.com** → sign up with GitHub
2. **Add New → Project** → import your `japan-2026` repo
3. Vercel auto-detects Vite. Before deploying, add **Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. Takes ~1 minute.
5. You get a URL like `japan-2026.vercel.app`

### Part 5 — Share with the family

Send the Vercel URL to Michelle, Caroline, David.

**Add to home screen:**

- **iPhone (Safari):** Share icon → Add to Home Screen → Add
- **Android (Chrome):** Three-dot menu → Install app → Install

Opens full-screen, looks like a native app.

---

## Making changes

### Content changes (in-app)

Everyone can edit everything through the app on their phone. Add restaurants, attach PDFs, tick off packing items, etc. Just tap **Edit** on anything.

### Code changes (Tim, local)

```bash
# Make changes
git add .
git commit -m "what changed"
git push
# Vercel auto-redeploys
```

### If Claude is helping me with bigger changes

Easiest: share the Vercel URL with him and describe what to change. For bigger restructures, share the GitHub repo link.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Missing Supabase env vars" in browser console | Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Local: `.env.local`. Vercel: Settings → Environment Variables, then redeploy. |
| App loads but saves fail | Re-run `supabase-schema.sql` to create policies |
| File uploads fail | Check the `attachments` bucket exists and is Public in Supabase Storage |
| Someone's edits don't appear | This app has no live sync by design — hit refresh |
| First visitor wipes data? | No — app only seeds sample data when table is empty. Once there's a row, it loads what's there. |

---

## Cost

All services on free tier:
- Supabase: 500MB DB, 1GB storage, 5GB bandwidth. You'll use a few MB.
- Vercel: 100GB bandwidth/month. You'll use a few hundred KB.
- **Total: £0**

---

## Important: security model

- Anyone with the Vercel URL can read AND edit all data
- Don't share the URL publicly
- Don't put sensitive info (credit card numbers, SSN-equivalents)
- Passport *numbers* are debatable — lower risk since they're paired with names but no photo; still not ideal
- **Recommended: put passport number *references* only** (e.g., "expires Mar 2031"), store actual scans as file attachments which do at least require clicking a URL to view

If you want a shared password lock later, that's a code change — happy to add it.

---

## Structure

```
japan-app/
├─ src/
│  ├─ App.jsx           ← main app (all tabs + editors)
│  ├─ supabase.js       ← DB client + file upload helpers
│  ├─ tripData.js       ← all 15 days + bookings + docs etc.
│  ├─ main.jsx          ← React entry
│  └─ index.css         ← Japanese palette + styles
├─ public/
│  ├─ manifest.json     ← PWA config
│  ├─ icon-192.png / icon-512.png
│  └─ favicon.svg
├─ supabase-schema.sql  ← run once in Supabase
├─ .env.example         ← copy to .env.local
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
└─ postcss.config.js
```
