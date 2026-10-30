# Same-origin staging API proxy

## Root cause and implementation

The Vercel frontend and Render backend are cross-site. Chrome blocks the backend's
SameSite=Lax CSRF cookie in cross-site fetches; credentials:include and correct CORS
cannot override that policy. BrowserSecurityGuard correctly rejects a mutation
without exactly one matching cookie and X-CSRF-Token.

The opt-in Node Route Handler `/api/v1/[...path]` streams HTTP requests to a fixed,
validated server-only backend origin. Browser client HTTP requests use relative
`/api/v1`; public server rendering calls the backend directly without browser
credentials. The flag defaults off, preserving direct localhost development.
NEXT_PUBLIC_API_URL stays absolute for existing Bearer-authenticated messaging
WebSockets; Vercel Route Handlers do not proxy WebSocket upgrades.

A rewrite was evaluated but cannot implement the deliberate Origin policy needed
for the backend's guarded GET `/auth/csrf`. Same-origin GET fetches often omit
Origin. The handler accepts an exact configured Origin, or, for GET/HEAD only,
verifies `Sec-Fetch-Site: same-origin` before adding the configured Origin upstream.
Mutations require the exact Origin; missing, null, foreign or cross-site requests
are rejected before forwarding. Host/X-Forwarded-Host are never trust sources.
Random Vercel preview URLs are intentionally not trusted automatically.

## Security and transport

- Backend URL accepts an exact HTTPS origin (HTTP only for explicit loopback).
  Paths, credentials, queries, fragments and self-proxy loops are rejected.
  Route segments cannot escape `/api/v1`. Query values cannot select an upstream.
- Methods, query strings, body streams, Content-Type (including multipart),
  Authorization, CSRF, conditional requests and Range are forwarded. Only the
  existing four auth cookie names are forwarded; duplicates remain intact for
  backend rejection. Vercel/frontend-only cookies and infrastructure headers stay
  private. No credentials, request bodies or upstream errors are logged by proxy code.
- Every Set-Cookie is appended separately using Node Headers.getSetCookie();
  commas in Expires are never split. HttpOnly, Secure, SameSite=Lax, Path,
  Max-Age and expiration are unchanged. The response is from the frontend host,
  so host-only cookies belong to that host. Unexpected Domain attributes fail
  closed rather than being rewritten. Backend NODE_ENV must remain production.
- Backend CSRF, access authorization, validation, refresh rotation, revocation and
  session isolation are unchanged. The proxy never fabricates a CSRF token or cookie.
- Status/body and application response headers (including Retry-After) survive.
  Hop-by-hop headers, stale decompression lengths/encoding and upstream CORS headers
  are removed. All responses are no-store. External/out-of-API redirects fail
  closed; same-backend API redirects become frontend-relative, without server-side
  following. Upstream requests abort after 55 seconds or browser disconnect.

## Exact deployment configuration

Vercel **Preview/dev**, set before rebuilding, and retain at runtime:

```dotenv
NEXT_PUBLIC_API_PROXY_ENABLED=true
NEXT_PUBLIC_API_URL=https://pet-platform-backend-ksvm.onrender.com/api/v1
API_PROXY_BACKEND_ORIGIN=https://pet-platform-backend-ksvm.onrender.com
API_PROXY_FRONTEND_ORIGIN=https://lapa-staging.vercel.app
```

The last two names are server-only. Origins have no trailing slash or API path.
Keep Node 24.x, Next.js preset, `npm ci`, `npm run build`, default output directory.

Render retains:

```dotenv
NODE_ENV=production
FRONTEND_ORIGINS=https://lapa-staging.vercel.app
```

If other legitimate origins already exist, retain them in the comma-separated
FRONTEND_ORIGINS list. The staging origin already passed the live guard/CORS
checks; no CORS, SameSite=None, cookie Domain, trustedOrigins or security bypass
is needed. The application uses its custom guard, not enabled Nest built-in CSRF
or express-session middleware. Do not change signing secrets or database settings.

