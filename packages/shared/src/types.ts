export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export function roleAtLeast(role: Role, minimum: Role): boolean {
  const order: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
  return order[role] >= order[minimum];
}

export interface DocumentDTO {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  myRole: Role;
}

export interface CollaboratorDTO {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
}

export interface PendingInviteDTO {
  id: string;
  email: string;
  role: Role;
}

export interface VersionDTO {
  id: string;
  documentId: string;
  label: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  restoredFromVersionId: string | null;
}

export interface RealtimeTokenPayload {
  sub: string; // userId
  documentId: string;
  role: Role;
}
