import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import { petCareSchema } from "./model";
export async function getPetCare(id: string, signal?: AbortSignal) {
  const pet = petCareSchema.parse(
    await authenticatedRequest("/pets/" + z.uuid().parse(id) + "/care", {
      signal,
    }),
  );
  if (pet.id !== id) throw Error("Invalid Pet Care identity");
  return pet;
}
