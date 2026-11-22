# TenderSaathi

Tender discovery, eligibility checking and bid preparation for Indian manufacturers and service providers.

Register your business once. TenderSaathi places you in tender categories, finds matching government and private tenders across India, reads tender PDFs to check whether you actually qualify, flags risky buyers, and scores how ready your bid is.

**Live site:** https://tendersaathi-cyan.vercel.app

---

## Features

| | |
| --- | --- |
| **Onboarding** | After sign-in, a two-step form collects company name, GSTIN (format-checked), state, size, goods and services. The dashboard stays locked until it is complete. |
| **Auto-categorisation** | Products and services are mapped to up to 3 of 14 tender categories (electrical, civil, IT, textiles, medical, machinery and more). |
| **Tender discovery** | One click searches government portals (GeM, eProcure, eTenders, state portals) and private or aggregator sites via SerpAPI. Results are tagged government or private. |
| **PDF eligibility check** | Upload a tender PDF. EMD, turnover, experience, certifications, MSE/startup relaxations and OEM clauses are extracted and compared with your profile, giving red / amber / green flags and a verdict. |
| **Buyer risk and competitors** | Public search signals about the issuing organisation (disputes, delays, blacklisting), likely competitors and past offer values. |
| **Bid readiness score** | 0 to 100 from a 15-item document checklist, profile completeness, PDF alignment and time left, with the gaps listed. |
| **Schemes and benefits** | 13 central MSME, startup and procurement schemes matched to your profile (EMD exemption, purchase preference, CGTMSE, PMEGP and others). |
| **Multilingual assistant** | RAG chatbot over your profile, tenders, PDFs and schemes, answering in 11 languages through Sarvam. Every reply has a WhatsApp-style voice note (play/pause, progress, optional auto-play). |
| **Assisted form filling** | A ready data pack and step list for portal forms. See [what it does not do](#what-it-does-not-do). |
| **Sign-in** | Google (via Supabase) or email and password. |

## What it does not do

- **It does not submit bids.** SerpAPI is a search API; it cannot solve captchas or submit forms, and automating portal submissions would also break most portals' terms. The fill pack prepares your data; you log in, sign with your DSC and submit yourself.
- **Competitor, risk and offer data is best-effort.** It is built from public search snippets. Verify award and L1 data on the official portal.
- **Scanned PDFs are not read.** PDFs need selectable text; there is no OCR.
- **Scheme details are general summaries.** Limits and eligibility change; each scheme links to its official site.

## Architecture

```
frontend/  Next.js 16 (App Router, TypeScript)  ->  Vercel
backend/   FastAPI + SQLite                      ->  any host with a persistent disk
Supabase   Google sign-in (OAuth, PKCE)
```

The browser only talks to the frontend. `/api/*` is proxied to the backend by a rewrite in `frontend/next.config.mjs`, so there is no CORS setup.

**Auth.** Email/password uses sessions issued by the backend. Google sign-in uses Supabase; the backend verifies the Supabase access token by calling Supabase's `/auth/v1/user` (no JWT secret needed) and only trusts verified emails. A first Google login creates an empty company, finished in onboarding.

**Offline tolerance.** If the backend is unreachable but you have a real Supabase session, the dashboard still opens with a banner. Onboarding answers are then saved in the browser and synced to the backend when it responds.

## Getting started

Requirements: Node 20+, Python 3.10+.

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then fill in the keys below
uvicorn app.main:app --reload      # http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local         # then fill in the Supabase values below
npm run dev                        # http://localhost:3000
```

Open http://localhost:3000. In `npm run dev`, Next.js proxies `/api/*` to `http://localhost:8000`. Production builds proxy to the hosted backend (`https://tendersaathi.onrender.com`). Set `BACKEND_URL` to point anywhere else.

### Environment variables

**`backend/.env`**

| Variable | Purpose |
| --- | --- |
| `SERPAPI_KEY` | Tender search and risk analysis ([serpapi.com](https://serpapi.com)) |
| `SARVAM_API_KEY` | Multilingual chat ([sarvam.ai](https://www.sarvam.ai)) |
| `SUPABASE_URL` | Supabase project URL, to verify Google sign-in tokens |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

**`frontend/.env.local`**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe in the browser) |
| `BACKEND_URL` | Backend base URL for the `/api` proxy. Optional: `next dev` defaults to `http://localhost:8000`, production builds default to `https://tendersaathi.onrender.com`. |

Without `SERPAPI_KEY` or `SARVAM_API_KEY`, search and chat return a clear "key not set" error; everything else works. Never commit `.env` files (they are gitignored).

### Setting up Google sign-in

1. In Google Cloud Console, create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In Supabase, go to Authentication, then Providers, then Google, enable it and paste the client ID and secret.
3. In Supabase, go to Authentication, then URL Configuration. Set the Site URL to your deployed domain and add redirect URLs for it and for `http://localhost:3000/**`.

## API

All routes are under `/api` and need `Authorization: Bearer <token>` except register, login and langs.

| Method | Route | |
| --- | --- | --- |
| POST | `/register`, `/login` | Email/password accounts |
| GET / PUT | `/me` | Read or update the company profile |
| POST | `/tenders/search` | Find tenders for the profile (SerpAPI) |
| GET / POST | `/tenders` | List tenders or add one manually |
| POST | `/tenders/{id}/analyze` | Upload a tender PDF for eligibility analysis |
| POST | `/tenders/{id}/intel` | Buyer risk, competitors and past offers |
| GET / PUT | `/tenders/{id}/readiness` | Bid readiness checklist and score |
| GET | `/tenders/{id}/fillpack` | Pre-filled form data and steps |
| GET | `/schemes` | Matched government schemes |
| GET / POST | `/langs`, `/chat` | Languages; RAG chat |
| POST | `/tts` | Read a chat answer aloud (MP3, Sarvam Bulbul) |

Onboarding saves through `PUT /me` with: `name, gstin, udyam, state, city, size, turnover_cr, years, certifications, products, services, women_owned, startup`. It expects the saved company back, including `categories`.

## Project structure

```
backend/app/
  main.py           routes and auth dependency
  supabase_auth.py  Supabase token verification
  categories.py     products/services -> tender categories
  serp.py           SerpAPI search and buyer-risk intel
  analyzer.py       tender PDF extraction and profile matching
  readiness.py      bid readiness score
  schemes.py        scheme matcher
  rag.py            BM25 retrieval + Sarvam chat
  db.py             SQLite schema
frontend/
  app/(public)/     landing, features, how it works, about, login, signup, auth callback
  app/(flow)/       onboarding
  app/(app)/        dashboard, tenders, schemes, chat, profile
  components/       auth form, profile form, hero background, scroll reveal
  lib/              api client, auth gate, Supabase client, profile helpers
```

## Deployment

See [DEPLOY.md](DEPLOY.md). In short:

- **Frontend** goes on Vercel with Root Directory `frontend`, and the three variables above set.
- **Backend** needs a host with a persistent disk (Render, Railway, Fly) or its data moved to Postgres. It cannot run on Vercel: functions there have an ephemeral filesystem, so the SQLite database would be lost between requests.

## Notes

- **Fonts.** The site uses Helvetica Neue (Regular, Medium, Semibold WOFF2 in `frontend/public/fonts/`), falling back to Inter. Helvetica Neue is a licensed typeface: keep the files only if your licence covers web use, otherwise delete them and the site falls back to Inter.
- **Database.** SQLite lives in `backend/data/` (gitignored). Back it up if you run the backend yourself.
- **Security.** Passwords are PBKDF2-hashed and sessions are bearer tokens. There is no rate limiting or password reset yet, so harden the backend before real users.
- **License.** None has been added yet.
