"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useCallback, useState } from "react";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ChatHistory } from "@/components/workspace/chat-history";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { DocumentLibrary } from "@/components/workspace/document-library";

export function Workspace() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyEpoch, setHistoryEpoch] = useState(0);
  const [libraryEpoch, setLibraryEpoch] = useState(0);

  const refreshHistory = useCallback(() => {
    setHistoryEpoch((value) => value + 1);
  }, []);

  const refreshLibrary = useCallback(() => {
    setLibraryEpoch((value) => value + 1);
  }, []);

  const startNewChat = useCallback(() => {
    setConversationId(null);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="border-r" collapsible="icon" variant="inset">
        <ChatHistory
          activeConversationId={conversationId}
          onNewChat={startNewChat}
          onSelectConversation={setConversationId}
          refreshKey={historyEpoch}
        />
        <DocumentLibrary key={libraryEpoch} />
      </Sidebar>
      <SidebarInset className="min-h-dvh bg-background">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="font-semibold text-sm md:text-base">
                Financial RAG Workspace
              </h1>
              <p className="hidden text-muted-foreground text-xs sm:block">
                Upload financial documents and ask grounded questions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <OrganizationSwitcher hidePersonal={false} />
            <UserButton />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPanel
            conversationId={conversationId}
            onConversationChange={setConversationId}
            onDocumentUploaded={refreshLibrary}
            onHistoryUpdated={refreshHistory}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
