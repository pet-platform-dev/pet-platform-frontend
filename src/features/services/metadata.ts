import type { Metadata } from "next";
export function servicesMetadata(
  title: string,
  description: string,
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): Metadata {
  let canonical: string | undefined;
  // No staging host or invented production domain. Canonical only after explicit configuration.
  if (env.SERVICES_CANONICAL_ORIGIN && env.VERCEL_ENV !== "preview") {
    try {
      const u = new URL(env.SERVICES_CANONICAL_ORIGIN);
      if (
        u.origin === env.SERVICES_CANONICAL_ORIGIN &&
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !/(?:localhost|\.vercel\.app|\.onrender\.com)$/.test(u.hostname)
      )
        canonical = new URL(path, u).href;
    } catch {}
  }
  return {
    title: title + " — Лапа",
    description: description.slice(0, 160),
    robots: { index: false, follow: true },
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}
