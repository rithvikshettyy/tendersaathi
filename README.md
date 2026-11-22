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
| **Tender discovery** | One click pulls open bids from **GeM's live bid list** (public endpoint, no login) and searches official government sites only (GeM, CPPP, eTenders, your state's e-procurement portal, other `.gov.in` / `.nic.in` sites) with **SerpAPI** (Google, past month) and **You.com Search** (`include_domains`, past month). Results are merged and duplicates removed. |
| **Automatic tender reading** | Each tender page or PDF is read with **You.com Extract** (falls back to a direct download of the public page). Closing date, estimated value, EMD, buyer, bid/tender ID and pincode are extracted; closed tenders are dropped to the bottom. |
| **Win chance ranking** | Every open tender gets a 0 to 100 win chance (High / Medium / Low) with reasons: eligibility (turnover, experience, certificates), match with what you sell, MSE/startup preference, location, tender size vs your turnover, days left, and buyer risk. |
| **PDF eligibility check** | EMD, turnover, experience, certifications, MSE/startup relaxations and OEM clauses are compared with your profile, giving red / amber / green flags and a verdict. Runs automatically on the read page, or on a PDF you upload. |
| **Buyer risk and competitors** | Public search signals about the issuing organisation (disputes, delays, blacklisting), likely competitors and past offer values. |
| **Bid readiness score** | 0 to 100 from a 15-item document checklist, profile completeness, PDF alignment and time left, with the gaps listed. |
| **Schemes and benefits** | 13 central MSME, startup and procurement schemes matched to your profile (EMD exemption, purchase preference, CGTMSE, PMEGP and others). |
| **Multilingual assistant** | RAG chatbot over your profile, tenders, PDFs and schemes, answering in 11 languages through Sarvam. Every reply has a WhatsApp-style voice note (play/pause, progress, optional auto-play). |
| **Assisted form filling** | A ready data pack and step list for portal forms. See [what it does not do](#what-it-does-not-do). |
| **Sign-in** | Google (via Supabase) or email and password. |

## What it does not do

- **It does not submit bids.** SerpAPI is a search API; it cannot solve captchas or submit forms, and automating portal submissions would also break most portals' terms. The fill pack prepares your data; you log in, sign with your DSC and submit yourself.
- **It does not guarantee every active tender.** Discovery uses search indexes (Google via SerpAPI, You.com), which miss some listings and lag by days. Every result is checked for a closing date; tenders without one are marked "verify on portal".
- **It does not get past CAPTCHAs or logins.** Pages behind them are scored from the search summary only, and flagged as such.
- **API calls are cached** in SQLite (searches 6 h, tender pages 3 days) to save credits; repeat searches cost nothing.
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

**Data storage (Supabase).** For Google logins, the app saves the user's working data to Supabase tables, each secured so a user sees only their own rows (schema in `supabase/migrations/`): `profiles` (company details), `tenders` (every tracked tender with its PDF analysis, buyer-risk result, bid checklist and score), `chat_messages`, and `events` (usage analytics: login, search, PDF analysis, risk check, checklist, chat, voice). The `user_analytics` view summarises each user. Saving happens in one place, `frontend/lib/cloud.ts`, which watches the shared API client, so every screen is covered. The backend's own database can be reset on some hosts, so on login the profile is also restored from Supabase when the backend has none. Email/password accounts have no Supabase identity and are not mirrored.

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
| `YDC_API_KEY` | You.com Search + Extract: tender search and reading tender pages/PDFs ([you.com/platform](https://you.com/platform)) |
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

## Sample tenders (seed data)

`backend/seed/gem_samples/` holds 20 **synthetic** bid documents in the layout of GeM bid PDFs (Bid Details, EMD/ePBG, MII and MSE purchase preference, relaxation clauses, technical specifications, consignee table, buyer terms, disclaimer). They cover IT hardware, CCTV, LED lights, manpower, housekeeping, security, furniture, vehicles, medical consumables, uniforms, solar, cables, AC maintenance, printers, water purifiers and fire safety across 15 states; 3 are already closed. Every page is watermarked SAMPLE and says it was not issued by GeM.

Click **Load sample tenders** on the Tenders page (or `POST /api/tenders/demo`) to load and score them for the signed-in company. Closing dates are relative to the day they were generated, so regenerate before a demo:

```bash
cd backend
pip install reportlab
python seed/make_gem_samples.py
```

## API

All routes are under `/api` and need `Authorization: Bearer <token>` except register, login and langs.

| Method | Route | |
| --- | --- | --- |
| POST | `/register`, `/login` | Email/password accounts |
| GET / PUT | `/me` | Read or update the company profile |
| GET | `/status` | Which of SerpAPI / You.com are configured (no auth) |
| POST | `/tenders/search` | Find open tenders for the profile: GeM live bid list + SerpAPI + You.com Search |
| POST | `/tenders/read?limit=4` | Read the next unread tenders (You.com Extract), extract terms, score win chance. Call until `remaining` is 0 |
| POST | `/tenders/{id}/read` | Re-read one tender from its official page |
| GET / POST | `/tenders` | List tenders (open first, best win chance first) or add one manually |
| POST | `/tenders/demo` | Load the 20 sample GeM-format bid PDFs as tenders and score them (call again to re-score) |
| GET | `/demo/pdf/{name}` | Download a sample bid PDF (no auth; synthetic data) |
| POST | `/tenders/upload` | Upload any tender PDF: adds it to your list, analysed and scored (same PDF again re-analyses it) |
| POST | `/tenders/{id}/analyze` | Upload a tender PDF for eligibility analysis |
| POST | `/tenders/{id}/intel` | Buyer risk, competitors and past offers |
| GET / PUT | `/tenders/{id}/readiness` | Bid readiness checklist and score |
| GET | `/tenders/{id}/fillpack` | Pre-filled form data and steps |
| GET | `/schemes` | Matched government schemes |
| GET / POST | `/langs`, `/chat` | Languages; RAG chat |
| POST | `/stt?lang=hi` | Voice input: transcribe up to 30 s of audio with Sarvam `saaras:v4` (used when the browser has no live speech recognition) |
| POST | `/tts` | Read a chat answer aloud (MP3, Sarvam Bulbul) |

Onboarding saves through `PUT /me` with: `name, gstin, udyam, state, city, size, turnover_cr, years, certifications, products, services, women_owned, startup`. It expects the saved company back, including `categories`.

## Project structure

```
backend/app/
  main.py           routes and auth dependency
  supabase_auth.py  Supabase token verification
  categories.py     products/services -> tender categories
  serp.py           SerpAPI search and buyer-risk intel
  youcom.py         You.com Search + Extract client
  sources.py        official portals (central + state) and URL filters
  pipeline.py       find -> read -> extract facts -> win chance
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
