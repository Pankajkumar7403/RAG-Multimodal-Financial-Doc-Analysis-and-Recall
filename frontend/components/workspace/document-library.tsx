"use client";

import { FileTextIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
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
    try {
      await onDeleted(document.source_uri);
    } finally {
      setIsDeleting(false);
    }
  }, [document.source_uri, onDeleted]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton className="h-auto py-2" tooltip={document.filename}>
        <FileTextIcon />
        <span className="truncate">{document.filename}</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        aria-label={`Delete ${document.filename}`}
        disabled={isDeleting}
        onClick={remove}
        showOnHover
      >
        <Trash2Icon />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

export function DocumentLibrary() {
  const [documents, setDocuments] = useState<ListedDocument[]>([]);
  const [error, setError] = useState<string>();
  const [listError, setListError] = useState<string>();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/rag/documents");
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setListError(payload.detail ?? "The document list could not be loaded.");
      return;
    }

    const listed = Array.isArray(payload.documents) ? payload.documents : [];
    setDocuments(
      listed.filter((document: ListedDocument) => !document.is_deleted)
    );
    setListError(undefined);
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

  const retryList = useCallback(() => {
    refresh().catch(() => {
      setListError("The document list could not be loaded.");
    });
  }, [refresh]);

  useEffect(() => {
    retryList();
  }, [retryList]);

  return (
    <>
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
        <div>
          <p className="font-medium text-sm">Documents</p>
          <p className="text-muted-foreground text-xs">
            Upload PDFs for grounded answers
          </p>
        </div>
        <UploadDocument onUploaded={refresh} />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            {listError ? (
              <div className="space-y-2 px-2 py-1">
                <p className="text-destructive text-xs">{listError}</p>
                <Button
                  className="h-7 px-2 text-xs"
                  onClick={retryList}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            ) : null}
            {!listError && documents.length === 0 ? (
              <p className="px-2 text-muted-foreground text-xs">
                No documents yet. Upload a PDF to get started.
              </p>
            ) : null}
            <SidebarMenu>
              {documents.map((document) => (
                <DocumentRow
                  document={document}
                  key={document.source_uri}
                  onDeleted={removeDocument}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
      </SidebarContent>
    </>
  );
}
