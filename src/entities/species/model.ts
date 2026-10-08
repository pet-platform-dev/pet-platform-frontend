export type Species = { id: string; name: string; slug: "dog" | "cat" };
export const speciesLabel = (slug: string) =>
  slug === "dog" ? "Собака" : slug === "cat" ? "Кіт" : "Невідомий вид";
