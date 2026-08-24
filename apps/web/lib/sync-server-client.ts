interface SnapshotResponse {
  contentJson: Record<string, unknown>;
  stateSnapshot: string; // base64
}

function internalUrl(path: string): string {
  const base = process.env.SYNC_SERVER_INTERNAL_URL;
  if (!base) throw new Error("SYNC_SERVER_INTERNAL_URL is not set");
  return new URL(path, base).toString();
}

function authHeaders(): HeadersInit {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) throw new Error("INTERNAL_SYNC_SECRET is not set");
  return { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
}

export async function requestSnapshot(documentId: string): Promise<SnapshotResponse> {
  const res = await fetch(internalUrl(`/internal/documents/${documentId}/snapshot`), {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`sync-server snapshot request failed: ${res.status}`);
  }
  return res.json();
}

export async function requestRestore(
  documentId: string,
  params: { contentJson: unknown; userId: string; versionId: string },
): Promise<SnapshotResponse> {
  const res = await fetch(internalUrl(`/internal/documents/${documentId}/restore`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`sync-server restore request failed: ${res.status}`);
  }
  return res.json();
}
