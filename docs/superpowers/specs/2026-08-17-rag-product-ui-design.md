# RAG Product UI — Design Spec

**Date:** 2026-08-17  
**Status:** Approved for planning (pending final user review of this file)  
**Goal:** Ship a multi-user financial RAG product UI without rewriting the FastAPI backend and without spending a week on custom frontend from scratch.

---

## 1. Problem

The FastAPI RAG API is working (`/api/v1/ingest`, `/query`, `/documents`, `/feedback`). The existing Streamlit `demo/` is fine for demos but is not a multi-user product UI.

We need:

- Clerk-based sign-in (email/password or Google)
- Per-user / per-org document isolation
- Chat with citations, chat history, document workspace
- Financial analysis cards from existing query payload (`sources`, `guardrails`, `metrics`)
- Deployable product: Next.js on Vercel + FastAPI on Render/Railway
- Fast delivery: reuse an existing AI chat UI shell; do **not** rebuild RAG in Next.js

---

## 2. Non-goals (MVP)

- Replacing FastAPI retrieval, embeddings, vision, or guardrails with Vercel AI SDK / pgvector
- Exposing `RAG_API_MASTER_KEY` or FastAPI credentials to the browser
- Token streaming from FastAPI (v1 uses request/response JSON)
- In-chat PDF page image preview / PDF.js viewer
- Billing, usage quotas UI, or roles beyond Clerk Organizations
- Distorting backend RAG logic to match a frontend template’s API shape

---

## 3. Approach (chosen)

