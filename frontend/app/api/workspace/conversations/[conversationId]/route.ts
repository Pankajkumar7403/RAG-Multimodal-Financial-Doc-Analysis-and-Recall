import {
  requireWorkspaceTenant,
  workspaceErrorResponse,
} from "@/app/api/workspace/_lib/server";
import { getConversationWithMessages } from "@/lib/workspace/repository";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const identity = await requireWorkspaceTenant();
  if (identity instanceof Response) {
    return identity;
  }

  try {
    const { conversationId } = await params;
    const result = await getConversationWithMessages({
      conversationId,
      tenantId: identity.tenantId,
    });

    if (!result) {
      return Response.json({ detail: "Conversation not found." }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error, "Conversation could not be loaded.");
  }
}
