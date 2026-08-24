"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import type { CollaboratorDTO, PendingInviteDTO, Role } from "@local-first-docs/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ShareDialog({ documentId, isOwner }: { documentId: string; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorDTO[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteDTO[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Extract<Role, "editor" | "viewer">>("editor");
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${documentId}/collaborators`);
        const data = await res.json();
        if (cancelled) return;
        setCollaborators(data.collaborators ?? []);
        setPendingInvites(data.pendingInvites ?? []);
      } catch {
        if (!cancelled) toast.error("Could not load collaborators");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.result?.kind === "collaborator") {
        setCollaborators((prev) => [...prev.filter((c) => c.userId !== data.result.row.userId), data.result.row]);
      } else {
        setPendingInvites((prev) => [...prev.filter((i) => i.email !== email.trim()), data.result.row]);
      }
      setEmail("");
      toast.success("Invite sent");
    } catch {
      toast.error("Could not send invite");
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(userId: string, newRole: Extract<Role, "editor" | "viewer">) {
    const res = await fetch(`/api/documents/${documentId}/collaborators/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      toast.error("Could not update role");
      return;
    }
    setCollaborators((prev) => prev.map((c) => (c.userId === userId ? { ...c, role: newRole } : c)));
  }

  async function removeCollaborator(userId: string) {
    const res = await fetch(`/api/documents/${documentId}/collaborators/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove access");
      return;
    }
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
        </DialogHeader>

        {isOwner && (
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <Select value={role} onValueChange={(v) => setRole(v as "editor" | "viewer")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={invite} disabled={inviting}>
              Invite
            </Button>
          </div>
        )}

        <div className="space-y-1 max-h-80 overflow-y-auto">
          <Label className="text-xs text-muted-foreground">People with access</Label>
          {loading && <p className="text-sm text-muted-foreground py-2">Loading…</p>}
          {collaborators.map((c) => (
            <div key={c.userId} className="flex items-center gap-3 py-1.5">
              <Avatar className="size-8">
                <AvatarFallback>{(c.name ?? c.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name ?? c.email}</p>
                {c.name && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
              </div>
              {c.role === "owner" || !isOwner ? (
                <span className="text-xs text-muted-foreground capitalize pr-2">{c.role}</span>
              ) : (
                <>
                  <Select value={c.role} onValueChange={(v) => updateRole(c.userId, v as "editor" | "viewer")}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => removeCollaborator(c.userId)}>
                    Remove
                  </Button>
                </>
              )}
            </div>
          ))}

          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 py-1.5">
              <Avatar className="size-8">
                <AvatarFallback>{invite.email.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{invite.email}</p>
                <p className="text-xs text-muted-foreground">Invited — pending sign-in</p>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{invite.role}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
