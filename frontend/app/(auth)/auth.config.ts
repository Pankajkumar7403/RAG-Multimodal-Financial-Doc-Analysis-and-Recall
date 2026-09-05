import type { NextAuthConfig } from "next-auth";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const authConfig = {
  basePath: "/api/auth",
  callbacks: {},
  pages: {
    newUser: `${base}/`,
    signIn: `${base}/login`,
  },
  providers: [],
  // Legacy Auth.js leftover from the Vercel chatbot template.
  // Product auth is Clerk; this secret only prevents MissingSecret crashes
  // if unused Auth.js routes are still imported during compilation.
  secret:
    process.env.AUTH_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    "dev-unused-authjs-secret",
  trustHost: true,
} satisfies NextAuthConfig;
