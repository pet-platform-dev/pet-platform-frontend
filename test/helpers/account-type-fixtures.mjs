import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(resolve("../pet-platform-backend/package.json"));
require("dotenv").config({
  path: resolve("../pet-platform-backend/.env"),
  quiet: true,
});
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
);
const { PrismaService } =
  await import("../../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const models = [
  "user",
  "authSession",
  "authRefreshToken",
  "pet",
  "listing",
  "listingImage",
  "location",
  "breed",
  "species",
  "sellerProfile",
  "listingUploadSession",
  "listingUploadAsset",
  "favorite",
  "review",
  "matingListing",
];
async function fingerprint(p) {
  const result = {};
  for (const model of models) {
    const rows = (await p[model].findMany())
      .map((r) => JSON.stringify(r))
      .sort();
    result[model] = createHash("sha256")
      .update(JSON.stringify(rows))
      .digest("hex");
  }
  return result;
}
export async function accountTypeFixtures() {
  const prisma = new PrismaService(),
    marker = randomUUID(),
    before = await fingerprint(prisma),
    ids = [];
  const password = "Fixture-password-42";
  async function track(user) {
    assert.ok(user.email.endsWith(marker + "@example.invalid"));
    ids.push(user.id);
  }
  async function domain(id) {
    return {
      profile: await prisma.sellerProfile.findUnique({ where: { userId: id } }),
      pets: await prisma.pet.findMany({ where: { ownerId: id } }),
      listings: await prisma.listing.findMany({ where: { sellerId: id } }),
    };
  }
  async function existing() {
    const user = await prisma.user.create({
      data: {
        email: "onboarding-existing-" + marker + "@example.invalid",
        firstName: "Олександр",
        lastName: "Єпік",
        passwordHash: await require("argon2").hash(password),
      },
    });
    await track(user);
    assert.equal(user.accountType, "SELLER");
    const species = await prisma.species.findFirstOrThrow(),
      location = await prisma.location.findFirstOrThrow({
        where: { isActive: true },
      });
    const pet = await prisma.pet.create({
      data: { ownerId: user.id, speciesId: species.id },
    });
    const listing = await prisma.listing.create({
      data: {
        sellerId: user.id,
        petId: pet.id,
        locationId: location.id,
        title: "Тестове оголошення",
        description: "Phase7A browser fixture",
        type: "FREE",
        status: "ACTIVE",
      },
    });
    await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        phone: "+380501234567",
        telegram: "onboarding_fixture",
        viber: "+380501234568",
        whatsapp: "+380501234569",
      },
    });
    return { user, listing, snapshot: await domain(user.id) };
  }
  return {
    marker,
    password,
    track,
    existing,
    domain,
    async cleanup() {
      try {
        await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
        await prisma.pet.deleteMany({ where: { ownerId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        assert.deepEqual(
          await fingerprint(prisma),
          before,
          "All original domain/session data must remain identical",
        );
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}
