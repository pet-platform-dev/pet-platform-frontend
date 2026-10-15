/** Input normalization only; domain bounds and required validation stay in schemas. */
export function numericInput(value: string, decimal = false): string {
  if (!decimal) return value.replace(/[^0-9]/g, "");
  const clean = value.replace(/[^0-9.,]/g, ""),
    index = clean.search(/[.,]/);
  if (index < 0) return clean;
  return (
    clean.slice(0, index) +
    clean[index] +
    clean
      .slice(index + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2)
  );
}
