// src/db/schema.ts
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const results = sqliteTable("results", {
  id: text("id").primaryKey(),
  title: text("title"),
  author: text("author"),
  url: text("url"),
  denseSummary: text("dense_summary").notNull(),
  relevanceSummary: text("relevance_summary").notNull(),
  text: text("text").notNull(),
  relevanceScore: real("relevance_score").notNull(),
  queryPurpose: text("query_purpose").notNull(),
  queryQuestion: text("query_question").notNull(),
  publishedDate: text("published_date"),
  createdAt: integer("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const exaQueries = sqliteTable("exa_queries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  queryText: text("query_text").notNull(),
  category: text("category"),
  livecrawl: integer("livecrawl", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const queryResults = sqliteTable(
  "query_results",
  {
    queryId: integer("query_id").references(() => exaQueries.id),
    resultId: text("result_id").references(() => results.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.queryId, t.resultId] }),
  })
);

// Get TypeScript types from schema
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type ExaQuery = typeof exaQueries.$inferSelect;
export type NewExaQuery = typeof exaQueries.$inferInsert;
