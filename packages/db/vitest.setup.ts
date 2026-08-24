import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Vitest doesn't auto-load .env files the way Next.js does — load the
// repo-root .env explicitly so TEST_DATABASE_URL (and anything else) is
// actually visible to test-utils.ts's `hasTestDb` check.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../.env") });
