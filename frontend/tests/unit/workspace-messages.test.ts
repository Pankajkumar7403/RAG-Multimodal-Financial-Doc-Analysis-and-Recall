import { describe, expect, it } from "vitest";
import {
  conversationTitleFromQuery,
  toWorkspaceMessage,
} from "@/lib/workspace/messages";

describe("workspace messages", () => {
  it("builds a short title from the first user query", () => {
    expect(conversationTitleFromQuery("What was Q2 revenue?")).toBe(
      "What was Q2 revenue?"
    );
    expect(conversationTitleFromQuery("x".repeat(120)).length).toBeLessThanOrEqual(
      80
    );
  });

  it("maps stored assistant messages back into workspace chat messages", () => {
    const message = toWorkspaceMessage({
      content: "Revenue was $12.4M.",
      conversationId: "4e1d69d8-1aa1-4ac0-9d41-328847d7721d",
      id: "msg-1",
      ragPayload: {
        guardrails: { overall_passed: true },
        metrics: { total_latency_ms: 812 },
        queryId: "query-1",
        queryText: "What was revenue?",
        sources: [],
      },
      role: "assistant",
    });

    expect(message.queryId).toBe("query-1");
    expect(message.ragPayload?.metrics.total_latency_ms).toBe(812);
  });
});
