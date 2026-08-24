import { NextResponse } from "next/server";
import { ForbiddenError, NotFoundError } from "./rbac";

export function errorResponse(error: unknown) {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  console.error(error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
