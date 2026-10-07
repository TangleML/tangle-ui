import {
  AI_CONFIG,
  type AiHeaderConfig,
  getAiRequestProviderConfig,
} from "@/config/aiConfig";
import { isRecord } from "@/utils/typeGuards";

type JsonObject = Record<string, unknown>;
const ANTHROPIC = AI_CONFIG.providers.anthropic;
const NATIVE_REASONING = ANTHROPIC.nativeReasoningPrefix;
interface Message {
  role: "user" | "assistant";
  content: JsonObject[];
}

function object(value: unknown): JsonObject {
  if (!isRecord(value)) throw new Error("Unsupported AI request or response");
  return value;
}

function toolCallId(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Tool calls must have an id");
  }
  // Keep the same mapping for calls and results from another provider's history.
  return /^[\w-]+$/.test(value)
    ? value
    : `toolu_${Array.from(new TextEncoder().encode(value), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")}`;
}

function contentBlocks(value: unknown): JsonObject[] {
  if (typeof value === "string") return [{ type: "text", text: value }];
  if (!Array.isArray(value)) throw new Error("Unsupported AI message content");
  return value.map((value) => {
    const part = object(value);
    if (part.type === "input_text" || part.type === "output_text") {
      return { type: "text", text: part.text };
    }
    if (part.type === "refusal") {
      return { type: "text", text: part.refusal };
    }
    if (part.type === "input_image" && typeof part.image_url === "string") {
      const data = /^data:(image\/[^;]+);base64,(.+)$/.exec(part.image_url);
      return {
        type: "image",
        source: data
          ? { type: "base64", media_type: data[1], data: data[2] }
          : { type: "url", url: part.image_url },
      };
    }
    throw new Error(`Unsupported Anthropic content: ${String(part.type)}`);
  });
}

function nativeReasoning(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === "reasoning" &&
    typeof value.encrypted_content === "string" &&
    value.encrypted_content.startsWith(NATIVE_REASONING)
  );
}

function configuredHeaders(
  source: HeadersInit | undefined,
  ...rules: AiHeaderConfig[]
): Headers {
  const headers = new Headers(source);
  for (const rule of rules) {
    const value = rule.rename
      ? headers.get(rule.rename.from)?.replace(rule.rename.stripPrefix, "")
      : null;
    for (const name of rule.exclude) headers.delete(name);
    for (const [name, value] of Object.entries(rule.include))
      headers.set(name, value);
    if (rule.rename && value) headers.set(rule.rename.to, value);
  }
  return headers;
}

function fetchOpenAI(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const rules: AiHeaderConfig = AI_CONFIG.providers.openai.requestHeaders;
  if (
    !rules.rename &&
    !rules.exclude.length &&
    !Object.keys(rules.include).length
  )
    return fetch(input, init);
  const original = input instanceof Request ? input : null;
  return fetch(input, {
    ...init,
    headers: configuredHeaders(init?.headers ?? original?.headers, rules),
  });
}

