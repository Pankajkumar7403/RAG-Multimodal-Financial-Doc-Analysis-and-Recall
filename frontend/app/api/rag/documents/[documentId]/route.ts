import {
  forwardRagRequest,
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
    const safeResponse = safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(await upstream.json());
  } catch {
    return Response.json(
      { detail: "The document could not be deleted." },
      { status: 502 }
    );
  }
}
