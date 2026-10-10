import { useQuery } from "@tanstack/react-query";
import { getOwnBreeder, ownBreederKey } from "@/entities/breeder/owner-api";
export function useOwnBreeder(userId: string) {
  return useQuery({
    queryKey: ownBreederKey(userId),
    queryFn: ({ signal }) => getOwnBreeder(signal),
  });
}
