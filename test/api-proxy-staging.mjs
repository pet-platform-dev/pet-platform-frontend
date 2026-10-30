// Explicit opt-in, non-mutating probe. Registration body is ALWAYS invalid {}:
// validation must reject it before reaching the registration service/database.
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
assert.equal(process.env.STAGING_PROXY_READ_ONLY_PROBE, "1");
const { proxyApi } = await load("src/shared/api/proxy.ts");
const frontend = "https://lapa-staging.vercel.app";
const env = {
  NEXT_PUBLIC_API_PROXY_ENABLED: "true",
  API_PROXY_FRONTEND_ORIGIN: frontend,
  API_PROXY_BACKEND_ORIGIN: "https://pet-platform-backend-ksvm.onrender.com",
};
const csrf = await proxyApi(
  new Request(frontend + "/api/v1/auth/csrf", {
    headers: { "sec-fetch-site": "same-origin" },
  }),
  ["auth", "csrf"],
  env,
);
assert.equal(csrf.status, 200);
const { data } = await csrf.json();
const cookie = csrf.headers
  .getSetCookie()
  .find((value) => value.startsWith("__Host-pet_csrf="));
assert(
  cookie &&
    cookie.includes("HttpOnly") &&
    cookie.includes("Secure") &&
    cookie.includes("SameSite=Lax") &&
    !/;\s*Domain=/i.test(cookie),
);
const register = await proxyApi(
  new Request(frontend + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      Origin: frontend,
      "Content-Type": "application/json",
      "X-CSRF-Token": data.csrfToken,
      Cookie: cookie.split(";")[0],
    },
    body: "{}",
  }),
  ["auth", "register"],
  env,
);
assert.equal(register.status, 400);
console.log(
  "PASS actual Render through proxy function: CSRF 200, host-only secure cookie, deliberately invalid registration 400; no account created. Not a deployed Vercel/browser test.",
);
