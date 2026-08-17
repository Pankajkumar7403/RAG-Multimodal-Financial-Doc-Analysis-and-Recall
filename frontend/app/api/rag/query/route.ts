import { ZodError } from "zod";
import {
  forwardRagRequest,
  safeProxyResponse,
} from "@/app/api/rag/_lib/server";
import { queryRequestSchema, queryResponseSchema } from "@/lib/rag/contracts";

export async function POST(request: Request) {
  try {
    const payload = queryRequestSchema.parse(await request.json());
    const upstream = await forwardRagRequest("/api/v1/query", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const safeResponse = safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(queryResponseSchema.parse(await upstream.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { detail: "Invalid query request." },
        { status: 400 }
      );
    }

    return Response.json(
      { detail: "The RAG request could not be completed." },
      { status: 502 }
    );
  }
}
