import { DateTime } from "luxon";

/**
 * Format a resource's content with XML-like structure
 */
export function formatResourceContent(
  resultId: string,
  title: string | null,
  author: string | null,
  content: string,
  publishedDate?: string | null
): string {
  const dateElement = publishedDate
    ? `\n<published_date>${publishedDate}</published_date>`
    : "";

  return `<resource id="${resultId}">
<title>${title || "Untitled"}</title>

<author>${author || "Unknown"}</author>${dateElement}

<content>
${content}
</content>
</resource>`;
}

/**
 * Format query results summary
 */
export function formatQueryResultsSummary(
  queryText: string,
  category?: string | null,
  livecrawl?: boolean
): string {
  return `<query>
<text>${queryText}</text>
${category ? `<category>${category}</category>` : ""}
${livecrawl ? "<crawl-status>recent</crawl-status>" : ""}
</query>`.trim();
}

/**
 * Format an individual result summary
 */
export function formatResultSummary(
  resultId: string,
  title: string | null,
  author: string | null,
  relevanceSummary: string,
  summary: string,
  publishedDate?: Date | null
): string {
  const dateElement = publishedDate
    ? `\n<date>${DateTime.fromJSDate(publishedDate).toFormat(
        "yyyy-MM-dd"
      )}</date>`
    : "";

  return `<result id="${resultId}">

<title>${title || "Untitled"}</title>${dateElement}
<author>${author || "Unknown"}</author>

<relevance>
${relevanceSummary}
</relevance>

<summary>
${summary}
</summary>
</result>`;
}

/**
 * Format multiple full text results
 */
export function formatFullTextsResponse(
  results: Array<{
    id: string;
    title: string | null;
    author: string | null;
    published_date: string | null;
    content: string;
  }>
): string {
  const formatted = results.map(
    (result) => `<text id="${result.id}">
<title>${result.title || "Untitled"}</title>
<author>${result.author || "Unknown"}</author>
<date>${result.published_date || "Unknown"}</date>

<content>
${result.content}
</content>
</text>`
  );

  return formatted.join("\n\n");
}

/**
 * Wrap content in results tag
 */
export function wrapInResultsTag(content: string): string {
  return `<results>
${content}
</results>`;
}
