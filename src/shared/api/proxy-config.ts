// Imported only by the Node Route Handler. Never expose these settings as NEXT_PUBLIC.
export function proxyConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NEXT_PUBLIC_API_PROXY_ENABLED !== "true")
    throw new Error("API proxy is disabled");
  const origin = (value: string | undefined) => {
    if (!value) throw new Error("Missing API proxy origin");
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.origin !== value ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    )
      throw new Error("Invalid API proxy origin");
    return url.origin;
  };
  const backend = origin(env.API_PROXY_BACKEND_ORIGIN);
  const frontend = origin(env.API_PROXY_FRONTEND_ORIGIN);
  if (backend === frontend) throw new Error("API proxy loop");
  return { backend, frontend };
}
