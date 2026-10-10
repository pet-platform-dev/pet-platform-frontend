export const sortLabels = {
  newest: "Спочатку нові",
  oldest: "Спочатку старі",
  price_asc: "Ціна: від нижчої",
  price_desc: "Ціна: від вищої",
};
export async function chooseCatalogSort(page, value) {
  await page.getByRole("combobox", { name: "Сортування", exact: true }).click();
  await page
    .getByRole("option", { name: sortLabels[value], exact: true })
    .click();
}
