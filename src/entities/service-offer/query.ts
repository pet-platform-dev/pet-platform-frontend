import { z } from "zod";
import { categorySlugs } from "./model";
export const serviceQuerySchema = z
  .strictObject({
    q: z
      .string()
      .trim()
      .max(100)
      .transform((s) => s || undefined)
      .refine((s) => !s || s.length >= 2)
      .optional(),
    category: z.enum(categorySlugs).optional(),
    providerKind: z.enum(["INDIVIDUAL", "ORGANIZATION"]).optional(),
    species: z.enum(["dog", "cat"]).optional(),
    locationId: z.uuid().optional(),
    regionId: z
      .string()
      .regex(/^UA\d{2}$/)
      .optional(),
    mode: z.enum(["ONSITE", "MOBILE", "REMOTE"]).optional(),
    priceModel: z.enum(["FIXED", "FROM", "ON_REQUEST"]).optional(),
    providerId: z.uuid().optional(),
    sort: z.enum(["newest", "name_asc"]).default("newest"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(24).default(24),
  })
  .refine((q) => q.mode !== "REMOTE" || (!q.locationId && !q.regionId));
export type ServiceQuery = z.infer<typeof serviceQuerySchema>;
export type SearchParams = Record<string, string | string[] | undefined>;
export function parseServiceQuery(params: SearchParams) {
  return serviceQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ),
  );
}
export function serializeServiceQuery(input: ServiceQuery) {
  const q = serviceQuerySchema.parse(input);
  const out = new URLSearchParams();
  for (const key of Object.keys(
    serviceQuerySchema.shape,
  ) as (keyof ServiceQuery)[]) {
    const value = q[key];
    if (
      value !== undefined &&
      !(key === "page" && value === 1) &&
      !(key === "limit" && value === 24) &&
      !(key === "sort" && value === "newest")
    )
      out.set(key, String(value));
  }
  return out.toString();
}
export function serviceHref(base: string, q: ServiceQuery) {
  const query = serializeServiceQuery(q);
  return base + (query ? "?" + query : "");
}
export function serviceReturnTarget(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2500 ||
    /[\\#\u0000-\u0020%]/.test(value.split("?")[0])
  )
    return "/services";
  try {
    const u = new URL(value, "https://internal.invalid");
    if (
      u.origin !== "https://internal.invalid" ||
      !value.startsWith("/") ||
      value.startsWith("//") ||
      u.hash ||
      !(
        u.pathname === "/services" ||
        /^\/services\/category\/(?:[a-z]+-)*[a-z]+$/.test(u.pathname)
      )
    )
      return "/services";
    return value;
  } catch {
    return "/services";
  }
}
export const serviceOfferHref = (id: string, returnTo: string) =>
  `/services/offers/${id}?${new URLSearchParams({ returnTo: serviceReturnTarget(returnTo) })}`;
