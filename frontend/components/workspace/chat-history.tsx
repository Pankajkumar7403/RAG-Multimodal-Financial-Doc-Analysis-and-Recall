"use client";

import { MessageSquarePlusIcon, MessagesSquareIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { WorkspaceConversation } from "@/lib/workspace/contracts";
import { cn } from "@/lib/utils";

function formatWhen(value?: string | Date) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

export function ChatHistory({
  activeConversationId,
  onNewChat,
  onSelectConversation,
  refreshKey = 0,
}: {
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  refreshKey?: number;
}) {
  const [conversations, setConversations] = useState<WorkspaceConversation[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/workspace/conversations");
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          payload.detail ??
            "Chat history could not be loaded. Check your database configuration."
        );
        setConversations([]);
        return;
      }

      setConversations(
        Array.isArray(payload.conversations) ? payload.conversations : []
      );
      setError(undefined);
    } catch {
      setError("Chat history could not be loaded.");
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setError("Chat history could not be loaded.");
      setIsLoading(false);
    });
  }, [refresh, refreshKey]);

  return (
    <>
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-3">
        <div>
          <p className="font-medium text-sm">Chats</p>
          <p className="text-muted-foreground text-xs">
            Resume prior questions and answers
          </p>
        </div>
        <Button
          className="justify-start gap-2"
          onClick={onNewChat}
          type="button"
          variant="outline"
        >
          <MessageSquarePlusIcon className="size-4" />
          New chat
        </Button>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </SidebarHeader>
      <SidebarGroup>
        <SidebarGroupLabel>History</SidebarGroupLabel>
        <SidebarGroupContent>
          {isLoading ? (
            <p className="px-2 text-muted-foreground text-xs">Loading chats…</p>
          ) : null}
          {!isLoading && !error && conversations.length === 0 ? (
            <p className="px-2 text-muted-foreground text-xs">
              Your questions will appear here after you send the first message.
            </p>
          ) : null}
          <SidebarMenu>
            {conversations.map((conversation) => (
              <SidebarMenuItem key={conversation.id}>
                <SidebarMenuButton
                  className={cn(
                    "h-auto flex-col items-start gap-0.5 py-2",
                    activeConversationId === conversation.id && "bg-sidebar-accent"
                  )}
                  isActive={activeConversationId === conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  tooltip={conversation.title}
                >
                  <span className="flex w-full items-center gap-2">
                    <MessagesSquareIcon className="size-4 shrink-0" />
                    <span className="truncate">{conversation.title}</span>
                  </span>
                  <span className="pl-6 text-muted-foreground text-[11px]">
                    {formatWhen(conversation.updatedAt ?? conversation.createdAt)}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
    </>
  );
}
