import { SellerProfile } from "@/widgets/seller-profile/seller-profile";
import { getSeller } from "@/entities/seller/api";
import { ApiError } from "@/shared/api/client";
import { notFound } from "next/navigation";
export const metadata = { title: "Профіль продавця — Лапа" };
export default async function SellerPage({
  params,
}: PageProps<"/sellers/[id]">) {
  const { id } = await params;
  let initialSeller;
  try {
    initialSeller = await getSeller(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
  }
  return (
    <main className="catalog-shell">
      <SellerProfile id={id} initialSeller={initialSeller} />
    </main>
  );
}
