import { listDocumentsForUser } from "@local-first-docs/db";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { DocumentGrid } from "@/components/documents/document-grid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, LogOut } from "lucide-react";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const documents = await listDocumentsForUser(db, session.user.id);
  const displayName = session.user.name ?? session.user.email ?? "Account";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </div>
          <h1 className="text-sm font-semibold">Local-First Docs</h1>
        </div>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              <AvatarImage src={session.user.image ?? undefined} alt={displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium">{session.user.name ?? "Signed in"}</span>
              <span className="text-xs font-normal text-muted-foreground">{session.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex-1 p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Your documents</h2>
          <p className="text-sm text-muted-foreground">Create, edit, and share collaborative documents.</p>
        </div>
        <DocumentGrid initialDocuments={documents} />
      </div>
    </main>
  );
}
