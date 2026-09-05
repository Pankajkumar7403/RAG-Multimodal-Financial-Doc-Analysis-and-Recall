export function formatRagError(detail: string): string {
  const normalized = detail.toLowerCase();

  if (
    normalized.includes("413") ||
    normalized.includes("payload too large") ||
    normalized.includes("context was too large") ||
    normalized.includes("too large for the ai provider")
  ) {
    return "That question pulled too much text from your documents at once. Try something narrower, like “What was Q2 revenue?” or “Summarize the risk factors section.”";
  }

  if (normalized.includes("monthly token quota")) {
    return "Your workspace has reached its monthly usage limit. Try again later or contact your admin.";
  }

  if (normalized.includes("rag service unavailable")) {
    return "The analysis service is starting up. Please wait a moment and try again.";
  }

  return detail;
}
