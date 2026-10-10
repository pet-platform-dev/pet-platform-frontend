import type { Breeder } from "@/entities/breeder/model";
export function BreederProfileBreeds({
  breeds,
}: {
  breeds: Breeder["breeds"];
}) {
  if (!breeds.length) return null;
  return (
    <section className="listing-detail-panel" aria-labelledby="breeder-breeds">
      <h2 id="breeder-breeds">Породи</h2>
      <ul className="breeder-breed-list">
        {breeds.map((breed) => (
          <li key={breed.id}>{breed.nameUk?.trim() || breed.name}</li>
        ))}
      </ul>
    </section>
  );
}
