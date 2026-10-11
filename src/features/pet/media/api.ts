import { authenticatedRequest } from "@/shared/api/client";
import { petMediaSchema } from "@/entities/pet/media";
const path = (id: string) => "/pets/" + encodeURIComponent(id) + "/media";
export async function getPetMedia(id: string, signal?: AbortSignal) {
  return petMediaSchema.parse(await authenticatedRequest(path(id), { signal }));
}
export async function uploadPetImage(
  id: string,
  file: File,
  signal?: AbortSignal,
) {
  const body = new FormData();
  body.append("file", file);
  return petMediaSchema.parse(
    await authenticatedRequest(path(id) + "/images", {
      method: "POST",
      body,
      signal,
    }),
  );
}
export async function removePetMedia(id: string, mediaId: string) {
  return petMediaSchema.parse(
    await authenticatedRequest(path(id) + "/" + encodeURIComponent(mediaId), {
      method: "DELETE",
    }),
  );
}
export async function reorderPetMedia(
  id: string,
  type: "IMAGE" | "VIDEO",
  ids: string[],
) {
  return petMediaSchema.parse(
    await authenticatedRequest(path(id) + "/reorder", {
      method: "PATCH",
      body: JSON.stringify({ type, ids }),
    }),
  );
}
export async function addPetVideo(id: string, url: string) {
  return petMediaSchema.parse(
    await authenticatedRequest(path(id) + "/videos", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  );
}
