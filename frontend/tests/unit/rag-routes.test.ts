import { beforeEach, describe, expect, it, vi } from "vitest";

const { forwardRagRequest, safeProxyResponse } = vi.hoisted(() => ({
  forwardRagRequest: vi.fn(),
  safeProxyResponse: vi.fn(),
}));

vi.mock("@/app/api/rag/_lib/server", () => ({
  forwardRagRequest,
  safeProxyResponse,
}));

import { POST } from "@/app/api/rag/query/route";

describe("POST /api/rag/query", () => {
  beforeEach(() => {
    forwardRagRequest.mockReset();
    safeProxyResponse.mockReset();
  });

  it("forwards only query, top_k, and filters", async () => {
    const upstream = Response.json({
      answer: "Revenue was $10 million.",
      guardrails: {},
      metrics: {},
      query: "What was revenue?",
      sources: [],
      status: "success",
      tenant_id: "org_42",
    });
    forwardRagRequest.mockResolvedValue(upstream);
    safeProxyResponse.mockResolvedValue(upstream);

    const request = new Request("http://localhost/api/rag/query", {
      body: JSON.stringify({
        query: "What was revenue?",
        tenant_id: "attacker-selected-tenant",
        top_k: 4,
      }),
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(forwardRagRequest).toHaveBeenCalledWith(
      "/api/v1/query",
      expect.objectContaining({
        body: JSON.stringify({ query: "What was revenue?", top_k: 4 }),
      })
    );
  });
});
