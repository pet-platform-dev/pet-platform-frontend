# Vercel standalone frontend build validation

Date: 2026-10-30. All repositories remain on `dev`; no commit or push.

## Root cause and filesystem audit

`npm run build` ran `scripts/sync-legal-integrity.mjs --check`, which imported
`../../pet-platform-backend/src/legal/legal-content.ts`. Vercel checks out only
the frontend repository, so the required sibling file did not exist. This exact
ENOENT was reproduced in a local frontend-only Git clone before applying the fix.

The build's only external repository filesystem dependency was that algorithm
import. No application `src` filesystem import, Next configuration or other
production build step reads backend/docs files. `sync-legal-drafts.mjs` separately
reads/writes the docs repository and is invoked by existing local documentation
tests; it was never part of the production build. It remains an explicit
`npm run legal:check:docs` check and requires the docs checkout. The full `npm test`
still includes those existing cross-doc checks; it was not used as a standalone
checkout acceptance command. Browser integration fixtures also retain their
explicit multi-repository setup requirements.

## Integrity architecture

Before: the frontend hash checker loaded the backend implementation during every
build and compared computed identities to the frontend's checked-in identity file.

After: the normal build performs the same strict comparison using a small
repository-local, build-time implementation of `lapa-legal-v1`. Canonical JSON
still sorts object keys, preserves array order, normalizes NFC and LF, and hashes
UTF-8 using SHA-256. No hashing code or legal prose was added to registration's
browser bundle; the modules live under `scripts/lib` and are not imported by `src`.
Missing content/identity files, unknown status and changed digests fail closed.
Nothing regenerates identities or skips missing files during a normal build.

`npm run legal:check:cross-repo -- --backend-root ../pet-platform-backend` explicitly
loads the backend algorithm and current registry. It checks canonicalization
vectors, digest parity, current versions, status/path, exact content snapshots,
stored/recomputed hashes and current draft activation/effective-date boundaries.
It fails if required backend files are absent. The unchanged backend
`scripts/verify-legal-content.mjs` remains the broader release gate for docs
manifest parity, historical immutability and full publication validation.

`--write` remains a separate reviewed-revision operation; it is not run during
validation. Existing Terms and Privacy identity files/prose were not modified:

| Document | Version     | State | SHA-256                                                          |
| -------- | ----------- | ----- | ---------------------------------------------------------------- |
| Terms    | 16g-draft.1 | DRAFT | fca1f5897f4f0207f3fcc7bf9ce6197d1d82e2f5fbf26399d651d881432676ee |
| Privacy  | 16g-draft.1 | DRAFT | 772246224867dae7e820d2adfecca0246c8877be666f2ca722e680038253a7b7 |

Backend/manifest activation remains `DRAFT_ONLY`; effective dates, accepted
versions and publication state remain unchanged. No backend or database commands
were run for this task.

## Isolated checkout evidence

Created `.tmp/vercel-standalone/frontend` using a local independent Git clone on
`dev`, then copied only task changes. No backend/docs siblings, environment files
or shared/symlinked node_modules were supplied. `npm ci` installed 383 packages
from the lockfile into that clone successfully. Actual Node: **v24.21.0**.

Before fix, the original checker failed with ENOENT under
`.tmp/vercel-standalone/pet-platform-backend/src/legal/legal-content.ts`.

After fix, exact **`npm run build` passed**, including local legal integrity,
default Next.js 16.3.8 **Turbopack**, TypeScript and generation of 25 static pages.
Compilation completed in 50 seconds. No `--webpack`, backend checkout, API/DB
fixture or environment file was needed. Existing next.config.ts has no webpack
plugin/configuration requiring a bundler override and was not changed.

Logs outside the repository:

- `.tmp/vercel-isolated-ci.log`
- `.tmp/vercel-before.log`
- `.tmp/vercel-isolated-build.log`
- `.tmp/vercel-legal-tests-final.log`
- `.tmp/vercel-lint-native.log`
- `.tmp/vercel-typecheck-native.log`
- `.tmp/vercel-isolated-audit.json`

## Tests and checks

Targeted legal integrity, publication, registration, legal-page and privacy tests:
**41/41 pass**. The controlled fixture test calls both the checker functions and
the actual cross-repository CLI; intentional registry digest mismatch fails with
nonzero exit. Altered algorithm/activation, changed local prose and missing files
are rejected. Real frontend/backend check also passes against the existing registry
with `activation=DRAFT_ONLY`; Markdown review synchronization passes unchanged.

Typecheck and ESLint pass; new unused-variable warnings were corrected and final
lint rerun. Prettier and Git whitespace checks pass. No UI/runtime implementation
changed, so the previously passing full application suite was not repeated.

The final four integrity regression groups also pass inside the isolated checkout,
including real CLI success/mismatch failure against synthetic backend files.
Evidence: `.tmp/vercel-isolated-regressions.log`.

## Changed files

- `package.json`, `package-lock.json`: Node 24.x and explicit check commands; no dependency version changes.
- `scripts/sync-legal-integrity.mjs`: local-only build check.
- `scripts/lib/legal-content.mjs`: build-time canonical JSON/SHA-256 contract.
- `scripts/lib/legal-integrity.mjs`: local document loading and identity comparison.
- `scripts/lib/legal-cross-repo.mjs`: explicit backend parity/registry checks.
- `scripts/check-legal-cross-repo.mjs`: optional backend checkout CLI path.
- `test/legal-integrity.test.mjs`: normalization, missing/tampered data and CLI mismatch regressions.
- `test/registration-legal.test.mjs`: accurate local-contract test description; assertion preserved.
- `README.md`: standalone build and explicit release-check instructions.
- `docs/vercel-standalone-build-validation.md`: reproduction, results and prerequisites.

## Recommended Vercel settings

| Setting             | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| Repository          | pet-platform-frontend                                                  |
| Branch              | dev for this validation; choose the intended release branch explicitly |
| Framework preset    | Next.js                                                                |
| Root Directory      | Repository root (blank or `.`)                                         |
| Node.js             | 24.x, also pinned in package.json engines and lockfile root metadata   |
| Install Command     | npm ci                                                                 |
| Build Command       | npm run build                                                          |
| Output Directory    | Framework default; do not override                                     |
| NEXT_PUBLIC_API_URL | Actual backend HTTPS origin plus /api/v1, set before build             |

Do not add backend files to Vercel's checkout or append `--webpack`. Existing auth
deployment requirements (compatible same-site HTTPS frontend/API hosts, exact
backend origins and real mail configuration) remain separate prerequisites.

## Remaining issues and preservation

No local standalone-build blocker remains. **No Vercel cloud deployment was run**,
so cloud deployment success is not claimed.

`npm ci`/read-only `npm audit` reported three existing dependency vulnerabilities:
Next.js 16.3.8 (critical), Zod (high), fast-uri (moderate). These are unresolved
dependency/security rollout issues, distinct from the fixed filesystem failure.
The audit reports a Next.js fix at 16.4.3. No dependency upgrade or `npm audit fix`
was applied in this focused task; package versions remain unchanged. Actual
Vercel security enforcement/acceptance has not been tested.

Only frontend scripts, their tests, README/report and Node engine metadata changed.
Backend `.env.example` remains the pre-existing unrelated modification. Backend
legal registry, docs manifest, frontend legal content/identity, design, auth/API,
media, breeder workflows and all database data remain untouched. Generated .next
cache was cleared to make disk space for the isolated install/build; no source,
mail captures, user media or test/demo records were removed.
