import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import {
  workspaceConversation,
  workspaceDocumentMeta,
  workspaceMessage,
} from "@/lib/db/schema";

type ConversationInput = {
  id: string;
  tenantId: string;
  title: string;
  userId: string;
};

type MessageInput = {
  content: string;
  conversationId: string;
  id?: string;
  ragPayload?: Record<string, unknown>;
  role: "user" | "assistant" | "system";
};

type DocumentMetaInput = {
  backendDocId: string;
  errorDetail?: string | null;
  filename: string;
  status: "uploading" | "ready" | "failed";
  tenantId: string;
};

export function createConversation(input: ConversationInput) {
  return db.insert(workspaceConversation).values(input).returning();
}

export function appendMessage(input: MessageInput) {
  return db.insert(workspaceMessage).values(input).returning();
}

export function listConversations(tenantId: string) {
  return db
    .select()
    .from(workspaceConversation)
    .where(eq(workspaceConversation.tenantId, tenantId))
    .orderBy(desc(workspaceConversation.updatedAt));
}

export function getConversation({
  conversationId,
  tenantId,
}: {
  conversationId: string;
  tenantId: string;
}) {
  return db.query.workspaceConversation.findFirst({
    where: and(
      eq(workspaceConversation.id, conversationId),
      eq(workspaceConversation.tenantId, tenantId)
    ),
  });
}

export async function getConversationWithMessages({
  conversationId,
  tenantId,
}: {
  conversationId: string;
  tenantId: string;
}) {
  const conversation = await getConversation({ conversationId, tenantId });
  if (!conversation) {
    return null;
  }

  const messages = await db
    .select()
    .from(workspaceMessage)
    .where(eq(workspaceMessage.conversationId, conversationId))
    .orderBy(asc(workspaceMessage.createdAt));

  return { conversation, messages };
}

export function touchConversation({
  conversationId,
  tenantId,
  title,
}: {
  conversationId: string;
  tenantId: string;
  title?: string;
}) {
  return db
    .update(workspaceConversation)
    .set({
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    })
    .where(
      and(
        eq(workspaceConversation.id, conversationId),
        eq(workspaceConversation.tenantId, tenantId)
      )
    )
    .returning();
}

export function upsertDocumentMeta(input: DocumentMetaInput) {
  return db
    .insert(workspaceDocumentMeta)
    .values(input)
    .onConflictDoUpdate({
      set: {
        errorDetail: input.errorDetail ?? null,
        filename: input.filename,
        status: input.status,
        updatedAt: new Date(),
      },
      target: [
        workspaceDocumentMeta.tenantId,
        workspaceDocumentMeta.backendDocId,
      ],
    })
    .returning();
}

export function listDocumentMeta(tenantId: string) {
  return db
    .select()
    .from(workspaceDocumentMeta)
    .where(eq(workspaceDocumentMeta.tenantId, tenantId))
    .orderBy(desc(workspaceDocumentMeta.updatedAt));
}
