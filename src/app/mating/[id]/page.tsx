import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getPublicMatingDetail } from "@/entities/mating-listing/public-api";
import { getMatingDetailContext } from "@/features/mating/detail/data";
import { matingMetadata } from "@/features/mating/detail/presentation";
import { MatingDetail } from "@/features/mating/detail/detail";
import { parsePublicMatingReturn } from "@/features/mating/detail/navigation";
import { ApiError } from "@/shared/api/client";
const loadRow = cache(getPublicMatingDetail);
const loadDetail = cache(async (id: string) =>
  getMatingDetailContext(await loadRow(id)),
);
export async function generateMetadata({
  params,
}: PageProps<"/mating/[id]">): Promise<Metadata> {
  try {
    return matingMetadata(await loadRow((await params).id));
  } catch {
    return {
      title: "Оголошення про в’язку — Лапа",
      robots: { index: false, follow: false },
    };
  }
}
export default async function MatingPage({
  params,
  searchParams,
}: PageProps<"/mating/[id]">) {
  const { id } = await params;
  const { href: returnHref, label: returnLabel } = parsePublicMatingReturn(
    (await searchParams).returnTo,
  );
  let initialData;
  try {
    initialData = await loadDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    // A failed server refresh must reset a previously recovered client observer.
    return (
      <MatingDetail
        key={crypto.randomUUID()}
        id={id}
        initialFailed
        returnHref={returnHref}
        returnLabel={returnLabel}
      />
    );
  }
  return (
    <MatingDetail
      id={id}
      initialData={initialData}
      returnHref={returnHref}
      returnLabel={returnLabel}
    />
  );
}
