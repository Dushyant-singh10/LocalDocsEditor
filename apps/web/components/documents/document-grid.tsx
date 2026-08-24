"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import type { Role } from "@local-first-docs/shared";
import { Badge } from "@/components/ui/badge";

interface DocumentRow {
  id: string;
  title: string;
  updatedAt: Date;
  isArchived: boolean;
  role: Role;
}

export function DocumentGrid({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const [documents] = useState(initialDocuments);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function createDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document" }),
      });
      if (!res.ok) throw new Error("Failed to create document");
      const { document } = await res.json();
      router.push(`/documents/${document.id}`);
    } catch {
      toast.error("Could not create document");
      setCreating(false);
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <button
        onClick={createDocument}
        disabled={creating}
        className="flex flex-col items-center justify-center gap-2 aspect-[4/3] rounded-lg border-2 border-dashed text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-6" />
        <span className="text-sm font-medium">New document</span>
      </button>

      {documents.map((doc) => (
        <button
          key={doc.id}
          onClick={() => router.push(`/documents/${doc.id}`)}
          className="flex flex-col gap-2 aspect-[4/3] rounded-lg border p-4 text-left hover:shadow-md transition-shadow"
        >
          <FileText className="size-8 text-muted-foreground" />
          <div className="mt-auto space-y-1">
            <p className="font-medium truncate">{doc.title}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
              <Badge variant="secondary" className="capitalize">
                {doc.role}
              </Badge>
            </div>
          </div>
        </button>
      ))}

      {documents.length === 0 && (
        <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
          No documents yet — create your first one.
        </p>
      )}
    </div>
  );
}
