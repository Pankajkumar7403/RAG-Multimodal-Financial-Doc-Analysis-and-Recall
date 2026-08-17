import { describe, expect, it, vi } from "vitest";
import { createRagForwarder } from "@/app/api/rag/_lib/server";

describe("createRagForwarder", () => {
  it("injects only server credentials and the Clerk-derived tenant", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const forward = createRagForwarder({
      config: { apiKey: "master", url: "https://rag.example.test" },
      fetcher,
      identity: { tenantId: "org_42", userId: "user_7" },
    });

    await forward("/api/v1/query", { body: "{}", method: "POST" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://rag.example.test/api/v1/query",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "master",
          "X-Tenant-ID": "org_42",
        }),
      })
    );
  });
});
