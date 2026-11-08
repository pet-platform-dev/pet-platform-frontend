import { ProviderWorkspace } from "@/features/services/workspace/providers";
export default async function ProviderEditorPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  return <ProviderWorkspace key={providerId} providerId={providerId} editor />;
}
