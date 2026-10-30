import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-frontend.mjs";

const { proxyApi } = await load("src/shared/api/proxy.ts");
const { proxyConfig } = await load("src/shared/api/proxy-config.ts");
const env = {
  NEXT_PUBLIC_API_PROXY_ENABLED: "true",
  API_PROXY_FRONTEND_ORIGIN: "https://frontend.example",
  API_PROXY_BACKEND_ORIGIN: "https://backend.example",
};
const make = (method = "GET", headers = {}, body) =>
  new Request("https://frontend.example/api/v1/auth/csrf?q=a%20b&q=c", {
    method,
    headers: { "sec-fetch-site": "same-origin", ...headers },
    body,
  });

test("proxy configuration fails closed, disallows loops and non-origin upstreams", () => {
  assert.deepEqual(proxyConfig(env), {
    backend: "https://backend.example",
    frontend: "https://frontend.example",
  });
  for (const value of [
    undefined,
    "",
    "http://remote.example",
    "https://x/a",
    "https://x/",
    "https://u:p@x",
    "https://x?url=y",
    env.API_PROXY_FRONTEND_ORIGIN,
  ])
    assert.throws(() =>
      proxyConfig({ ...env, API_PROXY_BACKEND_ORIGIN: value }),
    );
  assert.throws(() =>
    proxyConfig({ ...env, NEXT_PUBLIC_API_PROXY_ENABLED: "false" }),
  );
  assert.equal(
    proxyConfig({ ...env, API_PROXY_BACKEND_ORIGIN: "http://localhost:4000" })
      .backend,
    "http://localhost:4000",
  );
});

test("same-origin GET obtains CSRF with deliberately synthesized trusted Origin", async () => {
  const response = await proxyApi(
    make(),
    ["auth", "csrf"],
    env,
    async (url, options) => {
      assert.equal(
        String(url),
        "https://backend.example/api/v1/auth/csrf?q=a%20b&q=c",
      );
      assert.equal(
        options.headers.get("origin"),
        env.API_PROXY_FRONTEND_ORIGIN,
      );
      assert.equal(options.redirect, "manual");
      assert.equal(options.cache, "no-store");
      return Response.json({ data: { csrfToken: "synthetic" } });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("foreign/missing/null Origin and cross-site Fetch Metadata never reach upstream", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return new Response();
  };
  for (const request of [
    make("POST"),
    make("POST", { origin: "null" }),
    make("POST", { origin: "https://evil.example" }),
    make("POST", {
      origin: env.API_PROXY_FRONTEND_ORIGIN,
      "sec-fetch-site": "cross-site",
    }),
    make("GET", { "sec-fetch-site": "cross-site" }),
    new Request("https://frontend.example/api/v1/auth/csrf"),
    make("GET", { origin: "https://evil.example" }),
  ])
    assert.equal(
      (await proxyApi(request, ["auth", "csrf"], env, fetcher)).status,
      403,
    );
  assert.equal(calls, 0);
});

test("method, bytes, query, bearer, CSRF and duplicate cookies are forwarded unchanged", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const request = make(
      method,
      {
        origin: env.API_PROXY_FRONTEND_ORIGIN,
        cookie: "pet_csrf=a; pet_csrf=b; pet_refresh=synthetic",
        authorization: "Bearer synthetic-access",
        "x-csrf-token": "a",
        "content-type": "multipart/form-data; boundary=test",
        "if-match": "revision-2",
        "x-forwarded-host": "evil.example",
        "x-vercel-secret": "must-not-forward",
      },
      "--test\r\nsynthetic bytes\r\n--test--",
    );
    const response = await proxyApi(
      request,
      ["auth", "login"],
      env,
      async (_url, options) => {
        assert.equal(options.method, method);
        for (const name of [
          "cookie",
          "authorization",
          "x-csrf-token",
          "content-type",
          "if-match",
        ])
          assert.equal(options.headers.get(name), request.headers.get(name));
        assert.equal(options.headers.has("x-forwarded-host"), false);
        assert.equal(options.headers.has("x-vercel-secret"), false);
        assert.equal(
          await new Response(options.body).text(),
          "--test\r\nsynthetic bytes\r\n--test--",
        );
        return Response.json(
          { message: "synthetic validation" },
          { status: 400 },
        );
      },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "synthetic validation",
    });
  }
});

test("frontend-only cookies are never disclosed to the backend", async () => {
  const response = await proxyApi(
    make("GET", {
      cookie:
        "_vercel_jwt=synthetic-private; pet_csrf=a; pet_refresh=b; theme=warm",
    }),
    ["auth", "csrf"],
    env,
    async (_url, options) => {
      assert.equal(options.headers.get("cookie"), "pet_csrf=a; pet_refresh=b");
      return new Response(null, { status: 204 });
    },
  );
  assert.equal(response.status, 204);
});

