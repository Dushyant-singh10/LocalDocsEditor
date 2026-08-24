import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Must be imported (not just required inline) as the very first import in
// index.ts: ES modules fully evaluate every import before the importing
// module's own body runs, so an inline `dotenv.config()` call inside
// index.ts would run too late — after db.ts (pulled in transitively via the
// other imports) already read process.env.DATABASE_URL at its own module
// scope. Putting the side effect in its own imported module fixes the order.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });
