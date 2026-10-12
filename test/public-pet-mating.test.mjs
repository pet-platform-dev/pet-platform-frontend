import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { PublicPetContent } = await load(
  "src/features/pet/public/public-pet-content.tsx",
);
const { PublicPetProfile } = await load(
  "src/features/pet/public/public-pet-profile.tsx",
);
const { ApiError } = await load("src/shared/api/client.ts");
const id = "11111111-1111-4111-8111-111111111111";
const pet = {
  id,
  name: null,
  species: { id, slug: "dog" },
  breed: null,
  gender: "MALE",
  birthDate: null,
  profileImage: null,
  gallery: [],
  videos: [],
  breederSummary: { kennelName: "Розплідник", href: "/sellers/" + id },
  activeListingSummary: null,
};
const html = (activeMatingListing) =>
  renderToStaticMarkup(
    React.createElement(PublicPetContent, {
      pet: { ...pet, activeMatingListing },
    }),
  );
test("public Pet omits mating section without ACTIVE offer", () =>
  assert.doesNotMatch(
    html(null),
    /Для цієї тварини є активне оголошення про в’язку/,
  ));
test("public Pet has a compact ACTIVE CTA with validated Pet return context", () => {
  const s = html({ id });
  assert.match(s, /Для цієї тварини є активне оголошення про в’язку/);
  assert.match(s, /returnTo=%2Fpets%2F/);
  assert.match(s, /Переглянути оголошення/);
});
test("fresh public Pet retains SSR content with production query defaults", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30000 } },
  });
  const data = { ...pet, name: "Рекс", activeMatingListing: { id } };
  try {
    const markup = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(PublicPetProfile, { id, initialData: data }),
      ),
    );
    assert.match(markup, /Рекс/);
    assert.match(markup, /Розплідник/);
    assert.match(markup, /Переглянути оголошення про в’язку/);
    assert.doesNotMatch(markup, /listing-detail-skeleton/);
  } finally {
    client.clear();
  }
});

for (const status of [404, 503]) {
  test(`cached public Pet hides ACTIVE CTA after fresh ${status}`, async () => {
    const data = { ...pet, activeMatingListing: { id } };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    client.setQueryData(["public-pet", id], data);
    let reject;
    const pending = new Promise((_, no) => {
      reject = no;
    });
    const observer = new QueryObserver(client, {
      queryKey: ["public-pet", id],
      queryFn: () => pending,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    function render() {
      // A settled SSR snapshot of the live query state; the observer owns the fetch.
      client.setDefaultOptions({
        queries: { enabled: false, retry: false, gcTime: Infinity },
      });
      return renderToStaticMarkup(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(PublicPetProfile, { id, initialData: data }),
        ),
      );
    }
    try {
      const failed = new Promise((resolve) => {
        const stop = observer.subscribe((result) => {
          if (result.isError) {
            stop();
            resolve();
          }
        });
      });
      reject(new ApiError(status, "Unavailable"));
      await failed;
      const markup = render();
      assert.doesNotMatch(markup, /Переглянути оголошення про в’язку/);
      assert.match(
        markup,
        status === 404 ? /Профіль тварини не знайдено/ : /Спробувати ще раз/,
      );
      assert.deepEqual(client.getQueryData(["public-pet", id]), data);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}
