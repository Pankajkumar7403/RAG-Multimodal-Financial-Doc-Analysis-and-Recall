import { ZodError } from "zod";
import {
  requireWorkspaceTenant,
  workspaceErrorResponse,
} from "@/app/api/workspace/_lib/server";
import { generateUUID } from "@/lib/utils";
import { appendMessageSchema } from "@/lib/workspace/contracts";
import {
  appendMessage,
  getConversation,
  touchConversation,
} from "@/lib/workspace/repository";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const identity = await requireWorkspaceTenant();
  if (identity instanceof Response) {
    return identity;
  }

  try {
    const { conversationId } = await params;
    const conversation = await getConversation({
      conversationId,
      tenantId: identity.tenantId,
    });

    if (!conversation) {
      return Response.json({ detail: "Conversation not found." }, { status: 404 });
    }

    const payload = appendMessageSchema.parse(await request.json());
    const [message] = await appendMessage({
      content: payload.content,
      conversationId,
      id: payload.id ?? generateUUID(),
      ragPayload: payload.ragPayload,
      role: payload.role,
    });

    await touchConversation({
      conversationId,
      tenantId: identity.tenantId,
      title: payload.title,
    });

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ detail: "Invalid message request." }, { status: 400 });
    }

    return workspaceErrorResponse(error, "Message could not be saved.");
  }
}
