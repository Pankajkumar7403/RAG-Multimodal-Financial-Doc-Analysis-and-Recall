"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadDocument } from "@/components/workspace/upload-document";

type ListedDocument = {
  filename: string;
  is_deleted?: boolean;
  page_count?: number;
  source_uri: string;
};

function DocumentRow({
  document,
  onDeleted,
}: {
  document: ListedDocument;
  onDeleted: (documentId: string) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const remove = useCallback(async () => {
    setIsDeleting(true);
    await onDeleted(document.source_uri);
    setIsDeleting(false);
  }, [document.source_uri, onDeleted]);

  return (
    <li className="flex items-start justify-between gap-2 rounded-md border p-3">
      <div>
        <p className="font-medium text-sm">{document.filename}</p>
        <p className="text-muted-foreground text-xs">ready</p>
      </div>
      <button
        className="text-destructive text-xs disabled:opacity-60"
        disabled={isDeleting}
        onClick={remove}
        type="button"
      >
        Delete
      </button>
    </li>
  );
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<ListedDocument[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/rag/documents");
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.detail ?? "The document list could not be loaded.");
      return;
    }

    const listed = Array.isArray(payload.documents) ? payload.documents : [];
    setDocuments(
      listed.filter((document: ListedDocument) => !document.is_deleted)
    );
    setError(undefined);
  }, []);

  const removeDocument = useCallback(
    async (documentId: string) => {
      const response = await fetch(
        `/api/rag/documents/${encodeURIComponent(documentId)}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.detail ?? "The document could not be deleted.");
        return;
      }

      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh().catch(() => {
      setError("The document list could not be loaded.");
    });
  }, [refresh]);

  return (
    <aside className="border-r p-4">
      <h2 className="mb-4 font-semibold text-sm">Documents</h2>
      <UploadDocument onUploaded={refresh} />
      {error ? <p className="mt-3 text-destructive text-xs">{error}</p> : null}
      <ul className="mt-4 space-y-2">
        {documents.map((document) => (
          <DocumentRow
            document={document}
            key={document.source_uri}
            onDeleted={removeDocument}
          />
        ))}
      </ul>
    </aside>
  );
}