**Base UI:** [Vercel Chatbot template](https://vercel.com/templates/next.js/chatbot)  
**Auth:** Clerk (replace Auth.js)  
**Backend:** Existing FastAPI RAG API (unchanged contract)  
**Bridge:** Next.js Route Handlers as authenticated server-side proxies  

Official Vercel “RAG” templates (Postgres/pgvector, Azure Search, MongoDB, Upstash) rebuild the RAG stack inside Next.js. That would duplicate and fight this project’s multimodal pipeline. We keep only the **product shell** (chat layout, history, upload UX, shadcn components) and point it at our API.

---

## 4. Architecture

```text
Browser
  └─ Clerk session + Next.js UI (Vercel)
       └─ Protected Next.js API routes (server only)
            ├─ Validate Clerk session
            ├─ Derive tenant_id = orgId ?? userId
            ├─ Attach X-API-Key (server env) + X-Tenant-ID
            └─ Forward to FastAPI
                 └─ Existing RAG API (Render / Railway)
                       /api/v1/ingest
                       /api/v1/query
                       /api/v1/documents
                       /api/v1/feedback
```

### Security invariants

1. Browser never receives `RAG_API_MASTER_KEY` or direct write access to FastAPI with a master key.
2. Browser never chooses `tenant_id`. Tenant is derived only from Clerk on the server.
3. FastAPI continues to use existing `APIKeyMiddleware` (`X-API-Key` + optional `X-Tenant-ID`). That header model is safe **because** only the Next.js proxy calls FastAPI with the master key.
4. Production CORS on FastAPI should allow only the Vercel origin(s); proxy traffic is server-to-server so CORS is secondary, but locking origins still reduces accidental browser exposure if someone discovers the API URL.
5. Safe error shape to clients: `{ "detail": string }` — no stack traces or secrets.

---

## 5. Product surface

### Public

| Route | Purpose |
|---|---|
| `/` | Landing: product name, one sentence, Sign in / Get started |
| `/sign-in`, `/sign-up` | Clerk-hosted auth flows |

### Authenticated

| Route | Purpose |
|---|---|
| `/workspace` | Main app: chat + docs |
| `/workspace?chat=<id>` | Open a saved conversation |

### Layout

- **Left:** chat history list + document library
- **Center:** chat thread (answers, citation chips, thumbs)
- **Right drawer (on demand):** source chunks / page refs + financial metrics from `guardrails` / `metrics`
- **Top:** Clerk user button + org switcher (if orgs enabled)

### Primary flows

1. Sign in → empty workspace + upload CTA  
2. Upload PDF → proxy → `POST /api/v1/ingest` → status in document list  
3. Ask question → proxy → `POST /api/v1/query` → answer + sources + analysis cards  
4. Thumbs up/down → proxy → `POST /api/v1/feedback`  
5. Reopen prior chat from history (UI DB only)

---

## 6. Frontend ↔ FastAPI proxy contract

All browser calls go to Next.js. Next.js calls FastAPI.

| Next.js route | FastAPI target | Notes |
|---|---|---|
| `POST /api/rag/query` | `POST /api/v1/query` | Body: `{ query, top_k?, filters? }`. Server injects `tenant_id`. |
| `POST /api/rag/ingest` | `POST /api/v1/ingest` | `multipart/form-data` file + `process_vision`. Server injects tenant. |
| `GET /api/rag/documents` | `GET /api/v1/documents` | Lists docs for derived tenant. |
| `DELETE /api/rag/documents/[id]` | `DELETE /api/v1/documents/{doc_id}` | Soft-delete for derived tenant. |
| `POST /api/rag/feedback` | `POST /api/v1/feedback` | Maps thumbs UI to existing feedback schema. |

### Proxy behavior (every route)

1. Require Clerk session; return `401` if missing.  
2. Compute `tenant_id = auth.orgId ?? auth.userId`.  
3. Call FastAPI with headers:
   - `X-API-Key: process.env.RAG_API_MASTER_KEY`
   - `X-Tenant-ID: <tenant_id>`
4. Forward only allowlisted fields.  
5. On FastAPI `503` / network error → user-safe “RAG service unavailable”.  
6. On FastAPI `4xx/5xx` → normalize to `{ detail }` without leaking internals.

### Query response mapping (UI)

Use existing FastAPI fields; do not invent a new backend schema.

- `answer` → main assistant message  
- `sources[]` → citation chips + drawer (page, score, snippet when present)  
- `guardrails` → financial grounding / analysis cards  
- `metrics` → latency / cost chips when present  
- Persist full payload on the assistant message row for history replay  

Streaming is **out of scope for v1**. Show a loading / “thinking” state until JSON returns.

---

## 7. Frontend data model (Neon Postgres)

UI-only persistence. FastAPI remains source of truth for vectors and ingested chunks.

### Tables (conceptual)

**conversations**

- `id` (uuid)
- `tenant_id` (text, Clerk org or user id)
- `user_id` (text, Clerk user id)
- `title` (text)
- `created_at`, `updated_at`

**messages**

- `id` (uuid)
- `conversation_id` (fk)
- `role` (`user` | `assistant` | `system`)
- `content` (text)
- `rag_payload` (jsonb, nullable — full FastAPI query result for assistant turns)
- `created_at`

**documents_meta** (display / linking only)

- `id` (uuid)
- `tenant_id`
- `backend_doc_id` (text, from FastAPI ingest/list)
- `filename`
- `status` (`uploading` | `ready` | `failed`)
- `error_detail` (nullable)
- `created_at`, `updated_at`

All reads/writes scoped by `tenant_id` from Clerk.

Chat history does **not** live in FastAPI for MVP.

---

## 8. Template adaptation plan

Start from Vercel Chatbot template, then:

1. Replace Auth.js with Clerk (`@clerk/nextjs`, middleware, sign-in/up pages).  
2. Keep chat shell, sidebar, message list, mobile layout, shadcn primitives.  
3. Remove or disable:
   - Direct AI Gateway / model provider chat routes
   - Local embedding / retrieval / vector DB usage
   - Any template RAG tools that invent a second knowledge base  
4. Add thin adapters:
   - `lib/rag/client.ts` — server-only FastAPI fetch helpers  
   - `app/api/rag/*` — proxy routes  
   - Citation drawer + metrics cards components  
   - Upload panel wired to `/api/rag/ingest`  
5. Wire message send path: save user message → call `/api/rag/query` → save assistant message with `rag_payload` → render.

Repo placement: `frontend/` at repository root (sibling to `src/`, `demo/`), so monorepo keeps API and UI together without mixing Python and Next.js packages.

---

## 9. Deployment

### Vercel (Next.js)

**Public env**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / sign-up URLs as needed

**Server-only env**

- `CLERK_SECRET_KEY`
- `DATABASE_URL` (Neon)
- `RAG_API_URL` (e.g. `https://api.example.com`)
- `RAG_API_MASTER_KEY`

### Render / Railway (FastAPI)

- Existing model / vector / Redis / storage config from current `.env` pattern
- `RAG_API_MASTER_KEY` (must match Vercel server env)
- `DEBUG=false`
- Production CORS origins restricted to Vercel domain(s)
- Health: `/health` / `/readyz` for platform probes

### Domains

- Product UI: custom domain → Vercel  
- API: platform subdomain or `api.` subdomain → FastAPI  
- Prefer treating FastAPI as backend-only (key-gated); do not document public browser usage of the master key.

---

## 10. UX states

- Empty workspace with example finance questions  
- Upload: progress, type/size validation (PDF), retry on failure  
- Ingest failed: clear error in document list  
- Query loading: non-streaming thinking indicator  
- Query `503`: “RAG service unavailable — try again shortly”  
- Query other failures: safe `detail` message only  
- Citations: chips open drawer; missing page/score still renders gracefully  

---

## 11. Testing plan

### Unit (Next.js)

- Tenant derivation: org present → orgId; else userId  
- Proxy injects `X-API-Key` and `X-Tenant-ID`; rejects unauthenticated  
- Upstream error normalization  

### Integration / E2E

- Unauthenticated user redirected from `/workspace`  
- Upload → document appears as ready (against staging API or mocked proxy)  
- Query → answer + at least one citation chip when sources returned  
- Feedback posts successfully  
- Two tenants cannot see each other’s documents/history  

### Deploy smoke

- Health check FastAPI  
- Authenticated query via production UI proxy  
- Confirm browser Network tab shows only `/api/rag/*`, not FastAPI master key headers  

---

## 12. Implementation order (for planning)

1. Scaffold `frontend/` from Chatbot template  
2. Clerk auth + protected `/workspace`  
3. Neon schema for conversations / messages / documents_meta  
4. FastAPI proxy routes + server client  
5. Wire upload + document list  
6. Wire chat query + citation/metrics UI  
7. Feedback + history reopen  
8. Deploy Vercel + Render/Railway; env hardening; smoke tests  

Backend code changes for MVP: **none required** for RAG logic. Optional later hardening (JWT verification inside FastAPI) is explicitly deferred so we do not distort the backend for the frontend.

---

## 13. Success criteria

- A signed-in user can upload a financial PDF, ask a question, see an answer with citations and metrics cards, rate the answer, and reopen the chat later.  
- Documents and history are isolated per Clerk user/org.  
- FastAPI remains the only RAG engine.  
- UI ships from a template shell with thin adapters, not a greenfield design system.
