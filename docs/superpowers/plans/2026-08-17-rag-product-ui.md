# RAG Product UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Clerk-authenticated Next.js workspace that reuses Vercel Chatbot's product shell while calling the existing FastAPI RAG service exclusively through secure server-side proxies.

**Architecture:** Create an independent `frontend/` Next.js application from the Vercel Chatbot template. Remove its Auth.js and direct AI Gateway paths, then add Clerk, a small Neon/Drizzle persistence model for UI history, and route handlers that derive the tenant from Clerk before forwarding allowlisted requests to FastAPI. The Python RAG pipeline remains unchanged.

**Tech Stack:** Next.js App Router, TypeScript, React, Clerk, Drizzle ORM, Neon/Postgres, Tailwind/shadcn components from `vercel/chatbot`, Vitest, Playwright, FastAPI.

## Global Constraints

- Reuse `vercel/chatbot` as a UI shell; do not retain its direct model, embedding, retrieval, or vector-store execution path.
- Never expose `RAG_API_MASTER_KEY` to browser code. It is read only in Next.js server route handlers.
- Derive the RAG tenant only from Clerk: `orgId ?? userId`; do not accept a browser-supplied tenant identifier.
- FastAPI business logic and its `/api/v1` contract remain unchanged.
- Return safe client errors with `{ "detail": string }`; do not pass upstream stack traces or raw exception text to the browser.
- Deploy Next.js on Vercel and the existing FastAPI service on Render or Railway.
- Version one is non-streaming: FastAPI's JSON query result renders after the request completes.

---

## Planned file structure

| Path | Responsibility |
|---|---|
| `frontend/` | Forked, independently deployable Next.js application. |
| `frontend/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in screen. |
| `frontend/app/(auth)/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up screen. |
| `frontend/app/(workspace)/workspace/page.tsx` | Protected workspace entry point. |
| `frontend/app/api/rag/_lib/server.ts` | Server-only identity, allowlisted forwarding, upstream error normalization. |
| `frontend/app/api/rag/query/route.ts` | Authenticated FastAPI query proxy. |
| `frontend/app/api/rag/ingest/route.ts` | Authenticated multipart ingest proxy. |
| `frontend/app/api/rag/documents/route.ts` | Authenticated list-documents proxy. |
| `frontend/app/api/rag/documents/[documentId]/route.ts` | Authenticated document-delete proxy. |
| `frontend/app/api/rag/feedback/route.ts` | Authenticated feedback proxy. |
| `frontend/lib/rag/contracts.ts` | Zod schemas and TypeScript types for FastAPI payloads. |
| `frontend/lib/db/schema.ts` | Drizzle schema for conversations, messages, and display metadata. |
| `frontend/lib/db/queries.ts` | Tenant-scoped UI history/document metadata queries. |
| `frontend/components/workspace/*` | Focused chat, upload, citation, metrics, and document components. |
| `frontend/tests/unit/*` | Unit coverage for tenant and proxy behavior. |
| `frontend/tests/e2e/*` | Browser flows with a Clerk test account and mocked/staging FastAPI. |
| `frontend/.env.example` | Names only; no values or credentials. |
| `docs/deployment/frontend.md` | Vercel, Clerk, Neon, Render/Railway configuration and smoke checks. |

## Task 1: Establish the frontend application from the approved template

**Files:**
- Create: `frontend/` from `https://github.com/vercel/chatbot`
- Create: `frontend/.env.example`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/setup.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: the upstream `vercel/chatbot` UI/layout components.
- Produces: a reproducible pnpm application with `test:unit`, `test:e2e`, `lint`, and `build` commands.

- [ ] **Step 1: Clone the template at a recorded revision**

Run:

```powershell
git clone https://github.com/vercel/chatbot frontend
Set-Location frontend
git rev-parse HEAD
```

Record the returned commit SHA in `frontend/README.md` under `Template base revision` before altering files. This makes upstream UI updates auditable.

- [ ] **Step 2: Remove Git metadata inherited from the template**

