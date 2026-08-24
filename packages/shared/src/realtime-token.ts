import { SignJWT, jwtVerify } from "jose";
import type { RealtimeTokenPayload, Role } from "./types.js";

const ALG = "HS256";
const TTL_SECONDS = 60;

function getSecret(): Uint8Array {
  const secret = process.env.REALTIME_JWT_SECRET;
  if (!secret) {
    throw new Error("REALTIME_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signRealtimeToken(params: {
  userId: string;
  documentId: string;
  role: Role;
}): Promise<string> {
  return new SignJWT({ documentId: params.documentId, role: params.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyRealtimeToken(token: string): Promise<RealtimeTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
  if (typeof payload.sub !== "string" || typeof payload.documentId !== "string" || typeof payload.role !== "string") {
    throw new Error("Malformed realtime token payload");
  }
  return {
    sub: payload.sub,
    documentId: payload.documentId as string,
    role: payload.role as Role,
  };
}
