import {
  forwardRagRequest,
  proxyErrorResponse,
  safeProxyResponse,
} from "@/app/api/rag/_lib/server";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { documentId } = await params;
    const upstream = await forwardRagRequest(
      `/api/v1/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );
    const safeResponse = await safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(await upstream.json());
  } catch (error) {
    return proxyErrorResponse(error, "The document could not be deleted.");
  }
}
