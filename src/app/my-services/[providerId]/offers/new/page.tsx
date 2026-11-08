import { OfferWorkspace } from "@/features/services/workspace/providers";
export default async function NewOfferPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  return <OfferWorkspace key={providerId} providerId={providerId} />;
}
