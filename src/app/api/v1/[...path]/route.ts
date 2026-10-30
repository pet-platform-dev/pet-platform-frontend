import { proxyApi } from "@/shared/api/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyApi(request, (await context.params).path);
}

export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