test("multiple Set-Cookie values, expiration, security flags and error headers survive", async () => {
  const cookies = [
    "__Host-pet_csrf=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600",
    "__Secure-pet_refresh=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  const headers = new Headers({
    "Retry-After": "60",
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://backend.example",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  const response = await proxyApi(
    make(),
    ["auth", "csrf"],
    env,
    async () => new Response("{}", { status: 429, headers }),
  );
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.has("access-control-allow-origin"), false);
});

test("host-only policy and redirect destinations fail closed without following redirects", async () => {
  for (const headers of [
    {
      "set-cookie":
        "pet_csrf=a; Domain=backend.example; Secure; HttpOnly; SameSite=Lax",
    },
    { location: "https://evil.example/steal" },
    { location: "/outside-api" },
  ])
    assert.equal(
      (
        await proxyApi(
          make(),
          ["auth", "csrf"],
          env,
          async () => new Response(null, { status: 302, headers }),
        )
      ).status,
      502,
    );
  const response = await proxyApi(
    make(),
    ["auth", "csrf"],
    env,
    async () =>
      new Response(null, {
        status: 307,
        headers: { location: "https://backend.example/api/v1/listings?page=2" },
      }),
  );
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/api/v1/listings?page=2");
});

test("path escape, unavailable configuration and upstream errors never leak details", async () => {
  for (const path of [
    [".."],
    ["auth/../../x"],
    ["https://evil.example"],
    ["%2e%2e"],
    [],
  ])
    assert.equal((await proxyApi(make(), path, env)).status, 400);
  assert.equal((await proxyApi(make(), ["auth"], {})).status, 503);
  const response = await proxyApi(make(), ["auth"], env, async () => {
    throw new Error("secret synthetic upstream credential");
  });
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("secret"), false);
});

test("HEAD and 204 replies have no body; connection-specific headers are removed", async () => {
  const response = await proxyApi(
    make("HEAD"),
    ["listings"],
    env,
    async () =>
      new Response(null, {
        status: 204,
        headers: {
          connection: "x-private-hop",
          "x-private-hop": "remove",
          "content-length": "0",
        },
      }),
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.has("x-private-hop"), false);
  assert.equal(response.headers.has("content-length"), false);
});

test("browser API calls use the frontend origin while server calls use the fixed backend", async () => {
  const { publicRequest } = await load("src/shared/api/client.ts");
  const saved = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    flag: process.env.NEXT_PUBLIC_API_PROXY_ENABLED,
    backend: process.env.API_PROXY_BACKEND_ORIGIN,
  };
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return Response.json({ data: [] });
  };
  process.env.NEXT_PUBLIC_API_PROXY_ENABLED = "true";
  process.env.API_PROXY_BACKEND_ORIGIN = "https://backend.example";
  try {
    globalThis.window = {};
    await publicRequest("/listings?page=2");
    delete globalThis.window;
    await publicRequest("/listings?page=2");
    assert.deepEqual(urls, [
      "/api/v1/listings?page=2",
      "https://backend.example/api/v1/listings?page=2",
    ]);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.window === undefined) delete globalThis.window;
    else globalThis.window = saved.window;
    if (saved.flag === undefined)
      delete process.env.NEXT_PUBLIC_API_PROXY_ENABLED;
    else process.env.NEXT_PUBLIC_API_PROXY_ENABLED = saved.flag;
    if (saved.backend === undefined)
      delete process.env.API_PROXY_BACKEND_ORIGIN;
    else process.env.API_PROXY_BACKEND_ORIGIN = saved.backend;
  }
});

test("concurrent proxy requests never share another session's credentials or cookies", async () => {
  const responses = await Promise.all(
    ["first", "second"].map(async (session) => {
      const response = await proxyApi(
        make(
          "POST",
          {
            origin: env.API_PROXY_FRONTEND_ORIGIN,
            authorization: `Bearer ${session}`,
            cookie: `pet_refresh=${session}`,
            "x-csrf-token": session,
          },
          "{}",
        ),
        ["auth", "refresh"],
        env,
        async (_url, options) => {
          await new Promise((resolve) =>
            setTimeout(resolve, session === "first" ? 10 : 1),
          );
          assert.equal(
            options.headers.get("authorization"),
            `Bearer ${session}`,
          );
          assert.equal(options.headers.get("cookie"), `pet_refresh=${session}`);
          assert.equal(options.headers.get("x-csrf-token"), session);
          return new Response(session, {
            headers: {
              "Set-Cookie": `pet_refresh=${session}; HttpOnly; SameSite=Lax; Path=/api/v1/auth`,
            },
          });
        },
      );
      assert.deepEqual(response.headers.getSetCookie(), [
        `pet_refresh=${session}; HttpOnly; SameSite=Lax; Path=/api/v1/auth`,
      ]);
      return response.text();
    }),
  );
  assert.deepEqual(responses, ["first", "second"]);
});
