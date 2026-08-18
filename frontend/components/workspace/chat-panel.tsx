"use client";

import { useCallback, useState } from "react";
import { ChatComposer } from "@/components/workspace/chat-composer";
import {
  ChatMessage,
  type WorkspaceMessage,
} from "@/components/workspace/chat-message";
import { queryResponseSchema } from "@/lib/rag/contracts";
import { generateUUID } from "@/lib/utils";

export function ChatPanel() {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);

  const ask = useCallback(async (query: string) => {
    setError(undefined);
    setIsPending(true);
    setMessages((current) => [
      ...current,
      { content: query, id: generateUUID(), role: "user" },
    ]);

    try {
      const response = await fetch("/api/rag/query", {
        body: JSON.stringify({ query, top_k: 5 }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.detail ?? "The RAG request could not be completed."
        );
      }

      const result = queryResponseSchema.parse(payload);
      setMessages((current) => [
        ...current,
        {
          content: result.answer ?? "No answer was returned.",
          id: generateUUID(),
          queryId: generateUUID(),
          queryText: query,
          ragPayload: result,
          role: "assistant",
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The RAG request could not be completed."
      );
    } finally {
      setIsPending(false);
    }
  }, []);

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length ? (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        ) : (
          <div className="mx-auto max-w-xl pt-20 text-center">
            <h2 className="font-semibold text-2xl">
              Ask your financial documents
            </h2>
            <p className="mt-2 text-muted-foreground">
              Answers are grounded in the PDFs you upload, with page citations
              and retrieval metrics.
            </p>
          </div>
        )}
        {isPending ? (
          <p className="text-muted-foreground text-sm">
            Analyzing your documents…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/30 p-3 text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
      <ChatComposer disabled={isPending} onSubmit={ask} />
    </section>
  );
}
