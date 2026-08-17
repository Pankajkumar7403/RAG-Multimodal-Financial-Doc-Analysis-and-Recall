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

export function safeProxyResponse(response: Response) {
  if (response.ok) {
    return response;
  }

  if (response.status === 503) {
    return Response.json(
      { detail: "RAG service unavailable. Try again shortly." },
      { status: 503 }
    );
  }

  return Response.json(
    { detail: "The RAG request could not be completed." },
    { status: response.status }
  );
}
