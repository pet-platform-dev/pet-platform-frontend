import { ConversationDetail } from "@/features/conversations/conversation-detail";
export const metadata = { title: "Розмова — Лапа" };
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationDetail id={id} />;
}
