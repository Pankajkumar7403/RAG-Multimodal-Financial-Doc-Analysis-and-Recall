"use client";

import { useCallback, useState } from "react";
import type { QueryResponse } from "@/lib/rag/contracts";

type FeedbackControlsProps = {
  answerText: string;
  latencyMs?: number;
  queryId: string;
  queryText: string;
  sources: QueryResponse["sources"];
};

export function FeedbackControls({
  answerText,
  latencyMs,
  queryId,
  queryText,
  sources,
}: FeedbackControlsProps) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const send = useCallback(
    async (rating: "thumbs_up" | "thumbs_down") => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await fetch("/api/rag/feedback", {
          body: JSON.stringify({
            answer_text: answerText,
            latency_ms: latencyMs,
            query_id: queryId,
            query_text: queryText,
            rating,
            sources,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.detail ?? "Feedback could not be saved.");
        }

        setSaved(true);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Feedback could not be saved."
        );
      } finally {
        setIsPending(false);
      }
    },
    [answerText, latencyMs, queryId, queryText, sources]
  );

  const sendUp = useCallback(() => send("thumbs_up"), [send]);
  const sendDown = useCallback(() => send("thumbs_down"), [send]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        disabled={isPending || saved}
        onClick={sendUp}
        type="button"
      >
        Helpful answer
      </button>
      <button
        className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
        disabled={isPending || saved}
        onClick={sendDown}
        type="button"
      >
        Unhelpful answer
      </button>
      {saved ? (
        <p className="text-muted-foreground text-xs">Feedback saved</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
