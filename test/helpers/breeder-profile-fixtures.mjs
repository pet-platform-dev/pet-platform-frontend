// Database access is confined to local test setup/cleanup; application code uses REST.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(resolve("../pet-platform-backend/package.json"));
require("dotenv").config({
  path: resolve("../pet-platform-backend/.env"),
  quiet: true,
});
const db = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) &&
    db.pathname === "/pet_platform",
);
const { PrismaService } =
  await import("../../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const models = [
  "user",
  "authSession",
  "authRefreshToken",
  "sellerProfile",
  "breederProfile",
  "breederProfileBreed",
  "breederMedia",
  "breederMediaAsset",
  "pet",
  "petImageAsset",
  "petMedia",
  "listing",
  "listingImage",
  "breed",
  "location",
  "species",
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
export async function breederProfileFixtures({
  onboarding = false,
  animals = false,
  historicalPreview = false,
} = {}) {
  const p = new PrismaService(),
    marker = randomUUID(),
    ids = [],
    locations = [],
    extraBreeds = [];
  const before = await fingerprint(p);
  async function cleanup() {
    try {
      const petAssets = await p.petImageAsset.findMany({
        where: { ownerId: { in: ids } },
      });
      if (petAssets.length) {
        const { CloudinaryService } =
          await import("../../../pet-platform-backend/dist/src/media/cloudinary.service.js");
        const provider = new CloudinaryService();
        for (const asset of petAssets) await provider.destroy(asset.publicId);
        await p.pet.updateMany({
          where: { ownerId: { in: ids } },
          data: { profileImageAssetId: null },
        });
        await p.petMedia.deleteMany({
          where: { pet: { ownerId: { in: ids } } },
        });
        await p.petImageAsset.deleteMany({ where: { ownerId: { in: ids } } });
      }
      const listingAssets = await p.listingUploadAsset.findMany({
        where: { session: { userId: { in: ids } } },
      });
      if (listingAssets.length) {
        const { CloudinaryService } =
          await import("../../../pet-platform-backend/dist/src/media/cloudinary.service.js");
        const provider = new CloudinaryService();
        for (const asset of listingAssets)
          await provider.destroy(asset.publicId);
      }
      const assets = await p.breederMediaAsset.findMany({
        where: { ownerId: { in: ids } },
        select: { id: true },
      });
      if (assets.length) {
        await p.breederMedia.deleteMany({
          where: { breederProfile: { userId: { in: ids } } },
        });
        await p.breederMediaAsset.updateMany({
          where: {
            id: { in: assets.map((asset) => asset.id) },
            status: "ATTACHED",
          },
          data: { status: "DELETE_PENDING", expiresAt: new Date(0) },
        });
        await p.breederMediaAsset.updateMany({
          where: {
            id: { in: assets.map((asset) => asset.id) },
            status: "RESERVED",
          },
          data: {
            status: "DELETE_PENDING",
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        const { CloudinaryService } =
          await import("../../../pet-platform-backend/dist/src/media/cloudinary.service.js");
        const { BreederMediaCleanupService } =
          await import("../../../pet-platform-backend/dist/src/breeders/media/breeder-media-cleanup.service.js");
        await new BreederMediaCleanupService(
          p,
          new CloudinaryService(),
        ).cleanup(
          100,
          assets.map((asset) => asset.id),
        );
        for (let attempt = 0; attempt < 75; attempt++) {
          if (
            !(await p.breederMediaAsset.count({
              where: { ownerId: { in: ids } },
            }))
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await new BreederMediaCleanupService(
            p,
            new CloudinaryService(),
          ).cleanup(
            100,
            assets.map((asset) => asset.id),
          );
        }
        assert.equal(
          await p.breederMediaAsset.count({ where: { ownerId: { in: ids } } }),
          0,
          "Fixture provider cleanup must succeed before removing ownership metadata",
        );
      }
      await p.listing.deleteMany({ where: { sellerId: { in: ids } } });
      await p.listingUploadAsset.deleteMany({
        where: { session: { userId: { in: ids } } },
      });
      await p.listingUploadSession.deleteMany({
        where: { userId: { in: ids } },
      });
      await p.pet.deleteMany({ where: { ownerId: { in: ids } } });
      const fixtureSessionIds = (
        await p.authSession.findMany({
          where: { userId: { in: ids } },
          select: { id: true },
        })
      ).map((row) => row.id);
      await p.user.deleteMany({ where: { id: { in: ids } } });
      assert.equal(
        await p.authSession.count({ where: { id: { in: fixtureSessionIds } } }),
        0,
      );
      assert.equal(
        await p.authRefreshToken.count({
          where: { sessionId: { in: fixtureSessionIds } },
        }),
        0,
      );
      await p.location.deleteMany({ where: { id: { in: locations } } });
      await p.breed.deleteMany({ where: { id: { in: extraBreeds } } });
      const after = await fingerprint(p);
      // Other open local clients may legitimately rotate their refresh tokens during browser checks.
      // Fixture sessions/tokens are asserted above; every stable model still has strict preservation.
      const { authRefreshToken: beforeTokens, ...stableBefore } = before;
      const { authRefreshToken: afterTokens, ...stableAfter } = after;
      assert.deepEqual(
        stableAfter,
        stableBefore,
        "Original stable model fingerprints must remain identical",
      );
      if (beforeTokens !== afterTokens)
        console.log(
          "INFO Unrelated live refresh tokens rotated; fixture auth resources are fully removed and stable model hashes match.",
        );
    } finally {
      await p.$disconnect();
    }
  }
  try {
    const breeds = await Promise.all(
      ["dog", "cat"].map((slug) =>
        p.breed.findFirstOrThrow({
          where: { isActive: true, species: { slug } },
          orderBy: { id: "asc" },
        }),
      ),
    );
    if (animals) {
      const breed = await p.breed.create({
        data: {
          speciesId: breeds[0].speciesId,
          name: "Long breeder breed " + marker,
          nameUk:
            "Бельгійська вівчарка малінуа з довгою тестовою назвою породи",
          slug: marker,
          source: "MANUAL",
        },
      });
      extraBreeds.push(breed.id);
      breeds[0] = breed;
    }
    const location = await p.location.create({
      data: {
        region: "Кіровоградська область",
        city: "Світловодськ",
        slug: marker,
      },
    });
    locations.push(location.id);
    const longLocation = await p.location.create({
      data: {
        region: "Довга назва області ".repeat(8).slice(0, 145),
        city: "Довга назва населеного пункту ".repeat(7).slice(0, 145),
        slug: marker + "-long",
      },
    });
    locations.push(longLocation.id);
    const result = {};
    for (const label of ["seller", "full", "fallback", "empty"]) {
      const user = await p.user.create({
        data: {
          email: "breeder-browser-" + label + "-" + marker + "@example.invalid",
          passwordHash: await require("argon2").hash("Fixture-password-42"),
          firstName: "Олександр",
          lastName: "Єпік",
          accountType: label === "seller" ? "SELLER" : "BREEDER",
        },
      });
      ids.push(user.id);
      result[label] = { user, listings: [] };
    }
    await p.sellerProfile.create({
      data: {
        userId: result.full.user.id,
        phone: "+380501234567",
        telegram: "breeder_fixture",
        viber: "+380501234568",
        whatsapp: "+380501234569",
      },
    });
    if (!onboarding)
      await p.breederProfile.create({
        data: {
          userId: result.full.user.id,
          kennelName: "Royal Malinois",
          description:
            "Розплідник собак і котів.\nЗ турботою про кожну тварину.",
          locationId: location.id,
          startedYear: 2018,
          website: "https://example.com/",
          breeds: { create: breeds.map((b) => ({ breedId: b.id })) },
        },
      });
    await p.breederProfile.create({
      data: { userId: result.empty.user.id, kennelName: "Тихий розплідник" },
    });
    for (const label of ["seller", "full"]) {
      const statuses =
        label === "seller"
          ? ["ACTIVE"]
          : animals
            ? ["ACTIVE", "SOLD", "ACTIVE"]
            : [
                ...Array(25).fill("ACTIVE"),
                "DRAFT",
                "ARCHIVED",
                "SOLD",
                "TRANSFERRED",
                "ADOPTED",
                "PENDING",
                "REJECTED",
                "HIDDEN",
              ];
      for (const [index, status] of statuses.entries()) {
        const breed = breeds[index % 2],
          pet = await p.pet.create({
            data: {
              ownerId: result[label].user.id,
              speciesId: breed.speciesId,
              breedId: breed.id,
              ...(animals && label === "full"
                ? {
                    name:
                      index === 0 ? "Rex" : index === 1 ? null : "PRIVATE-C",
                    gender: index === 0 ? "MALE" : "FEMALE",
                    birthDate: new Date(
                      index === 0 ? "2022-10-01" : "2023-10-01",
                    ),
                  }
                : {}),
            },
          });
        const listing = await p.listing.create({
          data: {
            sellerId: result[label].user.id,
            petId: pet.id,
            locationId: location.id,
            title: "Тестове оголошення " + index,
            description: "Phase 7C fixture",
            type:
              status === "SOLD"
                ? "SALE"
                : status === "ADOPTED"
                  ? "ADOPTION"
                  : "FREE",
            price: status === "SOLD" ? "100.00" : null,
            status,
            publishedAt:
              status === "ACTIVE" ? new Date("2026-10-10T10:00:00Z") : null,
            closedAt: ["SOLD", "TRANSFERRED", "ADOPTED"].includes(status)
              ? new Date("2026-10-10T12:00:00Z")
              : null,
          },
        });
        result[label].listings.push(listing);
      }
    }
    if (animals) {
      if (!historicalPreview)
        await p.listing.delete({ where: { id: result.full.listings[1].id } });
      else
        await p.listingImage.create({
          data: {
            listingId: result.full.listings[1].id,
            url: "https://example.invalid/historical-private.png",
            position: 0,
          },
        });
      await p.listingImage.create({
        data: {
          listingId: result.full.listings[0].id,
          url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
          position: 0,
        },
      });
    }
    return {
      ...result,
      breeds,
      longLocation,
      location,
      domainSnapshot: async () => ({
        user: await p.user.findUnique({
          where: { id: result.full.user.id },
          select: {
            id: true,
            accountType: true,
            firstName: true,
            lastName: true,
          },
        }),
        contacts: await p.sellerProfile.findUnique({
          where: { userId: result.full.user.id },
        }),
        pets: await p.pet.findMany({
          where: { ownerId: result.full.user.id },
          orderBy: { id: "asc" },
        }),
        listings: await p.listing.findMany({
          where: { sellerId: result.full.user.id },
          orderBy: { id: "asc" },
        }),
      }),
      password: "Fixture-password-42",
      marker,
      trackUser(user) {
        assert.ok(user.email.endsWith(marker + "@example.invalid"));
        assert.ok(!ids.includes(user.id));
        ids.push(user.id);
      },
      trackedDomain: async (userId) => {
        assert.ok(ids.includes(userId));
        return {
          user: await p.user.findUnique({
            where: { id: userId },
            select: { id: true, accountType: true, role: true },
          }),
          pets: await p.pet.findMany({
            where: { ownerId: userId },
            select: { id: true, showOnBreederProfile: true },
          }),
          listings: await p.listing.findMany({
            where: { sellerId: userId },
            select: { id: true, status: true },
          }),
          legacyBreederRoleCount: await p.user.count({
            where: { role: "BREEDER" },
          }),
        };
      },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
