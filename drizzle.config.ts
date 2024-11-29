// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite", // Use SQLite dialect since we're using Bun's SQLite
} satisfies Config;
