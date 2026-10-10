import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { saveBreeder, type OwnBreeder } from "@/entities/breeder/owner-api";
import type { BreederInput } from "./validation";
import { updateBreederCache } from "./cache";
export function useBreederSave(userId: string, profile: OwnBreeder | null) {
  const client = useQueryClient(),
    router = useRouter();
  return useMutation({
    retry: false,
    mutationFn: (input: BreederInput) => {
      // Preserve existing inactive relations when they have not been changed.
      const payload: Partial<BreederInput> = { ...input };
      if (
        profile &&
        JSON.stringify([...profile.breedIds].sort()) ===
          JSON.stringify(input.breedIds)
      )
        delete payload.breedIds;
      if (profile && input.locationId === profile.locationId)
        delete payload.locationId;
      return saveBreeder(payload, Boolean(profile));
    },
    onSuccess: async (updated) => {
      if (!(await updateBreederCache(client, userId, updated))) return;
      router.refresh();
      if (!profile) {
        client.setQueryData(
          ["breeder-notice", userId],
          "Профіль заводчика створено.",
        );
        router.push("/sellers/" + userId);
      }
    },
  });
}
