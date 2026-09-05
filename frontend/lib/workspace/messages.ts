import type { QueryResponse } from "@/lib/rag/contracts";
import type { WorkspaceStoredMessage } from "@/lib/workspace/contracts";
import type { WorkspaceMessage } from "@/components/workspace/chat-message";

type StoredRagPayload = {
  guardrails?: QueryResponse["guardrails"];
  metrics?: QueryResponse["metrics"];
  queryId?: string;
  queryText?: string;
  sources?: QueryResponse["sources"];
};

export function conversationTitleFromQuery(query: string) {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "New chat";
  }
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

export function toWorkspaceMessage(message: WorkspaceStoredMessage): WorkspaceMessage {
  const ragPayload = (message.ragPayload ?? undefined) as
    | StoredRagPayload
    | undefined;

  return {
    content: message.content,
    id: message.id,
    queryId: ragPayload?.queryId,
    queryText: ragPayload?.queryText,
    ragPayload: ragPayload
      ? {
          guardrails: ragPayload.guardrails ?? {},
          metrics: ragPayload.metrics ?? {},
          sources: ragPayload.sources ?? [],
        }
      : undefined,
    role: message.role === "system" ? "assistant" : message.role,
  };
}

export async function saveWorkspaceMessage({
  content,
  conversationId,
  id,
  isFirstMessage,
  query,
  ragPayload,
  role,
}: {
  content: string;
  conversationId: string;
  id?: string;
  isFirstMessage?: boolean;
  query?: string;
  ragPayload?: Record<string, unknown>;
  role: "user" | "assistant";
}) {
  const response = await fetch(
    `/api/workspace/conversations/${conversationId}/messages`,
    {
      body: JSON.stringify({
        content,
        id,
        ragPayload,
        role,
        title: isFirstMessage && query ? conversationTitleFromQuery(query) : undefined,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail ?? "Message could not be saved.");
  }

  return payload.message as WorkspaceStoredMessage;
}
