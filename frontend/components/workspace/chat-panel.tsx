"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatComposer } from "@/components/workspace/chat-composer";
import {
  ChatMessage,
  type WorkspaceMessage,
} from "@/components/workspace/chat-message";
import { Spinner } from "@/components/ui/spinner";
import { queryResponseSchema } from "@/lib/rag/contracts";
import { formatRagError } from "@/lib/rag/errors";
import { generateUUID } from "@/lib/utils";
import {
  conversationTitleFromQuery,
  saveWorkspaceMessage,
  toWorkspaceMessage,
} from "@/lib/workspace/messages";

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/40 bg-muted/50">
        <Spinner className="size-4 text-muted-foreground" />
      </div>
      <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-3">
        <p className="font-medium text-sm">Analyzing your documents…</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Retrieving relevant passages and generating a grounded answer.
        </p>
      </div>
    </div>
  );
}

export function ChatPanel({
  conversationId,
  onConversationChange,
  onDocumentUploaded,
  onHistoryUpdated,
}: {
  conversationId: string | null;
  onConversationChange: (conversationId: string) => void;
  onDocumentUploaded?: () => Promise<void> | void;
  onHistoryUpdated?: () => void;
}) {
  const [error, setError] = useState<string>();
  const [historyError, setHistoryError] = useState<string>();
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHistoryError(undefined);
      setIsLoadingHistory(false);
      return;
    }

    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);
    setHistoryError(undefined);

    fetch(`/api/workspace/conversations/${conversationId}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.detail ?? "Conversation could not be loaded.");
        }
        if (cancelled) {
          return;
        }
        const stored = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages(stored.map(toWorkspaceMessage));
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setHistoryError(
            caughtError instanceof Error
              ? caughtError.message
              : "Conversation could not be loaded."
          );
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const ensureConversation = useCallback(
    async (query: string) => {
      if (conversationId) {
        return conversationId;
      }

      const response = await fetch("/api/workspace/conversations", {
        body: JSON.stringify({
          title: conversationTitleFromQuery(query),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail ?? "Chat could not be created.");
      }

      const nextConversationId = payload.conversation?.id as string | undefined;
      if (!nextConversationId) {
        throw new Error("Chat could not be created.");
      }

      skipNextLoadRef.current = true;
      onConversationChange(nextConversationId);
      onHistoryUpdated?.();
      return nextConversationId;
    },
    [conversationId, onConversationChange, onHistoryUpdated]
  );

  const ask = useCallback(
    async (query: string) => {
      setError(undefined);
      setIsPending(true);

      const userMessageId = generateUUID();
      setMessages((current) => [
        ...current,
        { content: query, id: userMessageId, role: "user" },
      ]);

      try {
        const activeConversationId = await ensureConversation(query);
        const isFirstMessage = messages.length === 0;

        await saveWorkspaceMessage({
          content: query,
          conversationId: activeConversationId,
          id: userMessageId,
          isFirstMessage,
          query,
          role: "user",
        });
        onHistoryUpdated?.();

        const response = await fetch("/api/rag/query", {
          body: JSON.stringify({ query, top_k: 4 }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = await response.json();

        if (!response.ok) {
          const rawDetail =
            (typeof payload.detail === "string" && payload.detail) ||
            (typeof payload.error === "string" && payload.error) ||
            "The RAG request could not be completed.";
          throw new Error(formatRagError(rawDetail));
        }

        const result = queryResponseSchema.parse(payload);
        const assistantMessageId = generateUUID();
        const queryId = generateUUID();
        const assistantMessage: WorkspaceMessage = {
          content: result.answer ?? "No answer was returned.",
          id: assistantMessageId,
          queryId,
          queryText: query,
          ragPayload: result,
          role: "assistant",
        };

        setMessages((current) => [...current, assistantMessage]);

        await saveWorkspaceMessage({
          content: assistantMessage.content,
          conversationId: activeConversationId,
          id: assistantMessageId,
          ragPayload: {
            guardrails: result.guardrails,
            metrics: result.metrics,
            queryId,
            queryText: query,
            sources: result.sources,
          },
          role: "assistant",
        });
        onHistoryUpdated?.();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The RAG request could not be completed."
        );
      } finally {
        setIsPending(false);
      }
    },
    [ensureConversation, messages.length, onHistoryUpdated]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-8">
          {isLoadingHistory ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Spinner className="size-4" />
              Loading conversation…
            </div>
          ) : null}
          {!isLoadingHistory && messages.length ? (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          ) : null}
          {!isLoadingHistory && !messages.length ? (
            <ConversationEmptyState
              description="Answers are grounded in the PDFs you upload, with page citations and retrieval metrics."
              title="Ask your financial documents"
            />
          ) : null}
          {isPending ? <ThinkingIndicator /> : null}
          {historyError ? (
            <div
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              role="alert"
            >
              <p className="font-medium text-destructive">
                Couldn&apos;t load this chat
              </p>
              <p className="mt-1 text-destructive/90">{historyError}</p>
            </div>
          ) : null}
          {error ? (
            <div
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              role="alert"
            >
              <p className="font-medium text-destructive">
                Couldn&apos;t complete that question
              </p>
              <p className="mt-1 text-destructive/90">{error}</p>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <ChatComposer
        disabled={isPending || isLoadingHistory}
        onSubmit={ask}
        onUploaded={onDocumentUploaded}
      />
    </section>
  );
}
