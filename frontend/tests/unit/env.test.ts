import { describe, expect, it } from "vitest";
import { getRagConfig } from "@/lib/rag/config";

describe("getRagConfig", () => {
  it("rejects a missing RAG API URL", () => {
    expect(() =>
      getRagConfig({
        RAG_API_MASTER_KEY: "test-master-key",
      })
    ).toThrow("RAG_API_URL is required");
  });

  it("rejects a missing server-only master key", () => {
    expect(() =>
      getRagConfig({
        RAG_API_URL: "https://rag.example.test",
      })
    ).toThrow("RAG_API_MASTER_KEY is required");
  });
});
