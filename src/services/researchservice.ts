// src/services/ResearchService.ts
import { eq, desc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { WordIdGenerator } from "../utils/WordIdGenerator";
import { ResearchResults } from "../types";
import * as schema from "../db/schema";

export class ResearchService {
  constructor(
    private db: BunSQLiteDatabase<typeof schema>,
    private wordIdGenerator: WordIdGenerator
  ) {}

  async storeResults(
    results: ResearchResults,
    purpose: string,
    question: string
  ) {
    await this.db.transaction(async (tx) => {
      for (const queryResult of results.queryResults) {
        for (let i = 0; i < queryResult.rawResults.length; i++) {
          const raw = queryResult.rawResults[i];
          const summarized = queryResult.summarizedResults[i];

          // Insert or update result
          await tx
            .insert(schema.results)
            .values({
              id: raw.id,
              title: raw.title,
              author: raw.author,
              url: raw.url,
              denseSummary: summarized.denseSummary,
              relevanceSummary: summarized.relevanceSummary,
              text: raw.text,
              relevanceScore: raw.score,
              queryPurpose: purpose,
              queryQuestion: question,
              publishedDate: raw.publishedDate,
            })
            .onConflictDoUpdate({
              target: schema.results.id,
              set: {
                updatedAt: new Date().getTime(),
              },
            });

          // Create query-result relationship
          await tx
            .insert(schema.queryResults)
            .values({
              queryId: queryResult.queryId,
              resultId: raw.id,
            })
            .onConflictDoNothing();
        }
      }
    });
  }

  async listResources(limit = 25): Promise<schema.Result[]> {
    return await this.db.query.results.findMany({
      orderBy: [
        desc(schema.results.relevanceScore),
        desc(schema.results.createdAt),
      ],
      limit,
    });
  }

  async getResource(resultId: string): Promise<schema.Result> {
    const result = await this.db.query.results.findFirst({
      where: eq(schema.results.id, resultId),
    });

    if (!result) {
      throw new Error(`Result not found: ${resultId}`);
    }

    return result;
  }

  async getFullTexts(resultIds: string[]): Promise<schema.Result[]> {
    return await this.db.query.results.findMany({
      where: (results, { inArray }) => inArray(results.id, resultIds),
    });
  }
}
