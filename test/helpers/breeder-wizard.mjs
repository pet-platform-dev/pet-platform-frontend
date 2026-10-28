export async function finishSkippedBreederWizard(page) {
  await page.waitForURL(
    (url) =>
      url.pathname === "/admin/breeders/new" &&
      url.searchParams.get("step") === "2",
  );
  for (let step = 2; step <= 6; step++) {
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    await page.waitForURL(
      (url) => url.searchParams.get("step") === String(step + 1),
    );
  }
  await page
    .getByRole("button", { name: "Завершити створення", exact: true })
    .click();
  await page.waitForURL(/\/admin\/breeders\/[0-9a-f-]{36}/);
}
