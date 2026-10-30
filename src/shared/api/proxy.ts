import { proxyConfig } from "./proxy-config";

const requestHeaders = [
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "if-match",
  "if-none-match",
  "if-modified-since",
  "range",
  "x-csrf-token",
];
const hopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const failure = (status: number) =>
  Response.json(
    { statusCode: status, message: "Не вдалося виконати запит" },
    { status, headers: { "Cache-Control": "no-store" } },
  );

/** Fixed upstream only; neither a destination nor a trusted Origin comes from user input. */
export async function proxyApi(
  request: Request,
  segments: string[],
  env: NodeJS.ProcessEnv = process.env,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  let config;
  try {
    config = proxyConfig(env);
  } catch {
    return failure(503);
  }
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const safe = ["GET", "HEAD"].includes(request.method);
  // Same-origin GET fetches omit Origin. Fetch Metadata verifies this special case.
  // Never manufacture an allowed Origin for a mutation or a cross-site navigation.
  if (
    (origin !== null && origin !== config.frontend) ||
    (site !== null && site !== "same-origin") ||
    (origin === null && !(safe && site === "same-origin"))
  )
    return failure(403);
  if (
    !segments.length ||
    segments.some((part) => !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(part))
  )
    return failure(400);

  const incoming = new URL(request.url);
  const upstream = new URL(`/api/v1/${segments.join("/")}`, config.backend);
  upstream.search = incoming.search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Do not disclose frontend-only cookies (including Vercel protection cookies).
  // Keep duplicate auth cookies intact so the backend can reject ambiguity.
  const cookiesIn = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) =>
      /^(?:__Host-pet_csrf|__Secure-pet_refresh|pet_csrf|pet_refresh)=/.test(
        part,
      ),
    );
  if (cookiesIn.length) headers.set("Cookie", cookiesIn.join("; "));
  headers.set("Origin", config.frontend);
  // Fetch decompresses responses. Request identity encoding and strip stale lengths below.
  headers.set("Accept-Encoding", "identity");
  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      body: safe ? undefined : request.body,
      ...(safe ? {} : { duplex: "half" }),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
    };
    const response = await fetchUpstream(upstream, init);
    const result = new Headers();
    const connectionHeaders = new Set(
      (response.headers.get("connection") ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase()),
    );
    response.headers.forEach((value, name) => {
      if (
        !hopHeaders.has(name) &&
        !connectionHeaders.has(name) &&
        !["set-cookie", "content-encoding", "content-length"].includes(name) &&
        !name.startsWith("access-control-")
      )
        result.set(name, value);
    });
    const cookies = response.headers.getSetCookie();
    // Backend cookies are host-only. Fail closed on unexpected Domain configuration;
    // do not rewrite cookie security attributes or broaden their scope.
    if (cookies.some((cookie) => /;\s*domain\s*=/i.test(cookie))) {
      await response.body?.cancel();
      return failure(502);
    }
    for (const cookie of cookies) result.append("Set-Cookie", cookie);
    const location = result.get("location");
    if (location) {
      const target = new URL(location, upstream);
      if (
        target.origin !== config.backend ||
        !target.pathname.startsWith("/api/v1/")
      ) {
        await response.body?.cancel();
        return failure(502);
      }
      result.set("location", target.pathname + target.search + target.hash);
    }
    result.set("Cache-Control", "no-store");
    result.set("Vercel-CDN-Cache-Control", "no-store");
    result.set("X-Content-Type-Options", "nosniff");
    return new Response(
      safe && request.method === "HEAD" ? null : response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: result,
      },
    );
  } catch {
    // Do not log URLs, headers, bodies or upstream errors: they may contain credentials.
    return failure(502);
  }
}
