import { describe, expect, it } from "vitest";
import { tenantFromClaims } from "@/lib/auth/tenant";

describe("tenantFromClaims", () => {
  it("uses organization ID when the active organization exists", () => {
    expect(tenantFromClaims({ orgId: "org_42", userId: "user_7" })).toEqual({
      tenantId: "org_42",
      userId: "user_7",
    });
  });

  it("falls back to user ID for a personal workspace", () => {
    expect(tenantFromClaims({ orgId: null, userId: "user_7" })).toEqual({
      tenantId: "user_7",
      userId: "user_7",
    });
  });

  it("rejects an unauthenticated request", () => {
    expect(() => tenantFromClaims({ orgId: null, userId: null })).toThrow(
      "Authentication is required"
    );
  });
});
