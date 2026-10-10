import { z } from "zod";
import { normalizedVideoUrl } from "./video-url";
export const BREEDER_MEDIA_LIMITS = {
  LOGO: 1,
  COVER: 1,
  IMAGE: 20,
  VIDEO: 5,
} as const;
const cloudUrl = z
  .url()
  .regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//);
const image = z.object({
  id: z.uuid(),
  type: z.enum(["LOGO", "COVER", "IMAGE"]),
  url: cloudUrl,
  thumbnailUrl: cloudUrl,
  position: z.number().int().nonnegative(),
});
export const videoSchema = z.object({
  id: z.uuid(),
  type: z.literal("VIDEO"),
  url: z.string().refine((url) => normalizedVideoUrl(url) === url),
  position: z.number().int().nonnegative(),
});
export const breederMediaSchema = z.object({
  logo: image.extend({ type: z.literal("LOGO") }).nullable(),
  cover: image.extend({ type: z.literal("COVER") }).nullable(),
  gallery: z
    .array(image.extend({ type: z.literal("IMAGE") }))
    .max(BREEDER_MEDIA_LIMITS.IMAGE),
  videos: z.array(videoSchema).max(BREEDER_MEDIA_LIMITS.VIDEO),
});
export const emptyBreederMedia = {
  logo: null,
  cover: null,
  gallery: [],
  videos: [],
};
export type BreederMedia = z.infer<typeof breederMediaSchema>;
export type BreederImage = z.infer<typeof image>;
export type BreederVideo = z.infer<typeof videoSchema>;
export function breederImageUrl(url: string, width: number) {
  return url.replace(
    "/image/upload/",
    "/image/upload/f_auto,q_auto,c_limit,w_" + width + "/",
  );
}
