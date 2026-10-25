import { authenticatedRequest } from "@/shared/api/client";
import { ownBreederSchema } from "@/entities/breeder/owner-api";
export async function uploadBreederImage(
  type: "LOGO" | "COVER" | "IMAGE",
  file: File,
  signal: AbortSignal,
) {
  const body = new FormData();
  body.append("file", file);
  return ownBreederSchema.parse(
    await authenticatedRequest("/breeders/me/media/images/" + type, {
      method: "POST",
      body,
      signal,
    }),
  );
}
export async function removeBreederMedia(id: string) {
  return ownBreederSchema.parse(
    await authenticatedRequest("/breeders/me/media/" + encodeURIComponent(id), {
      method: "DELETE",
    }),
  );
}
export async function reorderBreederMedia(
  type: "IMAGE" | "VIDEO",
  ids: string[],
) {
  return ownBreederSchema.parse(
    await authenticatedRequest("/breeders/me/media/reorder", {
      method: "PATCH",
      body: JSON.stringify({ type, ids }),
    }),
  );
}
export async function addBreederVideo(url: string) {
  return ownBreederSchema.parse(
    await authenticatedRequest("/breeders/me/media/videos", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  );
}

export async function updateBreederVideo(id: string, url: string) {
  return ownBreederSchema.parse(
    await authenticatedRequest(
      "/breeders/me/media/videos/" + encodeURIComponent(id),
      { method: "PATCH", body: JSON.stringify({ url }) },
    ),
  );
}
