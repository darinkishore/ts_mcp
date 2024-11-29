import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ResearchService } from "./services/researchservice";
import { db, initDb } from "./db";
import { WordIdGenerator } from "./utils/word_id_generator";
import * as schema from "./db/schema";
import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import {
  formatFullTextsResponse,
  formatQueryResultsSummary,
  formatResourceContent,
  formatResultSummary,
  wrapInResultsTag,
} from "./utils/formatters";

// Type for get_full_texts arguments
interface GetFullTextsArgs {
  result_ids: string[];
}

class ResearchServer {
  private server: Server;
  private researchService: ResearchService;

  constructor() {
    // Initialize services
    const wordIdGenerator = new WordIdGenerator();
    // Cast db to correct type with schema
    this.researchService = new ResearchService(
      db as unknown as BunSQLiteDatabase<typeof schema>,
      wordIdGenerator
    );

    // Create MCP server
    this.server = new Server(
      {
        name: "research-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // Research endpoint
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "research") {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (
        !request.params.arguments ||
        typeof request.params.arguments !== "object"
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid research arguments"
        );
      }

      const { purpose, question } = request.params.arguments as {
        purpose?: string;
        question?: string;
      };

      if (
        !purpose ||
        !question ||
        typeof purpose !== "string" ||
        typeof question !== "string"
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Missing required parameters: purpose and question"
        );
      }

      try {
        const results = await this.researchService.research(purpose, question);
        return {
          content: [
            {
              type: "text",
              text: wrapInResultsTag(
                results.queryResults
                  .map(
                    (qr) =>
                      formatQueryResultsSummary(
                        qr.query.text,
                        qr.query.category,
                        qr.query.livecrawl
                      ) +
                      "\n\n" +
                      qr.summarizedResults
                        .map((sr, i) =>
                          formatResultSummary(
                            qr.rawResults[i].id,
                            qr.rawResults[i].title,
                            qr.rawResults[i].author,
                            sr.relevanceSummary,
                            sr.denseSummary,
                            qr.rawResults[i].publishedDate
                              ? new Date(qr.rawResults[i].publishedDate)
                              : null
                          )
                        )
                        .join("\n\n")
                  )
                  .join("\n\n")
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            content: [
              {
                type: "text",
                text: `Research error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: "Research error: Unknown error occurred",
            },
          ],
          isError: true,
        };
      }
    });

    // List resources endpoint
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.researchService.listResources();
      return {
        resources: resources.map((r) => ({
          uri: `research://results/${r.id}`,
          name: r.title,
          mimeType: "application/json",
          description: r.denseSummary,
        })),
      };
    });

    // Get resource endpoint
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const uri = request.params.uri;
        const match = uri.match(/^research:\/\/results\/(.+)$/);

        if (!match) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid resource URI: ${uri}`
          );
        }

        try {
          const result = await this.researchService.getResource(match[1]);
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: formatResourceContent(
                  result.id,
                  result.title,
                  result.author,
                  result.text,
                  result.publishedDate
                ),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Resource not found: ${uri}`
          );
        }
      }
    );

    // List tools endpoint
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "research",
          description: "Research a topic using multiple sources",
          inputSchema: {
            type: "object",
            properties: {
              purpose: {
                type: "string",
                description: "The purpose of the research",
              },
              question: {
                type: "string",
                description: "The specific question to research",
              },
            },
            required: ["purpose", "question"],
          },
        },
        {
          name: "get_full_texts",
          description: "Get full text content for a list of result IDs",
          inputSchema: {
            type: "object",
            properties: {
              result_ids: {
                type: "array",
                items: { type: "string" },
                description: "List of result IDs to fetch",
              },
            },
            required: ["result_ids"],
          },
        },
      ],
    }));

    // Get full texts tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "get_full_texts") {
        return {
          content: [
            {
              type: "text",
              text: "Unknown tool",
            },
          ],
          isError: true,
        };
      }

      const args = request.params.arguments as GetFullTextsArgs | undefined;
      if (!args?.result_ids || !Array.isArray(args.result_ids)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "result_ids must be an array"
        );
      }

      try {
        const results = await this.researchService.getFullTexts(
          args.result_ids
        );
        return {
          content: [
            {
              type: "text",
              text: formatFullTextsResponse(
                results.map((r) => ({
                  id: r.id,
                  title: r.title,
                  author: r.author,
                  published_date: r.publishedDate,
                  content: r.text,
                }))
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching full texts: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: "Error fetching full texts: Unknown error occurred",
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    // Initialize database
    await initDb();

    // Connect transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to stderr to avoid interfering with MCP communication
    console.error("Research MCP server running on stdio");
  }
}

// Start server
const server = new ResearchServer();
server.run().catch(console.error);
