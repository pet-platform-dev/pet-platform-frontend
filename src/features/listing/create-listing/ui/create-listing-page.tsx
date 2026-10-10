"use client";
import Link from "next/link";
import { CreateListingForm } from "./create-listing-form";
export function CreateListingPage({
  preselectedPetId,
}: {
  preselectedPetId?: string;
}) {
  return (
    <main className="listing-create-shell">
      <Link href="/listings" className="text-link listing-back-link">
        ← До оголошень
      </Link>
      <CreateListingForm
        key={preselectedPetId ?? "new"}
        preselectedPetId={preselectedPetId}
      />
    </main>
  );
}
