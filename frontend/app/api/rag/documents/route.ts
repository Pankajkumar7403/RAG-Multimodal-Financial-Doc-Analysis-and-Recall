import {
  forwardRagRequest,
  proxyErrorResponse,
  safeProxyResponse,
} from "@/app/api/rag/_lib/server";

export async function GET() {
  try {
    const upstream = await forwardRagRequest("/api/v1/documents", {
      method: "GET",
    });
    const safeResponse = await safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(await upstream.json());
  } catch (error) {
    return proxyErrorResponse(error, "The document list could not be loaded.");
  }
}