After approval: commit/review, configure Preview variables, deploy frontend dev,
then inspect browser Network `/api/v1/auth/csrf` and an empty registration request.
Expect frontend-host Secure HttpOnly SameSite=Lax cookies and validation 400, not
CSRF 403. Test real successful registration/login only with separately approved
synthetic accounts. Keep secrets/credentials out of screenshots and logs.
Rebuild for any NEXT_PUBLIC flag change. Disabling the flag restores direct mode,
which still cannot authenticate reliably across the two current public sites.

## Validation evidence (2026-10-30)

- Frontend full suite: 896/896; final targeted proxy/auth run: 23/23, including
  the subsequently added concurrent session-isolation regression. Backend full
  Vitest suite: 714/714 (59 files). Typecheck, lint, formatting and production builds
  passed for both repositories.
- Proxy regression tests cover configuration, same-origin GET, mutation Origin,
  cross-site rejection, exact body/query/headers, duplicate cookie preservation,
  frontend-only cookie filtering, multiple Set-Cookie/Expires, 204/HEAD, redirect
  containment, path escape, failures, concurrent session isolation and
  browser-versus-server API routing.
- Native production Next/Turbopack build passed with proxy enabled and localhost
  fixture origins. No webpack fallback or dependency changes.
- Real installed Chrome at 375/768/1440: Next production server on 3018 to real
  NestJS controllers/DTOs/BrowserSecurityGuard/AccessTokenGuard on 4018. Synthetic
  domain services run entirely in memory: no PostgreSQL, mail or media writes.
  Covers CSRF, invalid registration, successful registration/login/logout,
  refresh/expiry, verification and password recovery, protected `/auth/me`, missing,
  invalid and duplicate CSRF, foreign Origin, multiple cookies and no overflow.
  Tests explicitly inspect actual login UI submission and SessionProvider reload
  restoration and ensure browser API requests remain on the frontend origin.
- Actual Render through the production proxy function: CSRF 200, host-only
  Secure/HttpOnly/Lax cookie, deliberately invalid empty registration 400.
  One initial probe returned 502; a direct read-only check and retry passed.
  No valid staging registration or account mutation was attempted.
- Initial sandbox backend tests failed before execution with temporary-cache
  EPERM; Native execution passed. The sandbox Next build stalled; Native passed.

Reproduction from the frontend directory (PowerShell, backend dependencies and
existing Playwright runtime installed):

```powershell
npm --prefix ../pet-platform-backend run build
$env:NEXT_PUBLIC_API_PROXY_ENABLED='true'
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:4018/api/v1'
$env:API_PROXY_BACKEND_ORIGIN='http://127.0.0.1:4018'
$env:API_PROXY_FRONTEND_ORIGIN='http://127.0.0.1:3018'
npm run build
# If Playwright is outside this repo, set PLAYWRIGHT_MODULE to its installed entry.
node test/api-proxy.browser.mjs
# Explicit, non-mutating remote probe; never submits a valid registration:
$env:STAGING_PROXY_READ_ONLY_PROBE='1'
node test/api-proxy-staging.mjs
```

## Limits and remaining deployment verification

No cloud deployment was made. Local Chrome success is not deployed Vercel success;
the existing protected staging frontend redirected a fresh browser to Vercel SSO.
Repeat cookie/auth checks after the approved deployment with permitted frontend
access. No Vercel protection was bypassed and no user browser session was reused.

Vercel Functions have a [4.5 MB request/response payload limit](https://vercel.com/docs/functions/limitations#request-body-size).
Streaming through this handler does not lift the platform's inbound upload limit.
Existing media APIs, file limits and storage are unchanged, but staging media
uploads above that platform limit are **not validated/supported by this route**.
Do not advertise this as a solution for arbitrary large uploads; that requires a
separately reviewed routing/storage approach without weakening CSRF.

Render Free cold starts can exceed the existing browser client's 15-second normal
request timeout (45 seconds for uploads). No automatic mutation retries were
introduced. The backend's current IP rate limits also see proxy egress, not an
authenticated browser IP: shared-client throttling remains possible. No blind
trust-proxy/X-Forwarded-For change was made. Arbitrary previews, legacy browsers
without Fetch Metadata on Origin-less GETs, provider quotas and cloud networking
still require environment-specific verification.
