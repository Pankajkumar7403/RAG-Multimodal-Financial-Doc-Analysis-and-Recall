import { z } from "zod";

export const queryRequestSchema = z.object({
  filters: z.record(z.string(), z.unknown()).optional(),
  query: z.string().trim().min(1).max(2000),
  top_k: z.number().int().min(1).max(20).optional(),
});

export const sourceSchema = z.object({
  document: z.string(),
  page: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  text_preview: z.string(),
});

export const queryResponseSchema = z.object({
  answer: z.string().nullable(),
  guardrails: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  query: z.string(),
  sources: z.array(sourceSchema),
  status: z.string(),
  tenant_id: z.string(),
});

export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;
