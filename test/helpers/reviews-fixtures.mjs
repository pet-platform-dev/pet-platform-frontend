// Local guarded fixture setup/cleanup only; application code accesses REST.
import { breederProfileFixtures } from "./breeder-profile-fixtures.mjs";
import { PrismaService } from "../../../pet-platform-backend/dist/src/prisma/prisma.service.js";
export async function reviewsFixtures() {
  const base = await breederProfileFixtures(),
    p = new PrismaService(),
    authors = [],
    targets = [
      base.seller.user.id,
      base.full.user.id,
      base.empty.user.id,
      base.fallback.user.id,
    ];
  async function cleanup() {
    try {
      await p.review.deleteMany({ where: { targetUserId: { in: targets } } });
      await base.cleanup();
    } finally {
      await p.$disconnect();
    }
  }
  try {
    for (let i = 0; i < 21; i++) {
      const user = await p.user.create({
        data: {
          email: `reviews-browser-${i}-${base.marker}@example.invalid`,
          passwordHash: "fixture-only",
          firstName: "Марія",
          lastName: "Довгопрізвище",
        },
      });
      base.trackUser(user);
      authors.push(user.id);
      await p.review.create({
        data: {
          authorId: user.id,
          targetUserId: base.seller.user.id,
          rating: i === 0 ? 1 : 5,
          status: "APPROVED",
          text:
            i === 20
              ? "Відповідальний продавець.\n" +
                "Дуже добрий досвід спілкування. ".repeat(55) +
                "a".repeat(100)
              : "Добрий досвід спілкування номер " + i,
          createdAt: new Date(
            `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
          ),
        },
      });
      if (i < 3)
        await p.review.create({
          data: {
            authorId: user.id,
            targetUserId: base.full.user.id,
            rating: i === 1 ? 4 : 5,
            status: "APPROVED",
            text: "Відповідальний розплідник, добре спілкування.",
          },
        });
    }
    await p.review.create({
      data: {
        authorId: base.full.user.id,
        targetUserId: base.seller.user.id,
        rating: 5,
        text: "PRIVATE-PENDING-REVIEW",
        status: "PENDING",
      },
    });
    await p.review.create({
      data: {
        authorId: base.empty.user.id,
        targetUserId: base.seller.user.id,
        rating: 1,
        text: "PRIVATE-HIDDEN-REVIEW",
        status: "HIDDEN",
      },
    });
    await p.review.create({
      data: {
        authorId: base.seller.user.id,
        targetUserId: base.full.user.id,
        rating: 1,
        text: "PRIVATE-REJECTED-REVIEW",
        status: "REJECTED",
      },
    });
    return {
      ...base,
      authors,
      cleanup,
      async ownReview(authorId, targetId) {
        if (!targets.includes(authorId) || !targets.includes(targetId))
          throw Error("Foreign fixture identity");
        return p.review.findUnique({
          where: {
            authorId_targetUserId: { authorId, targetUserId: targetId },
          },
        });
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
