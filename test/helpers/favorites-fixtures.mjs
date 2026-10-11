// Only guarded local browser fixture setup/cleanup accesses PostgreSQL.
import { breederProfileFixtures } from "./breeder-profile-fixtures.mjs";
import { PrismaService } from "../../../pet-platform-backend/dist/src/prisma/prisma.service.js";
export async function favoritesFixtures() {
  const base = await breederProfileFixtures(),
    p = new PrismaService(),
    listings = [];
  try {
    const species = await p.species.findUniqueOrThrow({
      where: { slug: "dog" },
    });
    for (let index = 0; index < 27; index++) {
      const pet = await p.pet.create({
        data: { ownerId: base.seller.user.id, speciesId: species.id },
      });
      listings.push(
        await p.listing.create({
          data: {
            sellerId: base.seller.user.id,
            petId: pet.id,
            locationId: base.location.id,
            title: `Обране ${base.marker} ${index}`,
            description: "Ізольоване оголошення для перевірки обраного",
            status: "ACTIVE",
            type: "SALE",
            price: "100.00",
            publishedAt: new Date(),
            images: {
              create: {
                url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
                position: 0,
              },
            },
          },
        }),
      );
    }
    return {
      ...base,
      listings,
      async closeListing(id) {
        if (!listings.some((row) => row.id === id))
          throw Error("Foreign fixture listing");
        await p.listing.update({
          where: { id },
          data: { status: "SOLD", closedAt: new Date() },
        });
      },
      async clearFavorites() {
        await p.favorite.deleteMany({ where: { userId: base.seller.user.id } });
      },
      async countFavorites() {
        return p.favorite.count({ where: { userId: base.seller.user.id } });
      },
      async cleanup() {
        try {
          await base.cleanup();
        } finally {
          await p.$disconnect();
        }
      },
    };
  } catch (error) {
    await base.cleanup();
    await p.$disconnect();
    throw error;
  }
}
