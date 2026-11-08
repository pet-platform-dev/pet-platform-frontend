import { OfferWorkspace } from "@/features/services/workspace/providers";
export default async function OfferEditorPage({
  params,
}: {
  params: Promise<{ providerId: string; offerId: string }>;
}) {
  const { providerId, offerId } = await params;
  return (
    <OfferWorkspace
      key={`${providerId}:${offerId}`}
      providerId={providerId}
      offerId={offerId}
    />
  );
}
