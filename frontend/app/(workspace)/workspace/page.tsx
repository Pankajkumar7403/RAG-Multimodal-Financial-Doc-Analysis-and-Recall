import { connection } from "next/server";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";

async function AuthenticatedWorkspace() {
  await connection();
  return <Workspace />;
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <AuthenticatedWorkspace />
    </Suspense>
  );
}
