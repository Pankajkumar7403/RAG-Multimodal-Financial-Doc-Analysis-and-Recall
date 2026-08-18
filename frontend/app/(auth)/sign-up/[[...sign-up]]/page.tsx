import { SignUp } from "@clerk/nextjs";
import { connection } from "next/server";
import { Suspense } from "react";

async function SignUpForm() {
  await connection();
  return <SignUp />;
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
