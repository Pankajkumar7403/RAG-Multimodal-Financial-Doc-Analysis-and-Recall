import { z } from "zod";

export const workspaceMessageSchema = z.object({
  content: z.string(),
  conversationId: z.string().uuid(),
  createdAt: z.coerce.date().optional(),
  id: z.string().uuid(),
  ragPayload: z.record(z.string(), z.unknown()).nullable().optional(),
  role: z.enum(["user", "assistant", "system"]),
});

export const workspaceConversationSchema = z.object({
  createdAt: z.coerce.date().optional(),
  id: z.string().uuid(),
  tenantId: z.string(),
  title: z.string(),
  updatedAt: z.coerce.date().optional(),
  userId: z.string(),
});

export const createConversationSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

export const appendMessageSchema = z.object({
  content: z.string().trim().min(1),
  id: z.string().uuid().optional(),
  ragPayload: z.record(z.string(), z.unknown()).optional(),
  role: z.enum(["user", "assistant", "system"]),
  title: z.string().trim().min(1).max(120).optional(),
});

export type WorkspaceConversation = z.infer<typeof workspaceConversationSchema>;
export type WorkspaceStoredMessage = z.infer<typeof workspaceMessageSchema>;