Run:

```powershell
Remove-Item -Recurse -Force .git
Set-Location ..
git add frontend
git commit -m "chore: scaffold product UI from Vercel Chatbot"
```

Expected: the application is tracked as part of this repository, not as a nested Git repository.

- [ ] **Step 3: Add failing environment-validation tests**

Create `frontend/tests/unit/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getRagConfig } from "@/lib/rag/config";

describe("getRagConfig", () => {
  it("rejects a missing RAG API URL", () => {
    expect(() =>
      getRagConfig({
        RAG_API_MASTER_KEY: "test-master-key",
      }),
    ).toThrow("RAG_API_URL is required");
  });

  it("rejects a missing server-only master key", () => {
    expect(() =>
      getRagConfig({
        RAG_API_URL: "https://rag.example.test",
      }),
    ).toThrow("RAG_API_MASTER_KEY is required");
  });
});
```

- [ ] **Step 4: Run the test to confirm the configuration module does not yet exist**

Run:

```powershell
pnpm exec vitest run tests/unit/env.test.ts
```

Expected: FAIL because `@/lib/rag/config` has not been created.

- [ ] **Step 5: Add test tooling, scripts, and safe environment template**

Add to `frontend/package.json`:

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Install test dependencies:

```powershell
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/jest-dom @testing-library/react @testing-library/user-event
```

Create `frontend/.env.example`:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
RAG_API_URL=
RAG_API_MASTER_KEY=
```

Create `frontend/vitest.config.ts`:

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
});
```

Create `frontend/tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Implement config validation**

Create `frontend/lib/rag/config.ts`:

```ts
import "server-only";

type RagEnvironment = Partial<Record<"RAG_API_URL" | "RAG_API_MASTER_KEY", string>>;

export function getRagConfig(environment: RagEnvironment = process.env) {
  const url = environment.RAG_API_URL?.replace(/\/+$/, "");
  const apiKey = environment.RAG_API_MASTER_KEY;

  if (!url) throw new Error("RAG_API_URL is required");
  if (!apiKey) throw new Error("RAG_API_MASTER_KEY is required");

  return { apiKey, url };
}
```

- [ ] **Step 7: Verify frontend baseline**

Run:

```powershell
pnpm test:unit
pnpm lint
pnpm build
```

Expected: all commands exit `0`; no secret values are committed.

- [ ] **Step 8: Commit baseline**

```powershell
git add frontend
git commit -m "chore: initialize product frontend"
```

## Task 2: Replace template authentication with Clerk and protect the workspace

**Files:**
- Create: `frontend/middleware.ts`
- Create: `frontend/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `frontend/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `frontend/app/(workspace)/layout.tsx`
- Create: `frontend/app/(workspace)/workspace/page.tsx`
- Modify: `frontend/app/layout.tsx`
- Remove: template Auth.js provider, session helpers, and template login/register routes
- Test: `frontend/tests/unit/tenant.test.ts`

**Interfaces:**
- Consumes: `auth()` from `@clerk/nextjs/server`.
- Produces: `getTenantIdentity(): Promise<{ userId: string; tenantId: string }>` in `frontend/lib/auth/tenant.ts`.

- [ ] **Step 1: Write failing tenant derivation tests**

Create `frontend/tests/unit/tenant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tenantFromClaims } from "@/lib/auth/tenant";

describe("tenantFromClaims", () => {
  it("uses organization ID when the active organization exists", () => {
    expect(tenantFromClaims({ orgId: "org_42", userId: "user_7" })).toEqual({
      tenantId: "org_42",
      userId: "user_7",
    });
  });

  it("falls back to user ID for a personal workspace", () => {
    expect(tenantFromClaims({ orgId: null, userId: "user_7" })).toEqual({
      tenantId: "user_7",
      userId: "user_7",
    });
  });

  it("rejects an unauthenticated request", () => {
    expect(() => tenantFromClaims({ orgId: null, userId: null })).toThrow(
      "Authentication is required",
    );
  });
});
```

- [ ] **Step 2: Run the failing tenant test**

Run:

```powershell
pnpm exec vitest run tests/unit/tenant.test.ts
```

Expected: FAIL because the tenant helper is absent.

- [ ] **Step 3: Install Clerk and implement the tenant helper**

Run:

```powershell
pnpm add @clerk/nextjs
```

Create `frontend/lib/auth/tenant.ts`:

```ts
import "server-only";
import { auth } from "@clerk/nextjs/server";

