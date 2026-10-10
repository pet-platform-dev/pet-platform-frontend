import { authenticatedRequest } from "@/shared/api/client";
import { z } from "zod";
const response = z.object({
  id: z.uuid(),
  profileImage: z.object({ url: z.url(), thumbnailUrl: z.url() }).nullable(),
});
export async function savePetPhoto(id: string, file: File | null) {
  const body = file ? new FormData() : undefined;
  if (file) body!.append("file", file);
  return response.parse(
    await authenticatedRequest(
      `/pets/${encodeURIComponent(id)}/profile-image`,
      { method: file ? "POST" : "DELETE", body },
    ),
  );
}
