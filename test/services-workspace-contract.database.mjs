// Explicit cross-repository integration against the marker-guarded S8 database.
import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-frontend.mjs";
const { offerWriteBody } = await load("src/entities/service-provider/api.ts");
const { servicesOfferFixture } =
  await import("../../pet-platform-backend/test/helpers/services-offer-fixture.mjs");
assert.equal(process.env.SERVICES_TEST_PHASE, "s8");
test("S8 adapter PATCH preserves inactive saved references through the real Nest controller", async () => {
  const f = await servicesOfferFixture();
  let locationId;
  try {
    const a = await f.actor(),
      p = await f.create(a),
      places = await f.places(a, p);
    locationId = places.base.location.id;
    const row = await f.offer(a, p, {
      providerLocationIds: [places.base.id],
      speciesIds: [f.species[0].id],
    });
    const value = {
      categoryId: row.categoryId,
      title: "Нова назва зі збереженою локацією",
      description: row.description,
      mode: row.mode,
      price: {
        mode: row.price.mode,
        amount: row.price.amount,
        unit: row.price.unit,
      },
      speciesIds: row.species.map((s) => s.id),
      providerLocationIds: row.locations.map((l) => l.id),
      detailsVersion: 1,
      details: row.details,
    };
    await f.db.location.update({
      where: { id: locationId },
      data: { isActive: false },
    });
    const before = await f.offerCall(a, p, "/" + row.id, "patch", {
      ...value,
      expectedUpdatedAt: row.updatedAt,
    });
    assert.equal(
      before.status,
      400,
      "old full DTO explicitly reselects an inactive location",
    );
    const after = await f.offerCall(
      a,
      p,
      "/" + row.id,
      "patch",
      offerWriteBody(value, row),
    );
    assert.equal(after.status, 200);
    assert.equal(after.body.data.title, value.title);
    assert.equal(after.body.data.locations[0].id, places.base.id);
    assert.equal(after.body.data.locations[0].location.isActive, false);
    const reselected = await f.offerCall(a, p, "/" + row.id, "patch", {
      expectedUpdatedAt: after.body.data.updatedAt,
      providerLocationIds: [places.base.id],
    });
    assert.equal(
      reselected.status,
      400,
      "active-reference validation is preserved",
    );
  } finally {
    if (locationId)
      await f.db.location.update({
        where: { id: locationId },
        data: { isActive: true },
      });
    await f.close();
  }
});
