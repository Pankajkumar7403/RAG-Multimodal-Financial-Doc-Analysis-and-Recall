"use client";

import { CitationDrawer } from "@/components/workspace/citation-drawer";
import { FeedbackControls } from "@/components/workspace/feedback-controls";
import { MetricsCards } from "@/components/workspace/metrics-cards";
import type { QueryResponse } from "@/lib/rag/contracts";
import { cn } from "@/lib/utils";

export type WorkspaceMessage = {
  content: string;
  id: string;
  queryId?: string;
  queryText?: string;
  ragPayload?: Pick<QueryResponse, "guardrails" | "metrics" | "sources">;
  role: "user" | "assistant";
};

export function ChatMessage({ message }: { message: WorkspaceMessage }) {
  const isAssistant = message.role === "assistant";
  const groundingPassed =
    message.ragPayload?.guardrails.overall_passed === true;

  return (
    <article
      className={cn(
        "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6",
        isAssistant
          ? "mr-auto border border-border/50 bg-card shadow-sm"
          : "ml-auto bg-foreground text-background"
      )}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
      {isAssistant && message.ragPayload ? (
        <>
          <p className="mt-3 font-medium text-muted-foreground text-xs">
            {groundingPassed
              ? "Grounding check passed"
              : "Review cited sources"}
          </p>
          <CitationDrawer sources={message.ragPayload.sources} />
          <MetricsCards metrics={message.ragPayload.metrics} />
          {message.queryId && message.queryText ? (
            <FeedbackControls
              answerText={message.content}
              latencyMs={
                typeof message.ragPayload.metrics.total_latency_ms === "number"
                  ? message.ragPayload.metrics.total_latency_ms
                  : undefined
              }
              queryId={message.queryId}
              queryText={message.queryText}
              sources={message.ragPayload.sources}
            />
          ) : null}
        </>
      ) : null}
    </article>
  );
}
