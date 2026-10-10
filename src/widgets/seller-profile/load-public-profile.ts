import { cache } from "react";
import { getSeller } from "@/entities/seller/api";
import { getBreeder } from "@/entities/breeder/api";
import { ApiError } from "@/shared/api/client";
export const loadPublicProfile = cache(async (id: string) => {
  const seller = await getSeller(id);
  if (!seller.breeder) return { seller, breeder: null };
  try {
    return { seller, breeder: await getBreeder(id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return { seller, breeder: null };
    throw error;
  }
});
