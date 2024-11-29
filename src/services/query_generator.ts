// src/services/query_generator.ts
import { AxAI, AxChainOfThought, AxSignature } from "@ax-llm/ax";
import { QueryRequest } from "../types";
import { ai } from "../config/ai";

const VALID_CATEGORIES = [
  "company",
  "research paper",
  "news",
  "linkedin profile",
  "github",
  "tweet",
  "movie",
  "song",
  "personal site",
  "pdf",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

interface QueryResult {
  text: string;
  category?: ValidCategory;
  livecrawl: boolean;
}

const QUERY_SIGNATURE = `
"Generate optimized search queries following best practices:
- Use natural language statements, not questions
- Add descriptive modifiers (detailed, comprehensive, etc.)
- Takes advantage of embedding similarity to find relevant results
- End with a colon
- Specify content type when relevant
- Include specific details
- Use appropriate categories from the allowed list
- Enable livecrawl for recent content needs"

Remember to:
- If specifying a category, ensure you also have a non-category query for diverse results
- Use livecrawl ONLY when you absolutely need results from the last month
- If creating either category or livecrawl queries, also create a non-category/non-livecrawl query to fill in gaps
- Keep queries clear and specific
- End each query with a colon"

purpose "why do you want to know this thing? (ie: relevant context from your task. more details better.)"
question "what do you want to know, more specifically? use natural language, be descriptive."
->
queries "array of objects with text (string), category (optional string), livecrawl (boolean) fields"
`;

// Add interface for AI response
interface AIQueryResponse {
  queries: Array<{
    text: string;
    category?: ValidCategory;
    livecrawl: boolean;
  }>;
}

export class QueryGenerator {
  private generator: AxChainOfThought;
  private ai: AxAI;

  constructor(ai: AxAI) {
    this.ai = ai;
    this.generator = new AxChainOfThought(QUERY_SIGNATURE);

    // Add examples for better performance - migrated from your DSPy training data
    this.generator.setExamples([
      {
        purpose:
          "To build a theoretical framework for analyzing wellness industry trends.",
        question:
          "Academic analysis of commodification in the wellness industry",
        queries: [
          {
            text: "Here is an academic paper analyzing cultural appropriation in modern wellness industries:",
            category: "research paper",
            livecrawl: false,
          },
          {
            text: "Here is a scholarly analysis of how luxury brands commodify spiritual practices:",
            category: "research paper",
            livecrawl: false,
          },
          {
            text: "Here is research on class dynamics in contemporary wellness culture:",
            category: "research paper",
            livecrawl: false,
          },
        ],
      },
      {
        purpose:
          "To gather information about Lululemon's history and yoga's commodification in the West.",
        question: "Lululemon history and yoga transformation in the West",
        queries: [
          {
            text: "Here is information about Lululemon's founding and early history:",
            livecrawl: false,
          },
          {
            text: "Here is data about Lululemon's growth and current market valuation:",
            category: "news",
            livecrawl: true,
          },
          {
            text: "Here is an academic overview of yoga's transformation in the West:",
            category: "research paper",
            livecrawl: false,
          },
        ],
      },
      {
        purpose:
          "To analyze class dynamics in Lululemon's marketing and store placement strategies.",
        question: "Class-based critique of Lululemon's marketing strategy",
        queries: [
          {
            text: "Here is analysis of where Lululemon places their stores and why:",
            livecrawl: false,
          },
          {
            text: "Here is data about Lululemon's target customer demographics:",
            category: "research paper",
            livecrawl: false,
          },
          {
            text: "Here is information about Lululemon's ambassador program and marketing strategy:",
            category: "news",
            livecrawl: true,
          },
        ],
      },
      {
        purpose:
          "To find evidence of cultural appropriation in Lululemon's practices for a critique.",
        question: "Critiques of Lululemon's appropriation of yoga",
        queries: [
          {
            text: "Here are examples of how Lululemon uses Sanskrit and spiritual language in their marketing:",
            livecrawl: false,
          },
          {
            text: "Here are critiques from Indian yoga practitioners about Lululemon's appropriation of yoga:",
            livecrawl: false,
          },
          {
            text: "Here are critiques from Indian yoga practitioners about Lululemon's appropriation of yoga:",
            category: "research paper",
            livecrawl: false,
          },
          {
            text: "Here is criticism from Indian yoga practitioners about Lululemon's appropriation of yoga:",
            category: "news",
            livecrawl: false,
          },
        ],
      },
      {
        purpose:
          "To understand Lululemon's role in creating the athleisure market trend.",
        question: "History of athleisure fashion",
        queries: [
          {
            text: "Here is how Lululemon pioneered the athleisure category in fashion:",
            livecrawl: false,
          },
          {
            text: "Here is research about how Lululemon pioneered the athleisure category in fashion:",
            category: "research paper",
            livecrawl: false,
          },
        ],
      },
    ]);
  }

  async generateQueries(request: QueryRequest): Promise<QueryResult[]> {
    if (!request.purpose || !request.question) {
      throw new Error("Both purpose and question are required");
    }

    const rawResult = await this.generator.forward(this.ai, {
      purpose: request.purpose,
      question: request.question,
    });

    // First cast to unknown, then to our expected type
    const result = rawResult as unknown as AIQueryResponse;

    // Validate the queries have required fields and valid categories
    if (!result?.queries || !Array.isArray(result.queries)) {
      throw new Error("Invalid response from AI: expected array of queries");
    }

    // Ensure we have non-category queries for diversity
    const hasNonCategoryQueries = result.queries.some((q) => !q.category);
    if (!hasNonCategoryQueries) {
      throw new Error(
        "At least one query without a category is required for diverse results"
      );
    }

    // For each category query, ensure there's a non-category variant
    const categoryQueries = result.queries.filter((q) => q.category);
    const hasMatchingNonCategoryQueries = categoryQueries.every((catQuery) =>
      result.queries.some(
        (q) => !q.category && q.text.includes(catQuery.text.split(":")[0])
      )
    );

    if (!hasMatchingNonCategoryQueries) {
      throw new Error("Each category query should have a non-category variant");
    }

    const validatedQueries = result.queries.map((query): QueryResult => {
      // Validate that queries end with a colon
      if (!query.text.trim().endsWith(":")) {
        query.text = `${query.text.trim()}:`;
      }

      return {
        text: query.text,
        category:
          query.category && VALID_CATEGORIES.includes(query.category)
            ? query.category
            : undefined,
        livecrawl: !!query.livecrawl,
      };
    });

    return validatedQueries;
  }
}

// Singleton pattern for the query generator
let _queryGenerator: QueryGenerator | null = null;

export const getQueryGenerator = (ai: AxAI): QueryGenerator => {
  if (!_queryGenerator) {
    _queryGenerator = new QueryGenerator(ai);
  }
  return _queryGenerator;
};

// Add this exported function to maintain compatibility
export const generateQueries = async (
  purpose: string,
  question: string
): Promise<QueryResult[]> => {
  const generator = getQueryGenerator(ai);
  return generator.generateQueries({ purpose, question });
};
