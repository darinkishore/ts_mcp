// src/services/ResearchService.ts
import { eq, desc, inArray } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import { WordIdGenerator } from "../utils/word_id_generator";
import {
  ResearchResults,
  SearchResultItem,
  QueryRequest,
  QueryResults,
  ExaQuery,
} from "../types";
import { initLogger, traced, wrapTraced } from "braintrust";
import * as schema from "../db/schema";
import { ExaService } from "./exa";
import { generateQueries } from "./query_generator";
import { getContentSummarizer } from "./content_summarizer";
import { ai } from "../config/ai";

const logger = initLogger({
  projectName: "Research MCP",
  apiKey: process.env.BRAINTUST_API_KEY,
});

export class ResearchService {
  private exaService: ExaService;
  private contentSummarizer;

  constructor(
    private db: BunSQLiteDatabase<typeof schema>,
    private wordIdGenerator: WordIdGenerator
  ) {
    if (!process.env.EXA_API_KEY) {
      throw new Error("EXA_API_KEY environment variable is required");
    }

    this.exaService = new ExaService(process.env.EXA_API_KEY);
    this.contentSummarizer = getContentSummarizer(ai);
  }

  async performSearch(
    queryText: string,
    category?: string,
    livecrawl = false
  ): Promise<SearchResultItem[]> {
    return await this.exaService.performSearch(queryText, category, livecrawl);
  }

  async storeResults(
    results: ResearchResults,
    purpose: string,
    question: string
  ) {
    if (!results?.queryResults?.length) {
      throw new Error("No results to store");
    }

    try {
      await this.db.transaction(async (tx) => {
        for (const queryResult of results.queryResults) {
          for (let i = 0; i < queryResult.rawResults.length; i++) {
            const raw = queryResult.rawResults[i];
            const summarized = queryResult.summarizedResults[i];

            if (!raw || !summarized) {
              throw new Error("Missing raw or summarized result");
            }

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
                  updatedAt: sql`CURRENT_TIMESTAMP`,
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
    } catch (error) {
      console.error("Failed to store results:", error);
      throw new Error("Failed to store research results");
    }
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

  async research(purpose: string, question: string): Promise<ResearchResults> {
    // 1. Generate optimized queries from purpose and question
    const searchQueries = await generateQueries(purpose, question);
    if (!searchQueries?.length) {
      throw new Error("No search queries were generated");
    }

    // Initialize research results container
    const researchResults: ResearchResults = {
      purpose,
      question,
      queryResults: [],
    };

    // 2. Process each query sequentially
    for (const query of searchQueries) {
      // Store query in database
      const dbQuery = await this.db
        .insert(schema.exaQueries)
        .values({
          queryText: query.text,
          category: query.category,
          livecrawl: query.livecrawl,
        })
        .returning()
        .get();

      // 3. Execute Exa search with the query parameters
      const rawResults = await this.performSearch(
        query.text,
        query.category,
        query.livecrawl
      );

      // Generate IDs and map results
      const processedResults = await Promise.all(
        rawResults.map(async (r) => ({
          ...r,
          id: await this.wordIdGenerator.generateResultId(),
        }))
      );

      // 4. Create query result entry
      const queryResult: QueryResults = {
        queryId: dbQuery.id,
        query,
        rawResults: processedResults,
        summarizedResults: [], // Will be filled by content summarizer
      };

      // Add to research results
      researchResults.queryResults.push(queryResult);
    }

    // 5. Process content cleaning using ContentSummarizer
    const cleaningTasks = researchResults.queryResults.map((queryResult) =>
      this.contentSummarizer.summarizeMany(
        { purpose, question },
        queryResult.rawResults
      )
    );

    try {
      // Wait for all content cleaning
      const cleanedResults = await Promise.all(cleaningTasks);

      // Update results with cleaned content
      researchResults.queryResults.forEach((queryResult, index) => {
        queryResult.summarizedResults = cleanedResults[index];
      });
    } catch (error) {
      console.error("Failed to process content:", error);
      throw new Error("Content processing failed");
    }

    // Store results
    await this.storeResults(researchResults, purpose, question);

    return researchResults;
  }
}