function toAnthropic(request: JsonObject, proxy: boolean): JsonObject {
  if (request.stream || request.previous_response_id || request.conversation) {
    throw new Error(
      "Anthropic requires non-streaming requests with the full conversation history",
    );
  }
  const messages: Message[] = [];
  const system: string[] = [];
  if (typeof request.instructions === "string")
    system.push(request.instructions);
  const append = (role: Message["role"], content: JsonObject[]) => {
    const last = messages.at(-1);
    if (last?.role === role) last.content.push(...content);
    else messages.push({ role, content });
  };
  const input =
    typeof request.input === "string"
      ? [{ role: "user", content: request.input }]
      : request.input;
  if (!Array.isArray(input)) throw new Error("AI request is missing messages");
  const lastUserMessage = input.findLastIndex(
    (item) => isRecord(item) && item.role === "user",
  );
  for (const [index, value] of input.entries()) {
    const item = object(value);
    if (item.type === "reasoning") {
      if (nativeReasoning(item)) {
        const native = object(
          JSON.parse(
            String(item.encrypted_content).slice(NATIVE_REASONING.length),
          ),
        );
        // Signed reasoning is required within a tool turn, not after a new user turn.
        if (native.model === request.model && index > lastUserMessage) {
          append("assistant", [object(native.block)]);
        }
      }
      continue;
    }
    if (item.type === "function_call") {
      append("assistant", [
        {
          type: "tool_use",
          id: toolCallId(item.call_id),
          name: item.name,
          input: object(JSON.parse(String(item.arguments))),
        },
      ]);
    } else if (item.type === "function_call_output") {
      append("user", [
        {
          type: "tool_result",
          tool_use_id: toolCallId(item.call_id),
          content:
            typeof item.output === "string"
              ? item.output
              : contentBlocks(item.output),
        },
      ]);
    } else if (!item.type || item.type === "message") {
      const content = contentBlocks(item.content);
      if (item.role === "system" || item.role === "developer") {
        system.push(
          content
            .map((part) => {
              if (part.type !== "text") {
                throw new Error("System messages must contain text");
              }
              return String(part.text);
            })
            .join("\n"),
        );
      } else if (item.role === "user" || item.role === "assistant") {
        append(item.role, content);
      } else {
        throw new Error(`Unsupported Anthropic role: ${String(item.role)}`);
      }
    } else {
      throw new Error(
        `Unsupported Anthropic history item: ${String(item.type)}`,
      );
    }
  }

  const model = String(request.model);
  const result: JsonObject = {
    model: proxy ? model : model.replace(ANTHROPIC.directModelPrefix, ""),
    max_tokens: request.max_output_tokens ?? ANTHROPIC.defaultMaxOutputTokens,
    messages,
  };
  const text = isRecord(request.text) ? request.text : {};
  const format = isRecord(text.format) ? text.format : {};
  if (format.type === "json_object") {
    system.push("Return only a valid JSON object, without Markdown fences.");
  } else if (format.type === "json_schema") {
    result.output_config = {
      format: { type: "json_schema", schema: format.schema },
    };
  }
  if (system.length > 0) result.system = system.join("\n\n");
  if (Array.isArray(request.tools) && request.tools.length > 0) {
    result.tools = request.tools.map((value) => {
      const tool = object(value);
      if (tool.type !== "function") {
        throw new Error(`Unsupported Anthropic tool: ${String(tool.type)}`);
      }
      return {
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        input_schema: tool.parameters,
      };
    });
    const choice = request.tool_choice;
    result.tool_choice = {
      ...(isRecord(choice) && choice.type === "function"
        ? { type: "tool", name: choice.name }
        : { type: choice === "required" ? "any" : (choice ?? "auto") }),
      ...(request.parallel_tool_calls === false
        ? { disable_parallel_tool_use: true }
        : {}),
    };
  }
  // OpenAI reasoning/include/temperature settings are not portable to Claude.
  return result;
}

