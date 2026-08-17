import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

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
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-medium text-xl">
          Your document workspace is ready.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Chat, document upload, and source citations are being connected to the
          RAG API.
        </p>
      </section>
    </main>
  );
}
