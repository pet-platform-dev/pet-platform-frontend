"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { authenticatedRequest } from "@/shared/api/client";
import { preparedEnvelope } from "./contracts";

export function usePreparedListings(
  userId: string,
  profileId?: string,
  page = 1,
) {
  const session = useSession();
  return useQuery({
    queryKey: ["breeder-handoffs", userId, "prepared", profileId, page],
    queryFn: async ({ signal }) =>
      preparedEnvelope.parse(
        await authenticatedRequest(
          `/breeder-handoffs/prepared/${profileId}?page=${page}`,
          { signal },
          true,
        ),
      ),
    enabled:
      Boolean(profileId) &&
      session.data?.id === userId &&
      session.data.accountType === "BREEDER" &&
      session.data.verificationStatus === "VERIFIED",
    retry: false,
  });
}