function toResponses(value: unknown, model: string): JsonObject {
  const message = object(value);
  if (message.stop_reason === "model_context_window_exceeded") {
    throw new Error(
      "Anthropic reached its context window limit before completing the response",
    );
  }
  if (!Array.isArray(message.content)) {
    throw new Error("Anthropic returned a response without content");
  }
  const stopDetails = isRecord(message.stop_details)
    ? message.stop_details
    : {};
  const blocks =
    message.stop_reason === "refusal"
      ? [
          {
            type: "refusal",
            refusal:
              typeof stopDetails.explanation === "string" &&
              stopDetails.explanation
                ? stopDetails.explanation
                : "Anthropic declined this request.",
          },
        ]
      : message.content;
  const output: JsonObject[] = [];
  for (const [index, value] of blocks.entries()) {
    const block = object(value);
    if (block.type === "text" || block.type === "refusal") {
      const content =
        block.type === "refusal"
          ? block
          : { type: "output_text", text: block.text, annotations: [] };
      const previous = output.at(-1);
      if (previous?.type === "message" && Array.isArray(previous.content)) {
        previous.content.push(content);
      } else {
        output.push({
          type: "message",
          id: `msg_${message.id}_${index}`,
          role: "assistant",
          status: "completed",
          content: [content],
        });
      }
    } else if (block.type === "tool_use") {
      if (message.stop_reason === "max_tokens") {
        throw new Error(
          "Anthropic exhausted its token budget during a tool call",
        );
      }
      output.push({
        type: "function_call",
        id: `fc_${message.id}_${index}`,
        call_id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
        status: "completed",
      });
    } else if (
      block.type === "thinking" ||
      block.type === "redacted_thinking"
    ) {
      // The SDK's reasoning slot carries signed native blocks through its session.
      // Restore these only for the same model; remove them before OpenAI requests.
      output.push({
        type: "reasoning",
        id: `rs_${message.id}_${index}`,
        summary: [],
        encrypted_content: NATIVE_REASONING + JSON.stringify({ model, block }),
      });
    } else {
      throw new Error(
        `Unsupported Anthropic response block: ${String(block.type)}`,
      );
    }
  }
  const usage = isRecord(message.usage) ? message.usage : {};
  const cached = Number(usage.cache_read_input_tokens ?? 0);
  const input =
    Number(usage.input_tokens ?? 0) +
    Number(usage.cache_creation_input_tokens ?? 0) +
    cached;
  const tokens = Number(usage.output_tokens ?? 0);
  return {
    id: `resp_${message.id}`,
    object: "response",
    model: message.model,
    status: message.stop_reason === "max_tokens" ? "incomplete" : "completed",
    incomplete_details:
      message.stop_reason === "max_tokens"
        ? { reason: "max_output_tokens" }
        : null,
    output,
    output_text: blocks
      .filter((block) => isRecord(block) && block.type === "text")
      .map((block) => String(object(block).text))
      .join(""),
    usage: {
      input_tokens: input,
      input_tokens_details: { cached_tokens: cached },
      output_tokens: tokens,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: input + tokens,
    },
  };
}

/**
 * Keep the application's Responses shape and history; translate at the network
 * boundary for native Claude models. Other endpoints (including embeddings) and
 * models pass through. Additional protocols belong in this module.
 */
export async function aiProviderFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!AI_CONFIG.providers.openai.endpoint.test(url)) return fetch(input, init);
  const original = input instanceof Request ? input : null;
  if ((init?.method ?? original?.method ?? "GET").toUpperCase() !== "POST") {
    return fetch(input, init);
  }
  const rawBody =
    init?.body ?? (original ? await original.clone().text() : null);
  if (typeof rawBody !== "string") return fetch(input, init);
  let request: unknown;
  try {
    request = JSON.parse(rawBody);
  } catch {
    return fetch(input, init);
  }
  if (
    !isRecord(request) ||
    typeof request.model !== "string" ||
    getAiRequestProviderConfig(
      request.model,
      url,
      init?.credentials ?? original?.credentials,
    ) !== ANTHROPIC
  ) {
    if (isRecord(request) && Array.isArray(request.input)) {
      const history = request.input.filter((item) => !nativeReasoning(item));
      if (history.length !== request.input.length) {
        return fetchOpenAI(input, {
          ...init,
          body: JSON.stringify({ ...request, input: history }),
        });
      }
    }
    return fetchOpenAI(input, init);
  }

  const credentials = init?.credentials ?? original?.credentials;
  const proxy = credentials === "include";
  const headers = configuredHeaders(
    init?.headers ?? original?.headers,
    ANTHROPIC.requestHeaders,
    ...(proxy ? [] : [ANTHROPIC.directHeaders]),
  );
  const route = ANTHROPIC.routes[proxy ? "proxy" : "direct"];
  const target = url.replace(route.match, route.replacement);
  const response = await fetch(target, {
    ...init,
    method: init?.method ?? original?.method ?? "POST",
    credentials,
    signal: init?.signal ?? original?.signal,
    headers,
    body: JSON.stringify(toAnthropic(request, proxy)),
  });
  if (!response.ok) return response;
  const payload = toResponses(await response.json(), request.model);
  const responseHeaders = configuredHeaders(
    response.headers,
    ANTHROPIC.responseHeaders,
  );
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
