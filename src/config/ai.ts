import { AxAI } from "@ax-llm/ax";
import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";

const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
trace.setGlobalTracerProvider(provider);

const tracer = trace.getTracer("test");

export const ai = new AxAI({
  name: "openai",
  apiKey: process.env.OPENAI_API_KEY as string,
  config: {
    model: "gpt-4o-2024-11-20",
  },
});
