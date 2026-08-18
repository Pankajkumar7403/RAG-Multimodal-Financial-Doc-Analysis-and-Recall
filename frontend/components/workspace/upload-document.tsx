"use client";

import { useCallback, useState } from "react";

export type DocumentStatus = "uploading" | "ready" | "failed";

export function UploadDocument({
  onUploaded,
}: {
  onUploaded: () => Promise<void> | void;
}) {
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<DocumentStatus>("ready");

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

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

  return (
    <div className="space-y-2">
      <label className="block font-medium text-sm" htmlFor="upload-pdf">
        Upload PDF
      </label>
      <input
        className="block w-full text-sm"
        disabled={status === "uploading"}
        id="upload-pdf"
        onChange={handleFile}
        type="file"
      />
      {status === "uploading" ? (
        <p className="text-muted-foreground text-xs">Uploading…</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
