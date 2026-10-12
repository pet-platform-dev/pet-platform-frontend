import { matingFixtures } from "./mating-fixtures.mjs";
import { writeFile } from "node:fs/promises";
export async function matingCatalogFixtures() {
  const f = await matingFixtures();
  try {
    await writeFile(
      "test-results/phase9c-fixture-record.json",
      JSON.stringify(
        {
          marker: f.marker,
          userIds: [
            f.seller.user.id,
            f.full.user.id,
            f.fallback.user.id,
            f.empty.user.id,
          ],
          locationIds: [f.location.id, f.longLocation.id],
        },
        null,
        2,
      ),
    );
    const dog =
      (await f.db.breed.findFirst({
        where: {
          isActive: true,
          species: { slug: "dog" },
          name: { contains: "Malinois", mode: "insensitive" },
        },
      })) ?? f.breeds[0];
    const rows = [];
    for (let n = 0; n < 28; n++) {
      const breed = n === 27 ? f.breeds[1] : dog,
        ownerId = n === 27 ? f.empty.user.id : f.seller.user.id;
      const pet = await f.db.pet.create({
        data: {
          ownerId,
          speciesId: breed.speciesId,
          breedId: breed.id,
          name: n % 2 ? "Лада" : null,
          gender: n % 2 ? "FEMALE" : "MALE",
          birthDate: new Date("2024-10-01"),
        },
      });
      rows.push(
        await f.db.matingListing.create({
          data: {
            ownerId,
            petId: pet.id,
            locationId: n === 26 ? f.location.id : f.longLocation.id,
            title: "Публічний каталог " + n,
            description: "Умови обговорюються з власником.",
            status: "ACTIVE",
            moderationStatus: "APPROVED",
            price: n % 3 === 0 ? null : n % 3 === 1 ? "0" : "1234.56",
            createdAt: new Date(Date.now() - n * 1000),
            publishedAt: new Date(),
          },
        }),
      );
    }
    return { ...f, rows, dog };
  } catch (e) {
    await f.cleanup();
    throw e;
  }
}
