import { cache } from "react";
import { z } from "zod";
import { ApiError } from "@/shared/api/client";
import { proxyConfig } from "@/shared/api/proxy-config";
import { locationSchema } from "@/entities/location/model";
import {
  categorySchema,
  providerSchema,
  offerSchema,
  offersPageSchema,
  providersPageSchema,
} from "./model";
import { serializeServiceQuery, type ServiceQuery } from "./query";
export function servicesApiBase(env: NodeJS.ProcessEnv = process.env) {
  if (env.NEXT_PUBLIC_API_PROXY_ENABLED === "true")
    return proxyConfig(env).backend + "/api/v1";
  const value = env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/api/v1" ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      ))
  )
    throw Error("Invalid services API base");
  return value;
}
async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(servicesApiBase() + path, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(503, "Послуги тимчасово недоступні. Спробуйте ще раз.");
  }
  if (!r.ok)
    throw new ApiError(
      r.status,
      r.status === 404
        ? "Сторінка недоступна"
        : "Не вдалося завантажити послуги",
    );
  let payload: unknown;
  try {
    payload = await r.json();
  } catch {
    throw new ApiError(503, "Не вдалося завантажити послуги");
  }
  const result = schema.safeParse(payload);
  if (!result.success)
    throw new ApiError(503, "Не вдалося завантажити послуги");
  return result.data;
}
export const getServiceCategories = cache(
  async () =>
    (
      await get(
        "/service-categories",
        z.object({ data: z.array(categorySchema) }),
      )
    ).data,
);
export const getServiceLocation = async (id?: string) =>
  id
    ? (
        await get(
          "/service-filter-references?" +
            new URLSearchParams({ locationId: id }),
          z.object({ data: z.object({ location: locationSchema.nullable() }) }),
        )
      ).data.location
    : null;
export const getServiceProvider = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Профіль недоступний");
  const { data } = await get(
    "/service-providers/" + id,
    z.object({ data: providerSchema }),
  );
  if (data.id.toLowerCase() !== id.toLowerCase())
    throw new ApiError(404, "Профіль недоступний");
  return data;
});
export const getServiceOffer = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Послуга недоступна");
  const { data } = await get(
    "/service-offers/" + id,
    z.object({ data: offerSchema }),
  );
  if (data.id.toLowerCase() !== id.toLowerCase())
    throw new ApiError(404, "Послуга недоступна");
  return data;
});
export const getServiceOffers = (q: ServiceQuery) =>
  get("/service-offers?" + serializeServiceQuery(q), offersPageSchema);
export const getServiceProviders = (q: ServiceQuery) =>
  get("/service-providers?" + serializeServiceQuery(q), providersPageSchema);
export const getProviderOffers = (id: string, q: ServiceQuery) => {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Профіль недоступний");
  return get(
    `/service-providers/${id}/offers?` + serializeServiceQuery(q),
    offersPageSchema,
  );
};
