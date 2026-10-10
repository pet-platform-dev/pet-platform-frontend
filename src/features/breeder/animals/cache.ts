import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { ownAnimalsKey, publicAnimalsKey } from "@/entities/breeder/animals";
export async function invalidateBreederAnimals(
  client: QueryClient,
  userId?: string,
) {
  const current = client.getQueryData<User | null>(["current-user"]);
  const id = userId ?? current?.id;
  if (!id || current?.id !== id) return false;
  await Promise.all([
    client.invalidateQueries({ queryKey: ownAnimalsKey(id) }),
    client.invalidateQueries({ queryKey: publicAnimalsKey(id) }),
    client.invalidateQueries({ queryKey: ["my-pets"] }),
  ]);
  return client.getQueryData<User | null>(["current-user"])?.id === id;
}
