import type { Breeder } from "@/entities/breeder/model";
export function BreederProfileBreeds({
  breeds,
  embedded = false,
}: {
  breeds: Breeder["breeds"];
  embedded?: boolean;
}) {
  if (!breeds.length) return null;
  const list = (
    <ul className="breeder-breed-list" aria-label="Породи розплідника">
      {breeds.map((breed) => (
        <li key={breed.id}>{breed.nameUk?.trim() || breed.name}</li>
      ))}
    </ul>
  );
  if (embedded) return list;
  return (
    <section className="listing-detail-panel" aria-labelledby="breeder-breeds">
      <h2 id="breeder-breeds">Породи</h2>
      {list}
    </section>
  );
}
