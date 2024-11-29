import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

// Create database connection with WAL mode for better concurrent performance
const sqlite = new Database("results.db", { create: true });
sqlite.run("PRAGMA journal_mode = WAL;");

// Create db instance
export const db = drizzle(sqlite);

// Initialize database using Drizzle migrations
export async function initDb() {
  const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
}

// Export types
export type DB = typeof db;
