import { Suspense } from "react";
import { HomeAuthControls } from "@/components/workspace/home-auth-controls";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">
          Financial RAG Workspace
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sign in to upload financial PDFs and ask grounded questions with
          citations.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        }
      >
        <HomeAuthControls />
      </Suspense>
    </main>
  );
}
