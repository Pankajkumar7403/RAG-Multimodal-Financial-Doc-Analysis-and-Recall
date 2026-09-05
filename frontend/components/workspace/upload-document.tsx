"use client";

import { PaperclipIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DocumentStatus = "uploading" | "ready" | "failed";

export function UploadDocument({
  className,
  compact = false,
  onUploaded,
}: {
  className?: string;
  compact?: boolean;
  onUploaded: () => Promise<void> | void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<DocumentStatus>("ready");

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setStatus("failed");
        setError("Only PDF documents can be uploaded.");
        return;
      }

      setError(undefined);
      setStatus("uploading");

      const formData = new FormData();
      formData.set("file", file);
      formData.set("process_vision", "true");

      try {
        const response = await fetch("/api/rag/ingest", {
          body: formData,
          method: "POST",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.detail ?? "The document could not be uploaded."
          );
        }

        setStatus("ready");
        await onUploaded();
      } catch (caughtError) {
        setStatus("failed");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The document could not be uploaded."
        );
      }
    },
    [onUploaded]
  );

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await uploadFile(file);
    },
    [uploadFile]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        aria-label="Upload PDF"
        className="sr-only"
        disabled={false}
        id={inputId}
        onChange={handleFile}
        ref={inputRef}
        type="file"
      />
      {compact ? (
        <Button
          aria-label="Upload PDF"
          onClick={openPicker}
          size="icon"
          type="button"
          variant="ghost"
        >
          <PaperclipIcon className="size-4" />
        </Button>
      ) : (
        <Button
          className="w-full justify-start gap-2"
          onClick={openPicker}
          type="button"
          variant="outline"
        >
          <PaperclipIcon className="size-4" />
          {status === "uploading" ? "Uploading PDF…" : "Upload PDF"}
        </Button>
      )}
      {!compact && status === "uploading" ? (
        <p className="text-muted-foreground text-xs">Uploading…</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
