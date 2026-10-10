import { SellerProfile } from "@/widgets/seller-profile/seller-profile";
import { loadPublicProfile } from "@/widgets/seller-profile/load-public-profile";
import { breederTitle } from "@/entities/breeder/model";
import { ApiError } from "@/shared/api/client";
import { notFound } from "next/navigation";
export async function generateMetadata({ params }: PageProps<"/sellers/[id]">) {
  try {
    const { breeder } = await loadPublicProfile((await params).id);
    return {
      title: breeder
        ? breederTitle(breeder.kennelName)
        : "Профіль продавця — Лапа",
    };
  } catch {
    return { title: "Профіль продавця — Лапа" };
  }
}
export default async function SellerPage({
  params,
}: PageProps<"/sellers/[id]">) {
  const { id } = await params;
  let initial;
  try {
    initial = await loadPublicProfile(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
  }
  return (
    <main className="catalog-shell">
      <SellerProfile
        id={id}
        initialSeller={initial?.seller}
        initialBreeder={initial?.breeder}
      />
    </main>
  );
}
