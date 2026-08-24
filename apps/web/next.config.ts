import path from "node:path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

// Single source of truth: the repo-root .env (not a per-app copy). Next.js
// only auto-loads .env files from this directory, so load the root one
// explicitly before anything else reads process.env. No-ops harmlessly in
// deployed environments where env vars come from the platform instead.
dotenv.config({ path: path.join(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  // Required in a pnpm workspace so Vercel's file tracing picks up
  // packages/db and packages/shared, which live outside apps/web.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
