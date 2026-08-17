import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { ChatPanel } from "@/components/workspace/chat-panel";

export function Workspace() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-semibold text-lg">Financial RAG Workspace</h1>
          <p className="text-muted-foreground text-sm">
            Upload financial documents and ask grounded questions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal={false} />
          <UserButton />
        </div>
      </header>
      <ChatPanel />
    </main>
  );
}
