import type { QueryClient } from "@tanstack/react-query";
import { invalidateListings } from "@/features/listing/manage-listing/api";
import { refreshMating } from "@/features/mating/cache";
import { currentAdmin, adminModerationKeys } from "../moderation/cache";
import { publicAnimalsKey } from "@/entities/breeder/animals";
import type { Content } from "./model";
export async function invalidateContentCaches(
  client: QueryClient,
  actorId: string,
  row: Content,
) {
  if (!currentAdmin(client, actorId)) return;
  const work = [
    client.invalidateQueries({ queryKey: ["admin-dashboard"] }),
    client.invalidateQueries({ queryKey: adminModerationKeys.root }),
  ];
  if (row.source !== "OPERATOR_DRAFT") {
    work.push(
      client.invalidateQueries({ queryKey: ["seller", row.owner.id] }),
      client.invalidateQueries({ queryKey: publicAnimalsKey(row.owner.id) }),
    );
    if (row.source === "LISTING") work.push(invalidateListings(client, row.id));
    else
      work.push(
        refreshMating(client, actorId, undefined, undefined, row.pet.id),
        client.invalidateQueries({
          queryKey: ["mating-owned", row.owner.id, row.id],
        }),
      );
  }
  await Promise.all(work);
}
