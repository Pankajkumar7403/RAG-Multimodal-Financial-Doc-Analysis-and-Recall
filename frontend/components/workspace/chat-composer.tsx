"use client";

import { FileTextIcon, PaperclipIcon, XIcon } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ComposerAttachment = {
  error?: string;
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "ready" | "failed";
};

function ProgressRing({ progress }: { progress: number }) {
  const size = 28;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(progress, 100));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      aria-hidden
      className="size-7 -rotate-90"
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        className="text-muted-foreground/25"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeWidth={stroke}
      />
      <circle
        className="text-foreground transition-[stroke-dashoffset] duration-300 ease-out"
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth={stroke}
      />
    </svg>
  );
}

function AttachmentPill({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: (id: string) => void;
}) {
  const remove = useCallback(() => {
    onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  return (
    <div
      className={cn(
        "group relative flex max-w-[16rem] items-center gap-2.5 rounded-2xl border border-border/40 bg-muted/50 px-2.5 py-2",
        attachment.status === "failed" && "border-destructive/40"
      )}
    >
      <div className="relative flex size-7 shrink-0 items-center justify-center">
        {attachment.status === "uploading" ? (
          <ProgressRing progress={attachment.progress} />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-background">
            <FileTextIcon className="size-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-xs leading-tight">
          {attachment.name}
        </p>
        <p className="mt-0.5 text-muted-foreground text-[11px] leading-tight">
          {attachment.status === "uploading"
            ? "Uploading…"
            : attachment.status === "failed"
              ? (attachment.error ?? "Upload failed")
              : "PDF"}
        </p>
      </div>
      <button
        aria-label={`Remove ${attachment.name}`}
        className="rounded-full p-1 text-muted-foreground opacity-70 transition hover:bg-background hover:opacity-100"
        onClick={remove}
        type="button"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

export function ChatComposer({
  disabled,
  onSubmit,
  onUploaded,
}: {
  disabled: boolean;
  onSubmit: (query: string) => Promise<void>;
  onUploaded?: () => Promise<void> | void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [draft, setDraft] = useState("");
  const submittingRef = useRef(false);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();

      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        setAttachments((current) => [
          ...current,
          {
            error: "Only PDF documents can be uploaded.",
            id,
            name: file.name,
            progress: 0,
            status: "failed",
          },
        ]);
        return;
      }

      setAttachments((current) => [
        ...current,
        {
          id,
          name: file.name,
          progress: 8,
          status: "uploading",
        },
      ]);

      const progressTimer = window.setInterval(() => {
        setAttachments((current) =>
          current.map((item) =>
            item.id === id && item.status === "uploading"
              ? {
                  ...item,
                  progress: Math.min(item.progress + 9, 92),
                }
              : item
          )
        );
      }, 400);

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

        setAttachments((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, progress: 100, status: "ready" as const }
              : item
          )
        );
        await onUploaded?.();
      } catch (caughtError) {
        setAttachments((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error:
                    caughtError instanceof Error
                      ? caughtError.message
                      : "The document could not be uploaded.",
                  progress: 0,
                  status: "failed" as const,
                }
              : item
          )
        );
      } finally {
        window.clearInterval(progressTimer);
      }
    },
    [onUploaded]
  );

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.target.files ?? [])];
      event.target.value = "";
      for (const file of files) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text || disabled || submittingRef.current) {
        return;
      }
      submittingRef.current = true;
      try {
        await onSubmit(text);
        setDraft("");
      } finally {
        submittingRef.current = false;
      }
    },
    [disabled, onSubmit]
  );

  const updateDraft = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <input
        accept="application/pdf,.pdf"
        aria-label="Upload PDF"
        className="sr-only"
        id={inputId}
        multiple
        onChange={handleFile}
        ref={inputRef}
        type="file"
      />
      <PromptInput
        className="[&>div]:rounded-3xl [&>div]:border [&>div]:border-border/30 [&>div]:bg-card/80 [&>div]:shadow-sm [&>div]:transition-shadow [&>div]:duration-300 [&>div]:focus-within:shadow-md"
        onSubmit={handleSubmit}
      >
        {attachments.length > 0 ? (
          <div className="flex w-full flex-wrap gap-2 px-3 pt-3">
            {attachments.map((attachment) => (
              <AttachmentPill
                attachment={attachment}
                key={attachment.id}
                onRemove={removeAttachment}
              />
            ))}
          </div>
        ) : null}
        <PromptInputTextarea
          className="min-h-24 px-4 pt-3.5 pb-1.5 text-[13px] leading-relaxed placeholder:text-muted-foreground/50"
          disabled={disabled}
          onChange={updateDraft}
          placeholder="Ask anything…"
          value={draft}
        />
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools>
            <Button
              aria-label="Upload PDF"
              onClick={openPicker}
              size="icon"
              type="button"
              variant="ghost"
            >
              <PaperclipIcon className="size-4" />
            </Button>
          </PromptInputTools>
          <PromptInputSubmit
            className={cn(
              "size-7 rounded-full transition-all duration-200",
              draft.trim() && !disabled
                ? "bg-foreground text-background hover:opacity-85"
                : "cursor-not-allowed bg-muted text-muted-foreground/25"
            )}
            disabled={disabled || !draft.trim()}
            status={disabled ? "submitted" : undefined}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
