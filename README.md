# Pet Platform frontend

## Standalone production deployment (Vercel)

Use Node.js **24.x**, framework preset **Next.js**, install command `npm ci`,
build command `npm run build`, and the framework's default output directory.
For this standalone Git repository, Root Directory is the repository root.
Set `NEXT_PUBLIC_API_URL` to the deployed backend HTTPS URL including `/api/v1`
before building. For separate Vercel/Render sites, enable the same-origin HTTP
proxy as documented in [staging API proxy](docs/staging-api-proxy.md). Direct
browser authentication still requires compatible same-site HTTPS hosts.

The normal build verifies local Terms/Privacy content against the checked-in
SHA-256 identities before invoking Next.js. It needs neither a backend nor a
documentation checkout. The `lapa-legal-v1` canonical JSON contract preserves NFC,
LF, sorted object keys, ordered arrays and UTF-8 SHA-256. This build-time code is
outside `src` and is not imported by the registration bundle.

```sh
npm run legal:check
# Explicit release/local checks when independent repositories are available:
npm run legal:check:cross-repo -- --backend-root ../pet-platform-backend
npm run legal:check:docs
```

The cross-repository command fails if the backend is missing or its current
registry/content/digest contract differs. The Markdown command requires the
sibling docs checkout. Neither command is part of the standalone build. The
backend's existing `verify-legal-content.mjs` remains the full release gate for
manifest parity, immutable historical revisions and publication rules.

After an explicitly reviewed legal revision, `node scripts/sync-legal-integrity.mjs --write`
regenerates the local identity file; ordinary builds only check it and fail on
missing or changed content. This deployment fix does not revise or approve legal
documents: current versions remain `16g-draft.1`, DRAFT, with backend/manifest
activation `DRAFT_ONLY` and no effective dates.

Next.js 16 App Router, React Compiler, TypeScript and Tailwind CSS. Ukrainian product UI uses FSD-lite: app routes, widgets, auth features, user entities and shared API handling. The frontend consumes NestJS REST and never connects to PostgreSQL.

## Local development

Install dependencies with npm install. NEXT_PUBLIC_API_URL defaults to http://localhost:4000/api/v1; use .env.local to override it and .env.example for the safe placeholder. Start the backend with matching FRONTEND_ORIGINS, then run npm run dev and open http://localhost:3000.

Routes: /, /login, /register and protected /account. Registration and login authenticate the account; /account displays own profile fields. Access tokens remain in memory, refresh cookies are HttpOnly, and TanStack Query owns current-user state. Reload restores the session through the backend. Web Locks coordinate refresh across tabs; BroadcastChannel synchronizes logout without token values. Production uses the same-origin proxy or compatible same-site HTTPS frontend/API hosts. Auth policy and contracts live in the sibling pet-platform-docs architecture/auth.md and architecture/api.md.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Focused Node tests transpile the actual validation/client modules and mock fetch; they cover input validation, confirmation, session restoration, single refresh retry, logout and localized errors. Browser validation additionally checks real backend sessions, reload, two tabs, errors and responsive layout. No persistent browser token storage or staff/profile editing flows are implemented.
