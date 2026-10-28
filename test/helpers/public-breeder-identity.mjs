import assert from "node:assert/strict";
export async function validatePublicBreederIdentity({
  page,
  context,
  fixture,
  owner,
  admin,
  profile,
  listings,
  base,
  out,
  width,
  check,
}) {
  const token = await fixture.access(owner),
    staff = await fixture.access(admin);
  const headers = (access) => ({
    Origin: new URL(base).origin,
    Authorization: `Bearer ${access}`,
    "X-CSRF-Token": "s".repeat(43),
    Cookie: "pet_csrf=" + "s".repeat(43),
  });
  const api = async (method, path, data, access = token) => {
    const response = await context.request.fetch(
      "http://localhost:4018/api/v1" + path,
      { method, headers: headers(access), ...(data ? { data } : {}) },
    );
    assert(
      response.ok(),
      `${method} ${path}: ${response.status()} ${await response.text()}`,
    );
    return response.json();
  };
  assert(listings.every((l) => l.breederProfileId === profile.id));
  const hiddenProfile = await context.request.get(
    "http://localhost:4018/api/v1/breeders/" + owner.id,
  );
  assert.equal(hiddenProfile.status(), 404);
  const hiddenHtml = await context.request.get(base + "/sellers/" + owner.id);
  assert(!(await hiddenHtml.text()).includes(profile.kennelName));
  await page.goto(base + "/account");
  await page
    .getByText(
      "Розплідник ще не опубліковано. Перегляньте та опублікуйте його в редакторі.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Переглянути розплідник", exact: true })
      .count(),
    0,
  );
  await page.goto(base + "/profile/breeder");
  await page
    .getByRole("button", {
      name: "Опублікувати перевірений мною профіль",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Отриманий профіль приватний", exact: true })
    .waitFor({ state: "hidden" });
  for (const l of listings.slice(0, 2)) {
    let row = (await api("GET", "/listings/" + l.id)).data;
    if (row.moderationStatus !== "PENDING")
      row = (await api("POST", `/listings/${l.id}/submit`, {})).data;
    await api(
      "POST",
      `/admin/moderation/listings/${l.id}/approve`,
      { expectedUpdatedAt: row.updatedAt },
      staff,
    );
  }
  const original = await fixture.db.listing.findUniqueOrThrow({
    where: { id: listings[0].id },
    include: { pet: true },
  });
  const personal = (
    await api("POST", "/listings/with-pet", {
      pet: {
        speciesId: original.pet.speciesId,
        gender: "MALE",
        name: "Особиста тварина",
      },
      type: "FREE",
      title: "Особисте оголошення",
      description: "Синтетична особиста тварина, окремо від розплідника",
      locationId: original.locationId,
    })
  ).data;
  await fixture.db.listingImage.create({
    data: {
      listingId: personal.id,
      position: 0,
      url: "https://res.cloudinary.com/synthetic/image/upload/personal.png",
    },
  });
  const submitted = (await api("POST", `/listings/${personal.id}/submit`, {}))
    .data;
  await api(
    "POST",
    `/admin/moderation/listings/${personal.id}/approve`,
    { expectedUpdatedAt: submitted.updatedAt },
    staff,
  );
  const rows = await api(
    "GET",
    `/sellers/${owner.id}/listings?page=1&limit=24&sort=newest`,
  );
  assert.deepEqual(
    rows.data.map((v) => v.id).sort(),
    listings
      .slice(0, 2)
      .map((v) => v.id)
      .sort(),
  );
  // Guest navigation and full reloads exercise the real server read model as well as hydration.
  await context.clearCookies();
  await page.goto(base + "/listings?sort=newest");
  for (const l of listings.slice(0, 2)) {
    const card = page
      .locator(".listing-card")
      .filter({ has: page.locator(`a[href^="/listings/${l.id}"]`) });
    await card
      .locator(".breeder-seller-identity")
      .getByText(profile.kennelName, { exact: true })
      .waitFor();
    await card.locator(".breeder-seller-identity img").waitFor();
    assert.equal(await card.locator(".breeder-seller-identity img").count(), 1);
  }
  await check();
  await page.screenshot({
    path: `${out}/public-catalog-${width}.png`,
    fullPage: true,
  });
  for (const l of listings.slice(0, 2)) {
    await page.goto(base + "/listings/" + l.id);
    await page.reload();
    const seller = page.locator(".listing-seller-panel");
    await seller.getByText(profile.kennelName, { exact: true }).waitFor();
    await seller.locator(".breeder-seller-identity img").waitFor();
    assert.equal(
      await seller.locator(".breeder-seller-identity img").count(),
      1,
    );
    await check();
  }
  await page
    .getByRole("link", { name: "Переглянути профіль", exact: true })
    .click();
  await page.waitForURL(`**/sellers/${owner.id}`);
  await page.reload();
  await page
    .getByRole("heading", { name: profile.kennelName, exact: true })
    .waitFor();
  await page.locator(".breeder-cover img").waitFor();
  assert.equal(await page.locator(".breeder-cover img").count(), 1);
  assert.equal(await page.locator(".breeder-logo").count(), 1);
  await page.getByRole("heading", { name: "Відео", exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Фотогалерея", exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator(".breeder-public-gallery .listing-gallery-thumbnails button")
      .count(),
    3,
  );
  assert.equal(
    await page
      .locator(
        'a[href="https://www.youtube.com/watch?v=abcdefghijk"], a[href="https://youtu.be/abcdefghijk"]',
      )
      .count(),
    1,
  );
  await page.locator(".seller-profile-listings .listing-card").nth(1).waitFor();
  assert.equal(
    await page.locator(".seller-profile-listings .listing-card").count(),
    2,
  );
  assert.equal(
    await page
      .locator(`.seller-profile-listings a[href^="/listings/${personal.id}"]`)
      .count(),
    0,
  );
  await check();
  await page.screenshot({
    path: `${out}/public-profile-${width}.png`,
    fullPage: true,
  });
  // Real SSR HTML must contain the breeder presentation, not just a later browser fetch.
  const html = await context.request.get(base + "/sellers/" + owner.id);
  assert(html.ok());
  assert((await html.text()).includes("<h1>" + profile.kennelName + "</h1>"));
  await page.goto(base + "/listings/" + personal.id);
  await page.reload();
  await page
    .locator(".listing-seller-panel")
    .getByText([owner.firstName, owner.lastName].filter(Boolean).join(" "), {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .locator(".listing-seller-panel .breeder-seller-identity")
      .count(),
    0,
  );
  await check();
  await fixture.login(context, owner);
  await page.goto(base + "/account");
  await page
    .getByRole("link", { name: "Переглянути розплідник", exact: true })
    .waitFor();
}
