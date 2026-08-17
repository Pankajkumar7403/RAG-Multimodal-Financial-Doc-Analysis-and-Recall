import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "@/components/workspace/chat-message";

describe("ChatMessage", () => {
  it("renders citations and latency for an RAG answer", () => {
    render(
      <ChatMessage
        message={{
          content: "Revenue increased.",
          id: "msg-1",
          ragPayload: {
            guardrails: { overall_passed: true },
            metrics: { num_chunks: 5, total_latency_ms: 812.4 },
            sources: [
              {
                document: "tesla-10k.pdf",
                page: 12,
                score: 0.91,
                text_preview: "Revenue...",
              },
            ],
          },
          role: "assistant",
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /tesla-10k.pdf.*page 12/i })
    ).toBeVisible();
    expect(screen.getByText("812 ms")).toBeVisible();
  });
});
