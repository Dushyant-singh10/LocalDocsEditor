"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, Save, Sparkles, RotateCcw } from "lucide-react";
import type { Role, VersionDTO } from "@local-first-docs/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function VersionTimeline({ documentId, role }: { documentId: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionDTO | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "editor";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`);
        const data = await res.json();
        if (!cancelled) setVersions(data.versions ?? []);
      } catch {
        if (!cancelled) toast.error("Could not load version history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  async function saveVersion() {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      const { version } = await res.json();
      setVersions((prev) => [version, ...prev]);
      setLabel("");
      toast.success("Version saved");
    } catch {
      toast.error("Could not save version");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${restoreTarget.id}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const { version } = await res.json();
      setVersions((prev) => [version, ...prev]);
      toast.success("Version restored");
    } catch {
      toast.error("Could not restore version");
    } finally {
      setRestoring(false);
      setRestoreTarget(null);
    }
  }

  async function summarize(versionId: string) {
    setSummarizing(versionId);
    try {
      const res = await fetch(`/api/ai/summarize-diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, versionId }),
      });
      if (!res.ok) throw new Error();
      const { summary } = await res.json();
      setSummaries((prev) => ({ ...prev, [versionId]: summary }));
    } catch {
      toast.error("Could not summarize changes");
    } finally {
      setSummarizing(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <History className="size-4" />
            History
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Version history</SheetTitle>
          </SheetHeader>

          {canEdit && (
            <div className="flex gap-2 px-4">
              <Input
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveVersion()}
              />
              <Button onClick={saveVersion} disabled={saving}>
                <Save className="size-4" />
                Save
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 px-4">
            {loading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
            {!loading && versions.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">No versions saved yet.</p>
            )}
            <ul className="space-y-3 py-2">
              {versions.map((v) => (
                <li key={v.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{v.label ?? "Untitled version"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()} · {v.createdByName ?? "Unknown"}
                      </p>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(v)}>
                        <RotateCcw className="size-3.5" />
                        Restore
                      </Button>
                    )}
                  </div>

                  {summaries[v.id] ? (
                    <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap">{summaries[v.id]}</p>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      disabled={summarizing === v.id}
                      onClick={() => summarize(v.id)}
                    >
                      <Sparkles className="size-3" />
                      {summarizing === v.id ? "Summarizing…" : "What changed since?"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This applies &ldquo;{restoreTarget?.label ?? "this version"}&rdquo; back onto the live document. It is
              recorded as a new version in the timeline, and any edits other collaborators are making right now are
              preserved, not overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={restoring}>
              {restoring ? "Restoring…" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
