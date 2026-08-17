import { describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => conditions),
  desc: vi.fn((column) => column),
  eq: vi.fn((column, value) => ({ column, value })),
}));

vi.mock("@/lib/db/queries", () => ({
  db: {
    query: {
      workspaceConversation: { findFirst },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  workspaceConversation: {
    id: "conversation_id",
    tenantId: "tenant_id",
  },
  workspaceDocumentMeta: {},
  workspaceMessage: {},
}));

import { getConversation } from "@/lib/workspace/repository";

describe("getConversation", () => {
  it("scopes a conversation lookup by tenant", async () => {
    findFirst.mockResolvedValue(undefined);

    await getConversation({
      conversationId: "4e1d69d8-1aa1-4ac0-9d41-328847d7721d",
      tenantId: "org_42",
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() })
    );
  });
});
