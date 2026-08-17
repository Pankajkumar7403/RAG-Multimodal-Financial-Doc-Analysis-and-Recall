"use client";

import type { QueryResponse } from "@/lib/rag/contracts";

export function CitationDrawer({
  sources,
}: {
  sources: QueryResponse["sources"];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((source) => (
        <details
          key={`${source.document}-${source.page ?? "none"}-${source.text_preview}`}
        >
          <summary className="list-none">
            <button
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              type="button"
            >
              {source.document}
              {source.page ? ` · Page ${source.page}` : ""}
            </button>
          </summary>
          <div className="mt-2 max-w-md rounded-md border bg-muted/50 p-3 text-sm">
            {source.score !== null && source.score !== undefined ? (
              <p className="mb-1 text-muted-foreground text-xs">
                Relevance: {Math.round(source.score * 100)}%
              </p>
            ) : null}
            <p>{source.text_preview}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
