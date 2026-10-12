// Local browser fixtures only. Existing rows are fingerprinted by the shared helper.
import { breederProfileFixtures } from "./breeder-profile-fixtures.mjs";
import { PrismaService } from "../../../pet-platform-backend/dist/src/prisma/prisma.service.js";
export async function matingFixtures() {
  const base = await breederProfileFixtures({ onboarding: true });
  const p = new PrismaService();
  const owners = [base.seller.user.id, base.full.user.id, base.empty.user.id];
  const cleanup = async () => {
    try {
      await p.matingListing.deleteMany({ where: { ownerId: { in: owners } } });
    } finally {
      await p.$disconnect();
      await base.cleanup();
    }
  };
  try {
    const breed = base.breeds[0];
    const pet = async (name, gender = "MALE", ownerId = owners[0]) =>
      p.pet.create({
        data: {
          ownerId,
          speciesId: breed.speciesId,
          breedId: breed.id,
          name,
          gender,
          birthDate: new Date("2020-01-02"),
        },
      });
    const known = await pet("Рекс"),
      unnamed = await pet(null, "FEMALE"),
      unknown = await pet("Стать не вказана", "UNKNOWN"),
      competing = await pet("Активний пошук"),
      breeder = await pet("Тварина заводчика", "FEMALE", owners[1]);
    const active = await p.matingListing.create({
      data: {
        ownerId: owners[0],
        petId: competing.id,
        locationId: base.location.id,
        title: "Активний пошук",
        description: "Умови обговорюються з власником.",
        status: "ACTIVE",
        publishedAt: new Date(),
        price: null,
      },
    });
    for (const status of ["DRAFT", "CLOSED", "ARCHIVED"])
      await p.matingListing.create({
        data: {
          ownerId: owners[0],
          petId: unnamed.id,
          locationId: base.location.id,
          title: "Стан " + status,
          description: "Стан оголошення.",
          status,
          publishedAt: status === "DRAFT" ? null : new Date(),
        },
      });
    await p.matingListing.createMany({
      data: Array.from({ length: 22 }, (_, n) => ({
        ownerId: owners[0],
        petId: unnamed.id,
        locationId: base.longLocation.id,
        title: "Сторінка " + n,
        description: "Опис ".repeat(900),
        status: "DRAFT",
        price: "1234.56",
      })),
    });
    return {
      ...base,
      known,
      unnamed,
      unknown,
      competing,
      breeder,
      active,
      db: p,
      cleanup,
    };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
