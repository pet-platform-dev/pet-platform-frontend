# Pet Platform frontend

Next.js 16 App Router, React Compiler, TypeScript and Tailwind CSS. Ukrainian product UI uses FSD-lite: app routes, widgets, auth features, user entities and shared API handling. The frontend consumes NestJS REST and never connects to PostgreSQL.

## Local development

Install dependencies with npm install. NEXT_PUBLIC_API_URL defaults to http://localhost:4000/api/v1; use .env.local to override it and .env.example for the safe placeholder. Start the backend with matching FRONTEND_ORIGINS, then run npm run dev and open http://localhost:3000.

Routes: /, /login, /register and protected /account. Registration and login authenticate the account; /account displays own profile fields. Access tokens remain in memory, refresh cookies are HttpOnly, and TanStack Query owns current-user state. Reload restores the session through the backend. Web Locks coordinate refresh across tabs; BroadcastChannel synchronizes logout without token values. Production needs same-site HTTPS frontend/API hosts. Auth policy and contracts live in the sibling pet-platform-docs architecture/auth.md and architecture/api.md.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Focused Node tests transpile the actual validation/client modules and mock fetch; they cover input validation, confirmation, session restoration, single refresh retry, logout and localized errors. Browser validation additionally checks real backend sessions, reload, two tabs, errors and responsive layout. No persistent browser token storage or staff/profile editing flows are implemented.
