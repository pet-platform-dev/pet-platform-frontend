import { z } from "zod";
export function resolveOwnedMatingPetId(
  value: string | string[] | undefined,
  pets: readonly { id: string }[],
) {
  if (typeof value !== "string" || !z.uuid().safeParse(value).success)
    return undefined;
  return pets.find((pet) => pet.id.toLowerCase() === value.toLowerCase())?.id;
}
