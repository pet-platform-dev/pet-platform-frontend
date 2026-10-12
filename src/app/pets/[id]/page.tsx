import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError } from "@/shared/api/client";
import { getPublicPet } from "@/entities/pet/public-profile";
import { petProfileTitle } from "@/features/pet/public/public-pet-content";
import { PublicPetProfile } from "@/features/pet/public/public-pet-profile";
const loadPet = cache(getPublicPet);
export async function generateMetadata({
  params,
}: PageProps<"/pets/[id]">): Promise<Metadata> {
  try {
    const pet = await loadPet((await params).id);
    return {
      title: petProfileTitle(pet) + " — Лапа",
      description:
        pet.description?.slice(0, 160) ??
        "Публічний профіль тварини розплідника.",
    };
  } catch {
    return {
      title: "Профіль тварини — Лапа",
      robots: { index: false, follow: false },
    };
  }
}
export default async function PublicPetPage({
  params,
}: PageProps<"/pets/[id]">) {
  let pet;
  try {
    pet = await loadPet((await params).id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <PublicPetProfile key={pet.id} id={pet.id} initialData={pet} />;
}
