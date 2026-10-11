import { z } from "zod";
import { normalizedVideoUrl } from "@/shared/lib/video-url";
export const PET_MEDIA_LIMITS = { IMAGE: 20, VIDEO: 5 } as const;
const cloudUrl = z
  .url()
  .regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//);
export const petMediaSchema = z.object({
  gallery: z
    .array(
      z.object({
        id: z.uuid(),
        url: cloudUrl,
        displayUrl: cloudUrl,
        thumbnailUrl: cloudUrl,
        position: z.number().int().nonnegative(),
      }),
    )
    .max(PET_MEDIA_LIMITS.IMAGE),
  videos: z
    .array(
      z.object({
        id: z.uuid(),
        url: z.string().refine((url) => normalizedVideoUrl(url) === url),
        position: z.number().int().nonnegative(),
      }),
    )
    .max(PET_MEDIA_LIMITS.VIDEO),
});
export type PetMedia = z.infer<typeof petMediaSchema>;
