"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useQuery, useQueryClient, skipToken } from "@tanstack/react-query";
export function BreederCreatedNotice({ userId }: { userId: string }) {
  const client = useQueryClient();
  const notice = useQuery<string>({
    queryKey: ["breeder-notice", userId],
    queryFn: skipToken,
  });
  useEffect(
    () => () => {
      client.removeQueries({ queryKey: ["breeder-notice", userId] });
    },
    [client, userId],
  );
  return notice.data ? (
    <p role="status" className="success-banner">
      {notice.data}{" "}
      <Link href="/profile/breeder">Додати медіа та керувати тваринами</Link>
    </p>
  ) : null;
}