export type TenantClaims = { orgId: string | null; userId: string | null };

export function tenantFromClaims({ orgId, userId }: TenantClaims) {
  if (!userId) throw new Error("Authentication is required");
  return { tenantId: orgId ?? userId, userId };
}

export async function getTenantIdentity() {
  return tenantFromClaims(await auth());
}
```

Create `frontend/middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isWorkspaceRoute = createRouteMatcher(["/workspace(.*)", "/api/rag(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isWorkspaceRoute(request)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
```

- [ ] **Step 4: Wire Clerk into the root and create protected pages**

Wrap the template root layout with `ClerkProvider`, add Clerk `<SignIn />` and `<SignUp />` catch-all routes, and create:

```tsx
// app/(workspace)/workspace/page.tsx
import { Workspace } from "@/components/workspace/workspace";

export default function WorkspacePage() {
  return <Workspace />;
}
```

Use `<UserButton />` and `<OrganizationSwitcher />` in the workspace header. Delete the template's Auth.js session/database calls rather than operating both auth systems.

- [ ] **Step 5: Verify Clerk protection and tenant tests**

Run:

```powershell
pnpm exec vitest run tests/unit/tenant.test.ts
pnpm lint
```

Expected: tenant tests pass; unauthenticated `/workspace` is redirected by Clerk in local manual test.

- [ ] **Step 6: Commit Clerk boundary**

```powershell
git add frontend
git commit -m "feat: protect product workspace with Clerk"
```

## Task 3: Add typed, server-only FastAPI forwarding primitives

**Files:**
- Create: `frontend/lib/rag/contracts.ts`
- Create: `frontend/app/api/rag/_lib/server.ts`
- Create: `frontend/tests/unit/rag-server.test.ts`

**Interfaces:**
- Consumes: `getTenantIdentity()` and `getRagConfig()`.
- Produces: `forwardRagRequest(path: string, init: RequestInit): Promise<Response>` and `RagProxyError`.

- [ ] **Step 1: Write failing forwarding tests**

Create `frontend/tests/unit/rag-server.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createRagForwarder } from "@/app/api/rag/_lib/server";

describe("createRagForwarder", () => {
  it("injects only server credentials and the Clerk-derived tenant", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const forward = createRagForwarder({
      config: { apiKey: "master", url: "https://rag.example.test" },
      fetcher,
      identity: { tenantId: "org_42", userId: "user_7" },
    });

    await forward("/api/v1/query", { method: "POST", body: "{}" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://rag.example.test/api/v1/query",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "master",
          "X-Tenant-ID": "org_42",
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
pnpm exec vitest run tests/unit/rag-server.test.ts
```

Expected: FAIL because `createRagForwarder` is absent.

- [ ] **Step 3: Define FastAPI-compatible types**

Create `frontend/lib/rag/contracts.ts`:

```ts
import { z } from "zod";

export const queryRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  top_k: z.number().int().min(1).max(20).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const sourceSchema = z.object({
  document: z.string(),
  page: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  text_preview: z.string(),
});

export const queryResponseSchema = z.object({
  status: z.string(),
  query: z.string(),
  answer: z.string().nullable(),
  sources: z.array(sourceSchema),
  guardrails: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  tenant_id: z.string(),
});

export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;
```

- [ ] **Step 4: Implement forwarding and error normalization**

Create `frontend/app/api/rag/_lib/server.ts`:

```ts
import "server-only";
import { getTenantIdentity } from "@/lib/auth/tenant";
import { getRagConfig } from "@/lib/rag/config";

type ForwarderDependencies = {
  config: { apiKey: string; url: string };
  fetcher: typeof fetch;
  identity: { tenantId: string; userId: string };
};

export function createRagForwarder({ config, fetcher, identity }: ForwarderDependencies) {
  return (path: string, init: RequestInit) =>
    fetcher(`${config.url}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        "X-API-Key": config.apiKey,
        "X-Tenant-ID": identity.tenantId,
      },
      cache: "no-store",
    });
}

export async function forwardRagRequest(path: string, init: RequestInit) {
  return createRagForwarder({
    config: getRagConfig(),
    fetcher: fetch,
    identity: await getTenantIdentity(),
  })(path, init);
}

export async function safeProxyResponse(response: Response) {
  if (response.ok) return response;
  if (response.status === 503) {
    return Response.json({ detail: "RAG service unavailable. Try again shortly." }, { status: 503 });
  }
  return Response.json({ detail: "The RAG request could not be completed." }, { status: response.status });
}
```

- [ ] **Step 5: Run the unit suite**

```powershell
pnpm test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit proxy foundation**

```powershell
git add frontend
git commit -m "feat: add secure RAG proxy foundation"
```

## Task 4: Implement the four authenticated FastAPI route handlers

**Files:**
- Create: `frontend/app/api/rag/query/route.ts`
- Create: `frontend/app/api/rag/ingest/route.ts`
- Create: `frontend/app/api/rag/documents/route.ts`
- Create: `frontend/app/api/rag/documents/[documentId]/route.ts`
- Create: `frontend/app/api/rag/feedback/route.ts`
- Test: `frontend/tests/unit/rag-routes.test.ts`

**Interfaces:**
- Consumes: `forwardRagRequest`, `safeProxyResponse`, and schemas from `lib/rag/contracts.ts`.
- Produces: browser-safe `/api/rag/*` endpoints; no `tenant_id` appears in their request contracts.

- [ ] **Step 1: Write failing route behavior tests**

Test query allowlisting and tenant rejection:

```ts
it("forwards only query, top_k, and filters", async () => {
  const request = new Request("http://localhost/api/rag/query", {
    method: "POST",
    body: JSON.stringify({
      query: "What was revenue?",
      top_k: 4,
      tenant_id: "attacker-selected-tenant",
    }),
  });

  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(forwardRagRequest).toHaveBeenCalledWith(
    "/api/v1/query",
    expect.objectContaining({
      body: JSON.stringify({ query: "What was revenue?", top_k: 4 }),
    }),
  );
});
```

- [ ] **Step 2: Run the route test to verify it fails**

```powershell
pnpm exec vitest run tests/unit/rag-routes.test.ts
```

Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement the query handler**

`frontend/app/api/rag/query/route.ts` must parse with `queryRequestSchema`, reject invalid data with `400`, and forward:

```ts
const payload = queryRequestSchema.parse(await request.json());
const upstream = await forwardRagRequest("/api/v1/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const safeResponse = await safeProxyResponse(upstream);
if (!safeResponse.ok) return safeResponse;
return Response.json(queryResponseSchema.parse(await upstream.json()));
```

Catch Zod parsing errors and return `Response.json({ detail: "Invalid query request." }, { status: 400 })`.

- [ ] **Step 4: Implement ingest, documents, delete, and feedback handlers**

Apply these exact forwarding rules:

| Handler | Allowed browser input | Upstream request |
|---|---|---|
| ingest | one PDF `file`; boolean `process_vision` | Rebuild `FormData` containing only `file` and `process_vision`; `POST /api/v1/ingest` |
| list docs | none | `GET /api/v1/documents` |
| delete doc | `documentId` route segment | `DELETE /api/v1/documents/${encodeURIComponent(documentId)}` |
| feedback | `query_id`, `query_text`, `answer_text`, `rating`, optional `comment`, `model_used`, `latency_ms`, `sources` | Validate then `POST /api/v1/feedback`; never accept `tenant_id` |

Reject upload files whose `type !== "application/pdf"` with:

```ts
return Response.json({ detail: "Only PDF documents can be uploaded." }, { status: 400 });
```

Do not forward original `tenant_id` fields even if attackers send them.

- [ ] **Step 5: Run unit tests and build**

```powershell
pnpm test:unit
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit proxy routes**

```powershell
git add frontend
git commit -m "feat: proxy RAG document and query endpoints"
```

## Task 5: Persist tenant-scoped workspace history and document display metadata

**Files:**
- Modify: `frontend/lib/db/schema.ts`
- Modify: `frontend/lib/db/queries.ts`
- Create: `frontend/lib/workspace/repository.ts`
- Test: `frontend/tests/unit/workspace-repository.test.ts`

**Interfaces:**
- Consumes: Clerk-derived `{ tenantId, userId }`.
- Produces: `createConversation`, `appendMessage`, `listConversations`, `getConversation`, `upsertDocumentMeta`, and `listDocumentMeta`, all requiring `tenantId`.

- [ ] **Step 1: Write failing tenant-scoping test**

```ts
it("adds tenant scope to a conversation lookup", async () => {
  await repository.getConversation({ conversationId: "chat_a", tenantId: "org_42" });
  expect(database.execute).toHaveBeenCalledWith(
    expect.stringContaining('"tenant_id" = $2'),
    expect.arrayContaining(["chat_a", "org_42"]),
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

```powershell
pnpm exec vitest run tests/unit/workspace-repository.test.ts
```

Expected: FAIL because the tenant-scoped repository method is absent.

- [ ] **Step 3: Add schema tables and migration**

Add Drizzle table definitions equivalent to:

```ts
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Add `messages` with `conversationId`, `role`, `content`, nullable `ragPayload: jsonb`, and `createdAt`. Add `documentMeta` with `tenantId`, `backendDocId`, `filename`, `status`, nullable `errorDetail`, and timestamps. Add indexes on each `tenant_id` and `messages.conversation_id`.

Run:

```powershell
pnpm db:generate
```

Commit the generated migration under the template's existing Drizzle migration directory.

- [ ] **Step 4: Implement repository methods with tenant always in predicate**

Example query shape:

```ts
export async function getConversation(input: { conversationId: string; tenantId: string }) {
  return db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, input.conversationId),
      eq(conversations.tenantId, input.tenantId),
    ),
  });
}
```

Every select, insert update, and delete receives `tenantId`. The server obtains it through `getTenantIdentity()`, never from client data.

- [ ] **Step 5: Verify migration and repository tests**

```powershell
pnpm test:unit
pnpm db:check
```

Expected: PASS.

- [ ] **Step 6: Commit persistence**

```powershell
git add frontend
git commit -m "feat: persist tenant-scoped workspace history"
```

## Task 6: Adapt the template chat shell to the existing RAG response

**Files:**
- Create: `frontend/components/workspace/workspace.tsx`
- Create: `frontend/components/workspace/chat-panel.tsx`
- Create: `frontend/components/workspace/chat-message.tsx`
- Create: `frontend/components/workspace/citation-drawer.tsx`
- Create: `frontend/components/workspace/metrics-cards.tsx`
- Create: `frontend/components/workspace/chat-composer.tsx`
- Modify: `frontend/app/(workspace)/workspace/page.tsx`
- Test: `frontend/tests/unit/chat-panel.test.tsx`

**Interfaces:**
- Consumes: `QueryResponse` and `/api/rag/query`.
- Produces: an answer UI that renders `answer`, sources, guardrail fields, and metrics without requiring streaming.

- [ ] **Step 1: Write a failing answer-rendering test**

```tsx
it("renders citations and latency for an RAG answer", () => {
  render(
    <ChatMessage
      message={{
        role: "assistant",
        content: "Revenue increased.",
        ragPayload: {
          sources: [{ document: "tesla-10k.pdf", page: 12, score: 0.91, text_preview: "Revenue..." }],
          guardrails: { overall_passed: true },
          metrics: { total_latency_ms: 812.4, num_chunks: 5 },
        },
      }}
    />,
  );

  expect(screen.getByRole("button", { name: /tesla-10k.pdf.*page 12/i })).toBeVisible();
  expect(screen.getByText("812 ms")).toBeVisible();
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
pnpm exec vitest run tests/unit/chat-panel.test.tsx
```

Expected: FAIL because workspace components do not exist.

- [ ] **Step 3: Implement the non-streaming query interaction**

`ChatComposer` submits:

```ts
const response = await fetch("/api/rag/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: draft, top_k: 5 }),
});
```

While pending, disable submit and display `Analyzing your documents…`. On success, append user and assistant rows through the tenant-scoped repository. On error, display the returned `detail` string and preserve the user's draft for retry.

- [ ] **Step 4: Implement result-specific UI**

- Assistant markdown/text uses the template's existing message renderer.
- `CitationDrawer` lists `document`, `page`, `score`, and `text_preview`, using `Source: <document> · p. <page>` when page exists and `Source: <document>` otherwise.
- `MetricsCards` renders `total_latency_ms`, `retrieval_latency_ms`, `generation_latency_ms`, `cost_usd`, and `num_chunks` only when each key is numeric.
- A compact guardrail badge renders `Grounding check passed` only when `guardrails.overall_passed === true`; otherwise it renders `Review cited sources`.

Remove the template's model selector, gateway model route, weather/document tool UI, and generation-specific affordances. Do not leave a hidden direct AI Gateway code path.

- [ ] **Step 5: Verify the chat surface**

```powershell
pnpm test:unit
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit chat adaptation**

```powershell
git add frontend
git commit -m "feat: render FastAPI RAG answers in workspace chat"
```

## Task 7: Add document management and FastAPI feedback to the workspace

**Files:**
- Create: `frontend/components/workspace/document-library.tsx`
- Create: `frontend/components/workspace/upload-document.tsx`
- Create: `frontend/components/workspace/feedback-controls.tsx`
- Modify: `frontend/components/workspace/workspace.tsx`
- Test: `frontend/tests/unit/upload-document.test.tsx`
- Test: `frontend/tests/unit/feedback-controls.test.tsx`

**Interfaces:**
- Consumes: `/api/rag/ingest`, `/api/rag/documents`, `/api/rag/documents/[id]`, `/api/rag/feedback`.
- Produces: PDF upload, backend document list/delete, and thumbs feedback UX.

- [ ] **Step 1: Write failing upload validation test**

```tsx
it("prevents non-PDF uploads before sending a request", async () => {
  const user = userEvent.setup();
  render(<UploadDocument onUploaded={vi.fn()} />);
  await user.upload(screen.getByLabelText(/upload pdf/i), new File(["x"], "notes.txt", { type: "text/plain" }));

  expect(screen.getByText("Only PDF documents can be uploaded.")).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the failing component tests**

```powershell
pnpm exec vitest run tests/unit/upload-document.test.tsx tests/unit/feedback-controls.test.tsx
```

Expected: FAIL because the components are missing.

- [ ] **Step 3: Implement upload and list lifecycle**

`UploadDocument` accepts one PDF, creates `FormData` with `file` and `process_vision`, POSTs to `/api/rag/ingest`, then calls `onUploaded`. The document library refetches `GET /api/rag/documents` after success. Show statuses:

```ts
type DocumentStatus = "uploading" | "ready" | "failed";
```

Store display state with `upsertDocumentMeta`; FastAPI remains the authoritative source for ingestion and document deletion.

- [ ] **Step 4: Implement deletion and feedback**

For deletion call:

```ts
await fetch(`/api/rag/documents/${encodeURIComponent(documentId)}`, {
  method: "DELETE",
});
```

For thumbs feedback call:

```ts
await fetch("/api/rag/feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query_id: queryId,
    query_text: queryText,
    answer_text: answerText,
    rating: "thumbs_up",
    sources,
    latency_ms: metrics.total_latency_ms,
  }),
});
```

Use `"thumbs_down"` for the negative button. Disable both controls after a successful response and show `Feedback saved`.

- [ ] **Step 5: Verify document and feedback components**

```powershell
pnpm test:unit
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit workspace operations**

```powershell
git add frontend
git commit -m "feat: add document ingestion and answer feedback"
```

## Task 8: Add end-to-end coverage and production deployment documentation

**Files:**
- Create: `frontend/tests/e2e/workspace.spec.ts`
- Create: `docs/deployment/frontend.md`
- Modify: `frontend/README.md`

**Interfaces:**
- Consumes: deployed Clerk app, Neon database, and staging or production FastAPI URL.
- Produces: repeatable deployment configuration and smoke verification.

- [ ] **Step 1: Write end-to-end acceptance flow**

Create a Playwright test with these assertions:

```ts
test("a signed-in user can ingest, query, cite, and rate an answer", async ({ page }) => {
  await signInAsTestUser(page);
  await page.goto("/workspace");
  await page.getByLabel("Upload PDF").setInputFiles("tests/fixtures/financial-report.pdf");
  await expect(page.getByText("financial-report.pdf")).toBeVisible();
  await page.getByPlaceholder("Ask about your financial documents").fill("What was revenue?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Source:/)).toBeVisible();
  await page.getByRole("button", { name: "Helpful answer" }).click();
  await expect(page.getByText("Feedback saved")).toBeVisible();
});
```

Add a second test with two Clerk test users/orgs that verifies each sees only its own conversations and documents.

- [ ] **Step 2: Run the test locally against mocked route handlers**

```powershell
pnpm test:e2e
```

Expected: PASS with the frontend's test configuration; live RAG credentials are not needed for this suite.

- [ ] **Step 3: Write deployment documentation**

`docs/deployment/frontend.md` must include:

1. Create Clerk application; enable email/password and Google; enable Organizations when shared workspaces are wanted.
2. Create Neon database and set `DATABASE_URL` in Vercel.
3. Import `frontend/` as the Vercel project root.
4. Set Vercel environment names listed in `frontend/.env.example`; ensure `RAG_API_MASTER_KEY` is never prefixed with `NEXT_PUBLIC_`.
5. Deploy FastAPI on Render/Railway with `DEBUG=false`, `RAG_API_MASTER_KEY`, model credentials, and restricted CORS origins.
6. Run migrations: `pnpm db:migrate`.
7. Production smoke test: sign in; upload a PDF; query; open citation drawer; submit feedback; check that browser requests target `/api/rag/*` and contain no master API key.

- [ ] **Step 4: Run final verification**

```powershell
Set-Location frontend
pnpm test:unit
pnpm test:e2e
pnpm lint
pnpm build
Set-Location ..
pytest -q tests/unit/test_graceful_shutdown.py tests/unit/test_feedback_api.py
```

Expected: all commands exit `0`; no Python API behavior changes occurred.

- [ ] **Step 5: Commit deploy-ready product UI**

```powershell
git add frontend docs/deployment/frontend.md
git commit -m "docs: add frontend deployment and verification guide"
```

## Plan self-review

### Spec coverage

- Template reuse without duplicate RAG: Tasks 1 and 6 remove template's direct AI paths and keep it as a UI shell.
- Clerk authentication and tenant isolation: Tasks 2, 3, 4, and 5.
- Existing FastAPI query, ingest, documents, and feedback APIs: Task 4 and Task 7.
- History and document display metadata in Neon: Task 5.
- Citations, guardrails, and financial metrics: Task 6.
- Upload, document management, and feedback: Task 7.
- Vercel + Render/Railway deployment and end-to-end verification: Task 8.
- No FastAPI RAG logic changes: explicit global constraint and final Python regression test.

### Consistency check

- All request handlers use `forwardRagRequest`.
- Tenant identity always uses `tenantId` derived by `tenantFromClaims`.
- Query payloads use `QueryRequest` and `QueryResponse`.
- UI-only persistence is separated from FastAPI document/vector persistence.

