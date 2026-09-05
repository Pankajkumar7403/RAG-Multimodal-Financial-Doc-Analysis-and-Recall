"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function HomeAuthControls() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="rounded-md border px-4 py-2 text-sm" type="button">
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
          href="/workspace"
        >
          Open workspace
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
