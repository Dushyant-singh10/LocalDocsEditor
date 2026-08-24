import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FileText, GitBranch, Users, WifiOff } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";

const FEATURES = [
  {
    icon: WifiOff,
    title: "Local-first",
    description: "Edit instantly, even offline — changes sync the moment you're back online.",
  },
  {
    icon: Users,
    title: "Real-time collaboration",
    description: "Live cursors, presence, and per-document Owner/Editor/Viewer roles.",
  },
  {
    icon: GitBranch,
    title: "Full version history",
    description: "Save snapshots and restore safely, without losing anyone's in-flight edits.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileText className="size-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Local-First Docs</h1>
          <p className="text-muted-foreground max-w-sm text-balance">
            A collaborative document editor that works offline, syncs deterministically, and keeps a full version
            history.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" size="lg" className="w-full gap-2">
              <GithubIcon className="size-4" />
              Sign in with GitHub
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
