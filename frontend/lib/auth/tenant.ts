import "server-only";
import { auth } from "@clerk/nextjs/server";

export type TenantClaims = {
  orgId: string | null;
  userId: string | null;
};

export function tenantFromClaims({ orgId, userId }: TenantClaims) {
  if (!userId) {
    throw new Error("Authentication is required");
  }

  return { tenantId: orgId ?? userId, userId };
}

export async function getTenantIdentity() {
  return tenantFromClaims(await auth());
}
