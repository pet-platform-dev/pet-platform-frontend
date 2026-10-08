export type Breed = {
  id: string;
  speciesId: string;
  name: string;
  nameUk: string | null;
  slug: string;
  breedGroup: string | null;
  origin: string | null;
  temperament: string | null;
  lifeSpan: string | null;
  imageUrl: string | null;
};
export function breedLabel(breed: { name: string; nameUk: string | null }) {
  return breed.nameUk?.trim() || breed.name;
}
