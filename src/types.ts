// src/types.ts

// API Types (from models.py)
export type ExaCategory =
  | "company"
  | "research paper"
  | "news"
  | "linkedin profile"
  | "github"
  | "tweet"
  | "movie"
  | "song"
  | "personal site"
  | "pdf";

export interface ExaQuery {
  text: string;
  category?: ExaCategory;
  livecrawl: boolean;
}

export interface SearchResultItem {
  url: string;
  id: string;
  title: string;
  score: number;
  publishedDate: string | null;
  author: string | null;
  text: string;
}

export interface SummarizedContent {
  id: string;
  relevanceSummary: string;
  denseSummary: string;
}

export interface QueryRequest {
  purpose?: string;
  question: string;
}

export interface QueryResults {
  queryId: number;
  query: ExaQuery;
  rawResults: SearchResultItem[];
  summarizedResults: SummarizedContent[];
}

export interface ResearchResults {
  purpose: string;
  question: string;
  queryResults: QueryResults[];
}

// Database Models (from db.py)
export interface DBResult {
  id: string;
  title: string | null;
  author: string | null;
  url: string | null;
  denseSummary: string;
  relevanceSummary: string;
  text: string;
  relevanceScore: number;
  queryPurpose: string;
  queryQuestion: string;
  publishedDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relationships
  queryResults?: DBQueryResult[];
}

export interface DBExaQuery {
  id: number;
  queryText: string;
  category: string | null;
  livecrawl: boolean;
  createdAt: Date;
  // Relationships
  queryResults?: DBQueryResult[];
}

export interface DBQueryResult {
  queryId: number;
  resultId: string;
  // Relationships
  exaQuery?: DBExaQuery;
  result?: DBResult;
}

// Utils
export interface WordIDGenerator {
  adjectives: string[];
  nouns: string[];
  generateResultId(): Promise<string>;
}

// Exa SDK types
import type { SearchResponse, LivecrawlOptions } from "exa-js";

export type ExaSearchResponse = SearchResponse<{
  text: true;
}>;

export interface ExaSearchOptions {
  numResults?: number;
  type?: "keyword" | "neural";
  text?: boolean;
  useAutoprompt?: boolean;
  category?: string;
  livecrawl?: LivecrawlOptions;
}
