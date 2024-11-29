// src/services/content_summarizer.ts
import { AxAI, AxChainOfThought } from "@ax-llm/ax";
import { QueryRequest, SearchResultItem, SummarizedContent } from "../types";

interface AICleanedResponse {
  cleaned_response: SummarizedContent | null;
}

const SUMMARIZER_SIGNATURE = `
"Extract information from search results to get the best results.
Only keep search results that are relevant to the original query.

For each result, return:
1. The ID of the result
2. A relevance summary: why it's relevant to the original query (<10 words, be straightforward and concise, say something distinct from the title)
3. A hyper-dense summary of the content.
   - Use the original content, but tailor it for our query.
   - Be as dense as possible. Don't miss anything not contained in the query.
   - Ideally, you'd return basically the exact content but with words/phrases omitted to focus on answering the reason behind the query and the question itself.
   - If the content is <1000 words or < 5 paragraphs, return it in full.
If the document is not relevant, return null."

original_query "The query that generated the search results, providing context for determining relevance" {
  purpose "why do you want to know this thing"
  question "what do you want to know specifically"
}
content "the raw search result" {
  id "unique identifier"
  title "content title"
  text "full content text"
  url "source url"
  score "relevance score"
}
->
cleaned_response "the cleaned search result (null if not relevant)" {
  id "result identifier"
  relevanceSummary "why it's relevant (<10 words)"
  denseSummary "dense content summary"
}
`;

// Singleton pattern for the content summarizer
let _contentSummarizer: ContentSummarizer | null = null;

export const getContentSummarizer = (ai: AxAI): ContentSummarizer => {
  if (!_contentSummarizer) {
    _contentSummarizer = new ContentSummarizer(ai);
  }
  return _contentSummarizer;
};

export class ContentSummarizer {
  private generator: AxChainOfThought;
  private ai: AxAI;

  constructor(ai: AxAI) {
    this.ai = ai;
    this.generator = new AxChainOfThought(SUMMARIZER_SIGNATURE);

    // Add examples for better performance
    this.generator.setExamples([
      {
        original_query: {
          purpose: "To analyze wellness industry trends",
          question:
            "How do modern wellness companies incorporate traditional practices?",
        },
        content: {
          id: "doc123",
          title: "The Commercialization of Ancient Wellness Practices",
          text: "Modern wellness companies have increasingly turned to traditional practices as a source of inspiration and profit. This study examines how yoga, meditation, and ayurvedic practices have been transformed into commercial products. Our analysis shows that while these adaptations have made traditional practices more accessible, they often strip away cultural context and spiritual significance.",
          url: "https://example.com/wellness-study",
          score: 0.92,
        },
        cleaned_response: {
          id: "doc123",
          relevanceSummary:
            "Analyzes commercialization of traditional wellness practices",
          denseSummary:
            "Modern wellness companies commercialize traditional practices (yoga, meditation, ayurveda). Makes practices accessible but removes cultural/spiritual context.",
        },
      },
    ]);
  }

  async summarizeOne(
    originalQuery: QueryRequest,
    content: SearchResultItem
  ): Promise<SummarizedContent | null> {
    if (!content.text || !originalQuery.question) {
      throw new Error("Content text and query question are required");
    }

    const rawResult = await this.generator.forward(this.ai, {
      original_query: originalQuery,
      content,
    });

    // First cast to unknown, then to our expected type
    const result = rawResult as unknown as AICleanedResponse;

    return result?.cleaned_response || null;
  }

  async summarizeMany(
    originalQuery: QueryRequest,
    contents: SearchResultItem[]
  ): Promise<SummarizedContent[]> {
    // Process all items concurrently using Promise.all
    const results = await Promise.all(
      contents.map((content) => this.summarizeOne(originalQuery, content))
    );

    // Filter out null responses
    return results.filter(
      (result): result is SummarizedContent => result !== null
    );
  }
}

export async function summarizeSearchItems(
  originalQuery: QueryRequest,
  content: SearchResultItem[]
): Promise<SummarizedContent[]> {
  // TODO: Implement content summarization logic
  // For now, return empty summaries
  return content.map((item) => ({
    id: item.id,
    relevanceSummary: "",
    denseSummary: "",
  }));
}
