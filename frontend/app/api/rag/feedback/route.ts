import { ZodError, z } from "zod";
import {
  forwardRagRequest,
  safeProxyResponse,
} from "@/app/api/rag/_lib/server";

const feedbackRequestSchema = z.object({
  answer_text: z.string().max(10_000),
  comment: z.string().max(2000).optional(),
  latency_ms: z.number().nonnegative().optional(),
  model_used: z.string().optional(),
  query_id: z.string().min(1),
  query_text: z.string().max(2000),
  rating: z.enum(["thumbs_up", "thumbs_down", "neutral"]),
  sources: z.array(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = feedbackRequestSchema.parse(await request.json());
    const upstream = await forwardRagRequest("/api/v1/feedback", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const safeResponse = safeProxyResponse(upstream);

    if (!safeResponse.ok) {
      return safeResponse;
    }

    return Response.json(await upstream.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { detail: "Invalid feedback request." },
        { status: 400 }
      );
    }

    return Response.json(
      { detail: "Feedback could not be saved." },
      { status: 502 }
    );
  }
}
