export type Species = { id: string; name: string; slug: "dog" | "cat" };
export const speciesLabel = (slug: string, plural = false) =>
  slug === "dog"
    ? plural
      ? "Собаки"
      : "Собака"
    : slug === "cat"
      ? plural
        ? "Коти"
        : "Кіт"
      : "Невідомий вид";
