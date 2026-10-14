"use client";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Listing } from "@/entities/listing/model/listing";
import { useSession } from "@/features/auth/session-provider";
import { favoriteLoginHref } from "@/features/favorites/login-return";
import {
  conversationKeys,
  currentConversationUser,
  refreshConversations,
} from "./cache";
import { startConversation } from "./api";
import { conversationHref, canMessageListing } from "./model";
import { FirstMessageDialog } from "./first-message-dialog";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function ListingMessageButton({ listing }: { listing: Listing }) {
  const session = useSession();
  // Session restoration can finish before this streamed public section hydrates.
  // Keep its server/initial client markup identical; evaluate private action afterward.
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (
    !hydrated ||
    !canMessageListing(listing.status, session.data?.id, listing.seller.id) ||
    !session.isSuccess
  )
    return null;
  if (!session.data)
    return (
      <Link
        className="button secondary"
        href={favoriteLoginHref("/listings/" + listing.id)}
      >
        Написати продавцю
      </Link>
    );
  return (
    <FirstMessageAction
      key={session.data.id + listing.id}
      userId={session.data.id}
      listing={listing}
    />
  );
}
function FirstMessageAction({
  userId,
  listing,
}: {
  userId: string;
  listing: Listing;
}) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null),
    client = useQueryClient(),
    router = useRouter();
  const mutation = useMutation({
    mutationKey: conversationKeys.root(userId),
    retry: false,
    mutationFn: async (text: string) => {
      if (!currentConversationUser(client, userId))
        throw new DOMException("Session changed", "AbortError");
      const c = await startConversation(listing.id, text);
      if (!currentConversationUser(client, userId))
        throw new DOMException("Session changed", "AbortError");
      return c;
    },
    onSuccess: (c) => {
      if (!currentConversationUser(client, userId)) return;
      setOpen(false);
      void refreshConversations(client, userId);
      router.push(conversationHref(c.id));
    },
  });
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button secondary"
        onClick={() => setOpen(true)}
      >
        Написати продавцю
      </button>
      {open && (
        <FirstMessageDialog
          title={
            listing.title ||
            listing.pet.breed?.nameUk ||
            listing.pet.breed?.name ||
            "Оголошення"
          }
          imageUrl={listing.images[0]?.url ?? null}
          onSend={(text) => mutation.mutateAsync(text)}
          pending={mutation.isPending}
          onClose={() => setOpen(false)}
          returnFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  );
}
