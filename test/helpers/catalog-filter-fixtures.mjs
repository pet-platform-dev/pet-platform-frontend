import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const backend = resolve("../pet-platform-backend");
const require = createRequire(resolve(backend, "package.json"));
require("dotenv").config({ path: resolve(backend, ".env"), quiet: true });
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
  "Browser fixtures require a local database",
);
const { PrismaService } =
  await import("../../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { seedListingQueryFixtures, cleanupListingQueryFixtures } =
  await import("../../../pet-platform-backend/test/helpers/listing-query-fixtures.mjs");
const { attachFixtureRegions } =
  await import("../../../pet-platform-backend/test/helpers/listing-region-fixtures.mjs");
const models = [
  "user",
  "pet",
  "listing",
  "listingImage",
  "location",
  "breed",
  "species",
  "sellerProfile",
  "listingUploadSession",
  "listingUploadAsset",
];
async function fingerprint(prisma) {
  const result = {};
  for (const model of models) {
    const rows = (await prisma[model].findMany())
      .map((row) => JSON.stringify(row))
      .sort();
    result[model] = createHash("sha256")
      .update(JSON.stringify(rows))
      .digest("hex");
  }
  return result;
}
/** Test-only setup. Application code never imports database packages. */
export async function catalogFilterFixtures() {
  const prisma = new PrismaService(),
    marker = randomUUID(),
    before = await fingerprint(prisma);
  let fixture;
  try {
    fixture = await seedListingQueryFixtures(prisma, marker);
    await attachFixtureRegions(prisma, fixture);
    for (let index = 0; index < fixture.locations.length; index++) {
      fixture.locations[index] = await prisma.location.update({
        where: { id: fixture.locations[index].id },
        data: { city: "Однакова назва — Велика Олександрівка" },
      });
    }
    const exemplar = fixture.rows.find((row) => row.key === "A");
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < 25; i++) {
          const pet = await tx.pet.create({
            data: {
              ownerId: fixture.owners[0].id,
              speciesId: fixture.dog.id,
              breedId: fixture.breeds[0].id,
              gender: "MALE",
              birthDate: exemplar.pet.birthDate,
            },
          });
          await tx.listing.create({
            data: {
              petId: pet.id,
              sellerId: pet.ownerId,
              locationId: fixture.locations[0].id,
              type: "SALE",
              status: "ACTIVE",
              title: `Каталог ${marker} ${i}`,
              description: `Браузерна перевірка ${marker}`,
              price: "100.01",
              publishedAt: new Date(Date.UTC(2024, 1, 1, 0, i)),
            },
          });
        }
      },
      { timeout: 30000 },
    );
    return {
      fixture,
      marker,
      async cleanup() {
        try {
          await cleanupListingQueryFixtures(prisma, fixture);
          assert.deepEqual(
            await fingerprint(prisma),
            before,
            "Existing database content must remain identical",
          );
        } finally {
          await prisma.$disconnect();
        }
      },
    };
  } catch (error) {
    try {
      await cleanupListingQueryFixtures(prisma, fixture);
    } finally {
      await prisma.$disconnect();
    }
    throw error;
  }
}
