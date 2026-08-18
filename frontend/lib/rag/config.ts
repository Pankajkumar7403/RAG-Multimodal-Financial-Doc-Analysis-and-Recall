import "server-only";

type RagEnvironment = Partial<
  Record<"RAG_API_URL" | "RAG_API_MASTER_KEY", string>
>;

export function getRagConfig(
  environment: RagEnvironment = {
    RAG_API_MASTER_KEY: process.env.RAG_API_MASTER_KEY,
    RAG_API_URL: process.env.RAG_API_URL,
  }
) {
  const url = environment.RAG_API_URL?.replace(/\/+$/, "");
  const apiKey = environment.RAG_API_MASTER_KEY;

  if (!url) {
    throw new Error("RAG_API_URL is required");
  }

  if (!apiKey) {
    throw new Error("RAG_API_MASTER_KEY is required");
  }

  return { apiKey, url };
}
