"use client";
import { useQuery } from "@tanstack/react-query";
import { getOwnPetChoices } from "@/entities/pet/api/get-own-pet-choices";
import { getActiveMating } from "@/entities/mating-listing/api";
import { matingKeys } from "./cache";
export function useMatingSource(userId: string) {
  const pets = useQuery({
    queryKey: ["my-pets", userId, "mating"],
    queryFn: ({ signal }) => getOwnPetChoices(signal),
  });
  const active = useQuery({
    queryKey: matingKeys.active(userId),
    queryFn: ({ signal }) => getActiveMating(signal),
  });
  return { pets, active };
}
