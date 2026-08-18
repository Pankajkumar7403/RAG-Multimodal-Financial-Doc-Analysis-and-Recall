import { SignIn } from "@clerk/nextjs";
import { connection } from "next/server";
import { Suspense } from "react";

async function SignInForm() {
  await connection();
  return <SignIn />;
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
