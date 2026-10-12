import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { MatingCatalogResults } = await load(
  "src/features/mating/catalog/results.tsx",
);
const { CatalogPagination } = await load(
  "src/widgets/listings-catalog/catalog-pagination.tsx",
);
const query = { page: 1, limit: 24, sort: "newest" };
const render = (result) =>
  renderToStaticMarkup(
    React.createElement(MatingCatalogResults, {
      result,
      query,
      pending: false,
      invalid: false,
      filtered: true,
      onClear() {},
      onPage() {},
    }),
  );
test("public result loading stays semantic, compact error retries and empty state explains filters", () => {
  assert.match(render({ isPending: true }), /Завантажуємо оголошення/);
  assert.match(render({ isError: true, refetch() {} }), /Спробувати ще раз/);
  const empty = render({
    data: { data: [], meta: { page: 1, pages: 0, total: 0, limit: 24 } },
  });
  assert.match(empty, /Оголошень не знайдено/);
  assert.match(empty, /Очистити фільтри/);
});
test("catalog pagination accepts focused URL builder without dropping mating filters", () => {
  const html = renderToStaticMarkup(
    React.createElement(CatalogPagination, {
      page: 1,
      pages: 2,
      sort: "price_asc",
      hrefForPage: (page) => "/mating?feeMode=free&page=" + page,
    }),
  );
  assert.match(html, /href="\/mating\?feeMode=free&amp;page=2"/);
  assert.doesNotMatch(html, /href="\/listings/);
});
