export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Legacy Vercel chatbot shell no longer uses Auth.js.
  // Product auth is Clerk; keep this layout as a pass-through.
  return children;
}
