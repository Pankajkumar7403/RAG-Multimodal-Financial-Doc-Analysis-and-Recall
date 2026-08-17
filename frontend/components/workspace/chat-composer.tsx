"use client";

import { useCallback, useState } from "react";

export function ChatComposer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (query: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft.trim() || disabled) {
        return;
      }
      await onSubmit(draft.trim());
      setDraft("");
    },
    [disabled, draft, onSubmit]
  );

  const updateDraft = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value);
    },
    []
  );

  return (
    <form className="flex gap-2 border-t p-4" onSubmit={submit}>
      <label className="sr-only" htmlFor="rag-question">
        Ask a question
      </label>
      <input
        className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        disabled={disabled}
        id="rag-question"
        onChange={updateDraft}
        placeholder="Ask about your uploaded financial documents…"
        value={draft}
      />
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-60"
        disabled={disabled || !draft.trim()}
        type="submit"
      >
        Ask
      </button>
    </form>
  );
}
