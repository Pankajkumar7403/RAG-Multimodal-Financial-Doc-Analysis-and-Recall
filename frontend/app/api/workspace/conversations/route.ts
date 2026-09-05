import { ZodError } from "zod";
import {
  requireWorkspaceTenant,
  workspaceErrorResponse,
} from "@/app/api/workspace/_lib/server";
import { generateUUID } from "@/lib/utils";
import { createConversationSchema } from "@/lib/workspace/contracts";
import { createConversation, listConversations } from "@/lib/workspace/repository";

export async function GET() {
  const identity = await requireWorkspaceTenant();
  if (identity instanceof Response) {
    return identity;
  }

  try {
    const conversations = await listConversations(identity.tenantId);
    return Response.json({ conversations });
  } catch (error) {
    return workspaceErrorResponse(error, "Chat history could not be loaded.");
  }
}

export async function POST(request: Request) {
  const identity = await requireWorkspaceTenant();
  if (identity instanceof Response) {
    return identity;
  }

  try {
    const payload = createConversationSchema.parse(await request.json());
    const conversationId = payload.id ?? generateUUID();
    const [conversation] = await createConversation({
      id: conversationId,
      tenantId: identity.tenantId,
      title: payload.title ?? "New chat",
      userId: identity.userId,
    });

    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { detail: "Invalid conversation request." },
        { status: 400 }
      );
    }

    return workspaceErrorResponse(error, "Chat could not be created.");
  }
}
