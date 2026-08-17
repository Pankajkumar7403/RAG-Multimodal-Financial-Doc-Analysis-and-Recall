import { CitationDrawer } from "@/components/workspace/citation-drawer";
import { MetricsCards } from "@/components/workspace/metrics-cards";
import type { QueryResponse } from "@/lib/rag/contracts";

export type WorkspaceMessage = {
  content: string;
  id: string;
  ragPayload?: Pick<QueryResponse, "guardrails" | "metrics" | "sources">;
  role: "user" | "assistant";
};

export function ChatMessage({ message }: { message: WorkspaceMessage }) {
  const isAssistant = message.role === "assistant";
  const groundingPassed =
    message.ragPayload?.guardrails.overall_passed === true;

  return (
    <article
      className={`rounded-xl p-4 ${isAssistant ? "border bg-card" : "ml-auto max-w-[85%] bg-primary text-primary-foreground"}`}
    >
      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      {isAssistant && message.ragPayload ? (
        <>
          <p className="mt-3 font-medium text-xs">
            {groundingPassed
              ? "Grounding check passed"
              : "Review cited sources"}
          </p>
          <CitationDrawer sources={message.ragPayload.sources} />
          <MetricsCards metrics={message.ragPayload.metrics} />
        </>
      ) : null}
    </article>
  );
}
