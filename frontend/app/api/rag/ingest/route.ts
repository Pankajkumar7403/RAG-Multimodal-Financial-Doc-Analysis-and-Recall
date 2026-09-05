import {
  forwardRagRequest,
  proxyErrorResponse,
  safeProxyResponse,
} from "@/app/api/rag/_lib/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.type !== "application/pdf") {
      return Response.json(
        { detail: "Only PDF documents can be uploaded." },
        { status: 400 }
      );
    }

    const upstreamFormData = new FormData();
    upstreamFormData.set("file", file, file.name);
    upstreamFormData.set(
      "process_vision",
      formData.get("process_vision") === "false" ? "false" : "true"
    );

    const upstream = await forwardRagRequest("/api/v1/ingest", {
      body: upstreamFormData,
      method: "POST",
    });
    const safeResponse = await safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(await upstream.json());
  } catch (error) {
    return proxyErrorResponse(error, "The document could not be uploaded.");
  }
}
