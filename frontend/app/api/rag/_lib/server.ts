import "server-only";
import { getTenantIdentity } from "@/lib/auth/tenant";
import { getRagConfig } from "@/lib/rag/config";

type ForwarderDependencies = {
  config: { apiKey: string; url: string };
  fetcher: typeof fetch;
  identity: { tenantId: string; userId: string };
};

export function createRagForwarder({
  config,
  fetcher,
  identity,
}: ForwarderDependencies) {
  return (path: string, init: RequestInit) =>
    fetcher(`${config.url}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        "X-API-Key": config.apiKey,
        "X-Tenant-ID": identity.tenantId,
      },
    });
}

export async function forwardRagRequest(path: string, init: RequestInit) {
  return createRagForwarder({
    config: getRagConfig(),
    fetcher: fetch,
    identity: await getTenantIdentity(),
  })(path, init);
}

export async function safeProxyResponse(response: Response) {
  if (response.ok) {
    return response;
  }

  if (response.status === 503) {
    return Response.json(
      { detail: "RAG service unavailable. Try again shortly." },
      { status: 503 }
    );
  }

  let detail = "The RAG request could not be completed.";
  try {
    const payload = (await response.clone().json()) as {
      detail?: unknown;
      error?: unknown;
    };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      detail = payload.detail;
    } else if (typeof payload.error === "string" && payload.error.trim()) {
      detail = payload.error;
    }
  } catch {
    // Keep the generic fallback when the upstream body is not JSON.
  }

  return Response.json({ detail }, { status: response.status });
}

export function proxyErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const isConfigError =
    message.includes("RAG_API_URL") ||
    message.includes("RAG_API_MASTER_KEY") ||
    message.includes("Authentication is required");

  return Response.json(
    { detail: isConfigError ? message : fallback },
    { status: isConfigError ? 500 : 502 }
  );
}
