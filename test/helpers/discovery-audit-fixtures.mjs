import { randomUUID } from "node:crypto";

// Scoped local fixtures only; no storage-provider calls or shared reference edits.
export async function discoveryAuditFixtures(
  db,
  { users, breed, catBreed, location, marker, name, hash },
) {
  const owner = users[0],
    breedIds = [],
    listingIds = [],
    matingIds = [];
  const addUser = async (accountType) => {
    const row = await db.user.create({
      data: {
        email: `phase14e-${marker}-${users.length}@example.invalid`,
        passwordHash: hash,
        firstName: "Олександр",
        lastName: "Єпік",
        accountType,
      },
    });
    users.push(row.id);
    return row;
  };
  const viewer = await addUser("SELLER"),
    incomplete = await addUser("BREEDER");
  await db.breederProfile.create({
    data: { userId: viewer.id, kennelName: "PRIVATE_KENNEL_" + marker },
  });
  const profile = await db.breederProfile.update({
    where: { userId: owner },
    data: {
      kennelName: `${name} 00 ${"НаддовгаНазва".repeat(8)}`.slice(0, 160),
      description: "Публічний опис. ".repeat(60),
    },
  });
  await db.breederProfileBreed.create({
    data: { breederProfileId: profile.id, breedId: catBreed.id },
  });
  for (let i = 0; i < 4; i++) {
    const b = await db.breed.create({
      data: {
        speciesId: breed.speciesId,
        name: `Audit${marker}-${i}`,
        nameUk: ("Довганазвапороди".repeat(9) + i).slice(-150),
        slug: `phase14e-${marker}-${i}`,
      },
    });
    breedIds.push(b.id);
    await db.breederProfileBreed.create({
      data: { breederProfileId: profile.id, breedId: b.id },
    });
  }
  for (const [index, url] of [
    [0, "logo"],
    [1, "broken"],
  ]) {
    const p = await db.breederProfile.findUniqueOrThrow({
      where: { userId: users[index] },
    });
    const assetId = randomUUID();
    await db.breederMediaAsset.create({
      data: {
        id: assetId,
        ownerId: users[index],
        breederProfileId: p.id,
        type: "LOGO",
        status: "ATTACHED",
        expiresAt: new Date(),
        publicId: `pet-platform/breeders/${users[index]}/logo/${assetId}`,
      },
    });
    await db.breederMedia.create({
      data: {
        breederProfileId: p.id,
        type: "LOGO",
        assetId,
        url: `https://res.cloudinary.com/fixture/image/upload/phase14e-${url}.png`,
      },
    });
  }
  const pets = [];
  for (const [petName, consent] of [
    ["Публічна Луна", true],
    ["Публічний Рекс", true],
    ["PRIVATE_PET", false],
  ]) {
    pets.push(
      await db.pet.create({
        data: {
          ownerId: owner,
          speciesId: breed.speciesId,
          breedId: breed.id,
          name: petName,
          gender: "MALE",
          showOnBreederProfile: consent,
          healthNotes: "PRIVATE_HEALTH",
        },
      }),
    );
  }
  const assetId = randomUUID();
  await db.petImageAsset.create({
    data: {
      id: assetId,
      ownerId: owner,
      petId: pets[0].id,
      publicId: `pet-platform/pets/${owner}/profile/${assetId}`,
      url: "https://res.cloudinary.com/fixture/image/upload/profile.png",
      status: "ATTACHED",
      expiresAt: new Date(),
    },
  });
  await db.pet.update({
    where: { id: pets[0].id },
    data: { profileImageAssetId: assetId },
  });
  for (const [i, status, moderationStatus] of [
    [0, "ACTIVE", "APPROVED"],
    [1, "DRAFT", "NOT_SUBMITTED"],
    [2, "ACTIVE", "REJECTED"],
    [3, "HIDDEN", "APPROVED"],
    [4, "ARCHIVED", "APPROVED"],
  ]) {
    const pet =
      i === 0
        ? pets[1]
        : await db.pet.create({
            data: {
              ownerId: owner,
              speciesId: breed.speciesId,
              gender: "MALE",
            },
          });
    const listing = await db.listing.create({
      data: {
        sellerId: owner,
        petId: pet.id,
        locationId: location.id,
        type: "SALE",
        title: "Audit offer",
        description: "Опис",
        status,
        moderationStatus,
        price: 1000,
        images: {
          create: {
            url: "https://res.cloudinary.com/fixture/image/upload/listing.png",
          },
        },
      },
    });
    const mating = await db.matingListing.create({
      data: {
        ownerId: owner,
        petId: pet.id,
        locationId: location.id,
        title: "Audit mating",
        description: "Опис",
        status,
        moderationStatus,
        publishedAt: new Date(),
      },
    });
    listingIds.push(listing.id);
    matingIds.push(mating.id);
  }
  return {
    owner,
    viewer,
    incomplete,
    breedIds,
    listingIds,
    matingIds,
    pets,
    kennelName: profile.kennelName,
  };
}

export async function cleanDiscoveryAuditFixtures(db, users) {
  await db.listing.deleteMany({ where: { sellerId: { in: users } } });
  await db.matingListing.deleteMany({ where: { ownerId: { in: users } } });
  await db.pet.deleteMany({ where: { ownerId: { in: users } } });
  await db.petImageAsset.deleteMany({ where: { ownerId: { in: users } } });
}
