import "server-only";

import { getTenantIdentity } from "@/lib/auth/tenant";

export function workspaceDbConfigured() {
  return Boolean(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);
}

export async function requireWorkspaceTenant() {
  if (!workspaceDbConfigured()) {
    return Response.json(
      {
        detail:
          "Chat history requires a database. Set POSTGRES_URL in frontend/.env.local and run npm run db:migrate.",
      },
      { status: 503 }
    );
  }

  try {
    return await getTenantIdentity();
  } catch {
    return Response.json(
      { detail: "Authentication is required." },
      { status: 401 }
    );
  }
}

export function workspaceErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const isConfigError =
    message.includes("POSTGRES_URL") ||
    message.includes("DATABASE_URL") ||
    message.includes("connect ECONNREFUSED");

  return Response.json(
    {
      detail: isConfigError
        ? "Chat history database is unavailable. Check POSTGRES_URL and run migrations."
        : fallback,
    },
    { status: isConfigError ? 503 : 500 }
  );
}
