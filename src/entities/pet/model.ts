import type { Species } from "@/entities/species/model";
export type Pet = {
  profileImage?: { url: string; thumbnailUrl: string } | null;
  showOnBreederProfile?: boolean;
  id: string;
  previewImage?: { thumbnailUrl: string } | null;
  name: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  color: string | null;
  description: string | null;
  specialTraits?: string | null;
  chipNumber: string | null;
  hasPassport: boolean;
  hasPedigree: boolean;
  vaccinated: boolean;
  species: Species;
  breed: {
    id: string;
    name: string;
    nameUk: string | null;
    slug: string;
    isActive: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
};
export const genderLabel = {
  MALE: "Самець",
  FEMALE: "Самка",
  UNKNOWN: "Не вказано",
};
export type PetInput = {
  specialTraits?: string | null;
  name: string | null;
  speciesId: string;
  breedId: string | null;
  gender: Pet["gender"];
  birthDate: string | null;
  color: string | null;
  description: string | null;
  chipNumber: string | null;
  hasPassport: boolean;
  hasPedigree: boolean;
  vaccinated: boolean;
};
