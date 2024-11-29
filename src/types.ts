// src/types.ts
export interface SearchResultItem {
  url: string;
  id: string;
  title: string;
  score: number;
  publishedDate?: string;
  author?: string;
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
  query: {
    text: string;
    category?: string;
    livecrawl: boolean;
  };
  rawResults: SearchResultItem[];
  summarizedResults: SummarizedContent[];
}

export interface ResearchResults {
  purpose: string;
  question: string;
  queryResults: QueryResults[];
}

export interface Result {
  id: string;
  title?: string;
  author?: string;
  url?: string;
  denseSummary: string;
  relevanceSummary: string;
  text: string;
  relevanceScore: number;
  queryPurpose: string;
  queryQuestion: string;
  publishedDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WordIDGenerator {
  adjectives: string[];
  nouns: string[];

  generateResultId(): Promise<string>;
}
