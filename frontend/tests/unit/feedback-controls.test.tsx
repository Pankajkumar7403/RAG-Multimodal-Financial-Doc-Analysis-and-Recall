import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackControls } from "@/components/workspace/feedback-controls";

describe("FeedbackControls", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ status: "saved" }),
        ok: true,
      })
    );
  });

  it("sends thumbs-up feedback and disables both controls", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackControls
        answerText="Revenue increased."
        latencyMs={812.4}
        queryId="q-1"
        queryText="What was revenue?"
        sources={[
          {
            document: "tesla-10k.pdf",
            page: 12,
            score: 0.91,
            text_preview: "Revenue...",
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Helpful answer" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/rag/feedback",
      expect.objectContaining({
        body: JSON.stringify({
          answer_text: "Revenue increased.",
          latency_ms: 812.4,
          query_id: "q-1",
          query_text: "What was revenue?",
          rating: "thumbs_up",
          sources: [
            {
              document: "tesla-10k.pdf",
              page: 12,
              score: 0.91,
              text_preview: "Revenue...",
            },
          ],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(screen.getByText("Feedback saved")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Helpful answer" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Unhelpful answer" })
    ).toBeDisabled();
  });
});
