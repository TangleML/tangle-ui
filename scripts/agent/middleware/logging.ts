import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { createMiddleware } from "langchain";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const LOGS_ROOT = resolve(__dir, "../.logs");

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-haiku-4-5": { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 },
};

interface LogEntry {
  timestamp: string;
  event: string;
  agent: string;
  [key: string]: unknown;
}

function serializeMessage(msg: BaseMessage): Record<string, unknown> {
  const raw = msg as unknown as Record<string, unknown>;
  return {
    type: msg._getType(),
    content: msg.content,
    name: raw.name,
    tool_calls: raw.tool_calls,
    tool_call_id: raw.tool_call_id,
    additional_kwargs: msg.additional_kwargs,
    response_metadata: raw.response_metadata,
    usage_metadata: raw.usage_metadata,
  };
}

class LogWriter {
  private threadDir: string;
  private initialized = false;

  constructor(threadId: string) {
    this.threadDir = join(LOGS_ROOT, threadId);
  }

  private ensureDir(): void {
    if (this.initialized) return;
    mkdirSync(this.threadDir, { recursive: true });
    this.initialized = true;
  }

  append(filename: string, entry: LogEntry): void {
    this.ensureDir();
    const line = JSON.stringify(entry) + "\n";
    appendFileSync(join(this.threadDir, filename), line, "utf-8");
  }
}

const writers = new Map<string, LogWriter>();

function getWriter(threadId: string): LogWriter {
  let writer = writers.get(threadId);
  if (!writer) {
    writer = new LogWriter(threadId);
    writers.set(threadId, writer);
  }
  return writer;
}

function extractModelName(model: unknown): string {
  if (
    model &&
    typeof model === "object" &&
    "model" in model &&
    typeof (model as Record<string, unknown>).model === "string"
  ) {
    return (model as Record<string, unknown>).model as string;
  }
  return "unknown";
}

function extractUsage(result: AIMessage): {
  inputTokens: number;
  outputTokens: number;
} {
  const raw = result as unknown as Record<string, unknown>;
  const usage = raw.usage_metadata as Record<string, unknown> | undefined;
  return {
    inputTokens: (usage?.input_tokens as number) ?? 0,
    outputTokens: (usage?.output_tokens as number) ?? 0,
  };
}

/**
 * Creates logging middleware that dumps all LLM requests/responses,
 * tool calls/results, and sub-agent delegations to JSONL files
 * under `scripts/agent/.logs/<threadId>/`.
 */
export function createLoggingMiddleware(agentName: string, threadId: string) {
  const agentFile = `${agentName}.jsonl`;
  const orchestratorFile = "_orchestrator.jsonl";
  let agentStartTime = 0;

  return createMiddleware({
    name: "LoggingMiddleware",

    beforeAgent: async (_state, runtime) => {
      agentStartTime = Date.now();
      const tid =
        (runtime?.configurable?.thread_id as string) ?? threadId ?? "unknown";
      const writer = getWriter(threadId);

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        event: "agent_start",
        agent: agentName,
        threadId: tid,
      };
      writer.append(agentFile, entry);

      if (agentName === "tangle-dispatcher") {
        writer.append(orchestratorFile, {
          ...entry,
          event: "orchestrator_start",
        });
      }
    },

    afterAgent: async () => {
      const elapsed = Date.now() - agentStartTime;
      const writer = getWriter(threadId);

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        event: "agent_end",
        agent: agentName,
        durationMs: elapsed,
      };
      writer.append(agentFile, entry);

      if (agentName === "tangle-dispatcher") {
        writer.append(orchestratorFile, {
          ...entry,
          event: "orchestrator_end",
        });
      }
    },

    wrapModelCall: async (request, handler) => {
      const writer = getWriter(threadId);
      const modelName = extractModelName(request.model);
      const toolNames = (request.tools ?? []).map(
        (t) => (t as Record<string, unknown>).name ?? "unknown",
      );

      writer.append(agentFile, {
        timestamp: new Date().toISOString(),
        event: "model_request",
        agent: agentName,
        model: modelName,
        messageCount: request.messages.length,
        messages: request.messages.map(serializeMessage),
        systemPrompt: request.systemPrompt,
        tools: toolNames,
        toolCount: toolNames.length,
      });

      const start = Date.now();
      const result = await handler(request);
      const elapsed = Date.now() - start;
      const usage = extractUsage(result);

      const rawResult = result as unknown as Record<string, unknown>;
      writer.append(agentFile, {
        timestamp: new Date().toISOString(),
        event: "model_response",
        agent: agentName,
        model: modelName,
        durationMs: elapsed,
        content: result.content,
        tool_calls: rawResult.tool_calls,
        usage_metadata: rawResult.usage_metadata,
        response_metadata: rawResult.response_metadata,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      return result;
    },

    wrapToolCall: async (request, handler) => {
      const writer = getWriter(threadId);
      const toolName = request.toolCall.name;
      const args = request.toolCall.args;

      if (toolName === "task") {
        const taskArgs = args as Record<string, unknown>;
        writer.append(orchestratorFile, {
          timestamp: new Date().toISOString(),
          event: "subagent_delegation",
          agent: agentName,
          subagentType: taskArgs?.subagent_type,
          description: taskArgs?.description,
        });
      }

      writer.append(agentFile, {
        timestamp: new Date().toISOString(),
        event: "tool_call",
        agent: agentName,
        toolName,
        args,
      });

      const start = Date.now();
      const result = await handler(request);
      const elapsed = Date.now() - start;

      const resultContent =
        "content" in result ? result.content : String(result);

      writer.append(agentFile, {
        timestamp: new Date().toISOString(),
        event: "tool_result",
        agent: agentName,
        toolName,
        durationMs: elapsed,
        result: resultContent,
      });

      if (toolName === "task") {
        writer.append(orchestratorFile, {
          timestamp: new Date().toISOString(),
          event: "subagent_returned",
          agent: agentName,
          subagentType: (args as Record<string, unknown>)?.subagent_type,
          durationMs: elapsed,
        });
      }

      return result;
    },
  });
}

