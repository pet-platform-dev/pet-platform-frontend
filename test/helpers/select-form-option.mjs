export async function selectFormOption(page, label, choice) {
  const input = page.getByRole("combobox", { name: label, exact: true });
  await input.click();
  const list = page.getByRole("listbox", { name: label, exact: true });
  const options = list.getByRole("option");
  if (typeof choice === "string")
    await list.locator(`[role="option"][data-value="${choice}"]`).click();
  else if ("label" in choice)
    await options.filter({ hasText: choice.label }).click();
  else await options.nth(choice.index).click();
}
