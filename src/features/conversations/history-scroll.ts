import type { Message } from "./model";

// Offset pages may overlap when a new message arrives between requests.
export function mergeHistory(pages: { data: Message[] }[]): Message[] {
  const messages = new Map<string, Message>();
  for (const page of [...pages].reverse())
    for (const message of page.data) messages.set(message.id, message);
  return [...messages.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function nearBottom(view: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) {
  return view.scrollHeight - view.scrollTop - view.clientHeight <= 64;
}
