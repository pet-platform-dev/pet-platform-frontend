import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { PersonalProfile, personalIdentitySchema } = await load(
  "src/features/auth/personal-profile.tsx",
);
const { petPhotoError, PetPhotoField } = await load(
  "src/features/pet/pet-photo-field.tsx",
);
const { BreederAnimalsEntry } = await load(
  "src/features/breeder/editor/breeder-animals-entry.tsx",
);
const { SelectDropdown } = await load("src/shared/ui/select-dropdown.tsx");
const { refreshPersonalIdentity } = await load(
  "src/features/auth/personal-profile-cache.ts",
);
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  user = { id, firstName: "Марія", lastName: "Єпік" };
const render = (Component, props, seed = () => {}) => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], user);
  seed(c);
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
  c.clear();
  return html;
};
test("visible breeder animal card routes owners or empty owners correctly", () => {
  for (const total of [0, 3]) {
    const html = render(BreederAnimalsEntry, { userId: id }, (c) =>
      c.setQueryData(["breeder-animals", id, { page: 1 }], {
        data: [],
        meta: { total },
      }),
    );
    assert.ok(html.includes("Тварини розплідника"));
    assert.ok(html.includes("Оберіть, яких ваших тварин"));
    assert.ok(html.includes(total ? "/profile/breeder/animals" : "/pets/new"));
  }
});
test("one optional Pet photo exposes styled upload/replace/remove, no native file text", () => {
  const empty = render(PetPhotoField, {
    value: undefined,
    disabled: false,
    onChange() {},
  });
  assert.ok(empty.includes("Фото тварини"));
  assert.ok(empty.includes("Додати фото тварини"));
  assert.ok(!empty.includes("Choose File"));
  const own = render(PetPhotoField, {
    current: { url: "https://example.invalid/pet.png" },
    value: undefined,
    disabled: false,
    onChange() {},
  });
  assert.ok(own.includes("Замінити фото тварини"));
  assert.ok(own.includes("Видалити фото тварини"));
  assert.ok(own.includes('alt="Фото тварини"'));
});
test("photo selection validates shared size and MIME limits", () => {
  assert.equal(petPhotoError({ type: "image/png", size: 10 }), null);
  assert.ok(petPhotoError({ type: "image/svg+xml", size: 10 }));
  assert.ok(petPhotoError({ type: "image/png", size: 8 * 1024 * 1024 + 1 }));
});
test("personal identity editor is explicit, full surname retained and strict validation", () => {
  const html = render(PersonalProfile, { user });
  assert.ok(html.includes("Марія"));
  assert.ok(html.includes("Єпік"));
  assert.ok(html.includes("Редагувати особисті дані"));
  assert.deepEqual(
    personalIdentitySchema.parse({ firstName: " Марія ", lastName: " Єпік " }),
    { firstName: "Марія", lastName: "Єпік" },
  );
  for (const input of [
    { firstName: "", lastName: "Є" },
    { firstName: "М", lastName: "Є".repeat(101) },
    { firstName: "М", lastName: "Є", email: "new@example.invalid" },
  ])
    assert.equal(personalIdentitySchema.safeParse(input).success, false);
});
test("custom select has combobox/SVG/disabled semantics and no native select", () => {
  const html = render(SelectDropdown, {
    label: "Стать",
    value: "MALE",
    options: [{ value: "MALE", label: "Самець" }],
    disabled: true,
    onChange() {},
  });
  assert.ok(html.includes('role="combobox"'));
  assert.ok(html.includes('aria-haspopup="listbox"'));
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes("<svg"));
  assert.ok(!html.includes("<select"));
});
test("identity propagation targets matching owner and ignores late foreign sessions", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], user);
  for (const key of [
    ["seller", id],
    ["seller", other],
    ["breeder", id],
    ["own-breeder", id],
    ["listing", "own"],
    ["listing", "foreign"],
  ])
    c.setQueryData(key, { seller: { id: key[1] === "foreign" ? other : id } });
  assert.equal(await refreshPersonalIdentity(c, id), true);
  assert.equal(c.getQueryState(["seller", id]).isInvalidated, true);
  assert.equal(c.getQueryState(["seller", other]).isInvalidated, false);
  assert.equal(c.getQueryState(["listing", "foreign"]).isInvalidated, false);
  c.setQueryData(["current-user"], { id: other });
  assert.equal(await refreshPersonalIdentity(c, id), false);
  c.clear();
});
