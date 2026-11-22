# Deploying TenderSaathi

```
frontend/  Next.js   -> Vercel
backend/   FastAPI   -> a host with a persistent disk or Postgres (not Vercel, see below)
```

## Frontend on Vercel

1. Import the GitHub repo in Vercel.
2. **Root Directory:** `frontend` (Project Settings -> General). Framework is auto-detected as Next.js; `frontend/vercel.json` sets region `bom1` (Mumbai), security headers and the install/build commands.
3. Environment variables (Production and Preview):

| Name | Value |
| --- | --- |
| `BACKEND_URL` | Public URL of the deployed FastAPI backend, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_...` key |

`/api/*` is proxied to `BACKEND_URL` by a rewrite in `next.config.mjs`, so the browser only talks to one origin (no CORS setup).

## Why the backend is not on Vercel

The backend stores data in SQLite on local disk. Vercel functions have an ephemeral, read-only filesystem, so users and tenders would vanish between requests. Host it on a service with a persistent disk (Render, Railway, Fly) or move the data to Postgres (e.g. Supabase) first. Backend env vars: `SERPAPI_KEY`, `SARVAM_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

## Supabase (Google sign-in)

After the first deploy, in Supabase -> Authentication -> URL Configuration:
- Site URL: `https://<your-domain>`
- Redirect URLs: add `https://<your-domain>/**` (keep `http://localhost:3000/**` for local dev)

## Fonts

Helvetica Neue files are licensed and gitignored (`frontend/public/fonts/`). A Git-based deploy will not contain them and falls back to Inter. Add them to the deploy yourself only if your licence covers web use.
