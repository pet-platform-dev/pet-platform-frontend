export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function imageError(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Формат зображення не підтримується";
  if (!file.size || file.size > MAX_IMAGE_BYTES) return "Файл завеликий";
  return null;
}
export function reorderImages<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return items;
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
