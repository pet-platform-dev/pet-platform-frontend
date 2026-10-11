import { z } from "zod";
export function normalizedVideoUrl(value: string): string | null {
  if (/[\s\\]/.test(value) || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const path = url.pathname;
    let id: string | null = null;
    if (url.hostname === "youtu.be" && /^\/[\w-]{11}$/.test(path))
      id = path.slice(1);
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    ) {
      if (path === "/watch") id = url.searchParams.get("v");
      else if (/^\/(shorts|embed)\/[\w-]{11}$/.test(path))
        id = path.split("/")[2];
    }
    if (id && /^[\w-]{11}$/.test(id))
      return "https://www.youtube.com/watch?v=" + id;
    if (
      ["vimeo.com", "www.vimeo.com"].includes(url.hostname) &&
      /^\/[1-9]\d{0,11}$/.test(path) &&
      !url.searchParams.has("h")
    )
      return "https://vimeo.com" + path;
  } catch {
    /* invalid input */
  }
  return null;
}
export const videoUrlSchema = z.strictObject({
  url: z
    .string()
    .trim()
    .refine(
      (value) => Boolean(normalizedVideoUrl(value)),
      "Вкажіть HTTPS-посилання на публічне відео YouTube або Vimeo",
    )
    .transform((value) => normalizedVideoUrl(value)!),
});

export function videoEmbedUrl(value: string) {
  const safe = normalizedVideoUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.hostname === "vimeo.com"
    ? "https://player.vimeo.com/video" + url.pathname + "?autoplay=0&dnt=1"
    : "https://www.youtube-nocookie.com/embed/" +
        url.searchParams.get("v") +
        "?autoplay=0&controls=1";
}
