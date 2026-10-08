"use client";
import Link from "next/link";
import { CreateListingForm } from "./create-listing-form";
export function CreateListingPage() {
  return (
    <main className="listing-create-shell">
      <Link href="/listings" className="text-link listing-back-link">
        ← До оголошень
      </Link>
      <CreateListingForm />
    </main>
  );
}
