const pattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const cents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
};
export function priceErrors(
  min: string,
  max: string,
): { min?: string; max?: string } {
  const values = [min, max].map((value) => value.trim().replace(",", "."));
  const errors: { min?: string; max?: string } = {};
  values.forEach((value, index) => {
    if (value && !pattern.test(value))
      errors[index === 0 ? "min" : "max"] =
        "Вкажіть невід’ємну суму до 9999999999,99 грн, максимум два десяткові знаки.";
  });
  if (
    !errors.min &&
    !errors.max &&
    values[0] &&
    values[1] &&
    cents(values[0]) > cents(values[1])
  )
    errors.max = "Ціна «До» має бути не меншою за ціну «Від».";
  return errors;
}
export function resultCount(total: number): string {
  const plural = new Intl.PluralRules("uk-UA").select(total);
  const noun =
    plural === "one"
      ? "оголошення"
      : plural === "few"
        ? "оголошення"
        : "оголошень";
  return `Знайдено ${new Intl.NumberFormat("uk-UA").format(total)} ${noun}`;
}
