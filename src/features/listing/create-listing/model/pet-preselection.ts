import { z } from "zod";
export function listingPetPreselection(value: unknown): string | undefined {
  return z.uuid().safeParse(value).success ? (value as string) : undefined;
}
