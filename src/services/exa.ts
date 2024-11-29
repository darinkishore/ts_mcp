import Exa from "exa-js";
import type { SearchResult } from "exa-js";
import type { SearchResultItem } from "../types";
import { RateLimiter } from "../utils/rateLimiter";
import { initLogger, traced, wrapTraced } from "braintrust";

export class ExaService {
  private exa: Exa;
  private exaLimiter: RateLimiter;

  constructor(
    private readonly exaApiKey: string = process.env.EXA_API_KEY as string
  ) {
    if (!this.exaApiKey) {
      throw new Error("EXA_API_KEY is required");
    }
    this.exa = new Exa(this.exaApiKey);
    this.exaLimiter = new RateLimiter(3); // 3 requests per second to be safe
  }

  performSearch = wrapTraced(async function performSearch(
    this: ExaService,
    queryText: string,
    category?: string,
    livecrawl = false
  ): Promise<SearchResultItem[]> {
    if (!queryText.trim()) {
      throw new Error("Query text cannot be empty");
    }

    const searchArgs = {
      numResults: 10,
      type: "neural" as const,
      text: true as const,
      useAutoprompt: false,
      category,
      livecrawl: livecrawl ? "always" : undefined,
    };

    // Remove undefined values from searchArgs
    const cleanedArgs = Object.fromEntries(
      Object.entries(searchArgs).filter(([_, v]) => v !== undefined)
    );

    // Wait for rate limit
    await this.exaLimiter.acquire();

    const results = await this.exa.searchAndContents(queryText, cleanedArgs);

    // Transform Exa results to our SearchResultItem type
    return results.results.map((result: SearchResult<{ text: true }>) => ({
      id: result.id || "",
      url: result.url || "",
      title: result.title || "",
      score: result.score || 0,
      publishedDate: result.publishedDate || null,
      author: result.author || "",
      text: result.text || "",
    }));
  });
}