interface AgentStats {
  modelCalls: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

/**
 * Reads all JSONL log files for a thread, aggregates token usage and cost,
 * and writes a `_summary.json` file.
 */
export function writeExecutionSummary(threadId: string): void {
  const threadDir = join(LOGS_ROOT, threadId);
  if (!existsSync(threadDir)) return;

  const files = readdirSync(threadDir).filter(
    (f) => f.endsWith(".jsonl") && !f.startsWith("_"),
  );

  const agents: Record<string, AgentStats> = {};
  let startedAt: string | undefined;
  let completedAt: string | undefined;

  for (const file of files) {
    const agentName = file.replace(".jsonl", "");
    const stats: AgentStats = {
      modelCalls: 0,
      toolCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    };

    const content = readFileSync(join(threadDir, file), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;

        if (entry.event === "agent_start") {
          if (!startedAt || (entry.timestamp as string) < startedAt) {
            startedAt = entry.timestamp as string;
          }
        }
        if (entry.event === "agent_end") {
          if (!completedAt || (entry.timestamp as string) > completedAt) {
            completedAt = entry.timestamp as string;
          }
        }

        if (entry.event === "model_response") {
          stats.modelCalls++;
          stats.inputTokens += (entry.inputTokens as number) ?? 0;
          stats.outputTokens += (entry.outputTokens as number) ?? 0;

          const modelName = (entry.model as string) ?? "unknown";
          const pricing = findPricing(modelName);
          stats.estimatedCost +=
            ((entry.inputTokens as number) ?? 0) * pricing.input +
            ((entry.outputTokens as number) ?? 0) * pricing.output;
        }

        if (entry.event === "tool_call") {
          stats.toolCalls++;
        }
      } catch {
        // skip malformed lines
      }
    }

    agents[agentName] = stats;
  }

  const totals: AgentStats = {
    modelCalls: 0,
    toolCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
  };
  for (const stats of Object.values(agents)) {
    totals.modelCalls += stats.modelCalls;
    totals.toolCalls += stats.toolCalls;
    totals.inputTokens += stats.inputTokens;
    totals.outputTokens += stats.outputTokens;
    totals.estimatedCost += stats.estimatedCost;
  }

  const durationMs =
    startedAt && completedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : 0;

  const summary = {
    threadId,
    startedAt: startedAt ?? null,
    completedAt: completedAt ?? null,
    durationMs,
    agents,
    totals: {
      ...totals,
      estimatedCost: Math.round(totals.estimatedCost * 1_000_000) / 1_000_000,
    },
  };

  writeFileSync(
    join(threadDir, "_summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf-8",
  );

  writers.delete(threadId);
}

function findPricing(modelName: string): { input: number; output: number } {
  if (PRICING[modelName]) return PRICING[modelName];

  for (const [key, pricing] of Object.entries(PRICING)) {
    if (modelName.includes(key)) return pricing;
  }

  return { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 };
}
