export interface AiHeaderConfig {
  // Set listed values, remove excluded names, and preserve unlisted headers.
  include: Record<string, string>;
  exclude: readonly string[];
  rename?: { from: string; to: string; stripPrefix: RegExp };
}

// Static transport rules. Message and tool conversion stays in the adapter.
export const AI_PROVIDER_CONFIG = {
  openai: {
    endpoint: /\/responses(?:\?|$)/,
    requestHeaders: {
      include: {},
      exclude: [],
    },
  },
  anthropic: {
    modelPattern: /(^|[/:])claude[-_]/i,
    directModelPrefix: /^.*[/:](?=claude[-_])/i,
    nativeReasoningPrefix: "tangle-anthropic:",
    defaultMaxOutputTokens: 8192,
    minimumOutputTokens: {
      modelPattern:
        /claude-(?:opus|sonnet|fable|mythos)-(?:5(?:[-.]|$)|preview)/i,
      tokens: 4096,
    },
    routes: {
      proxy: {
        match: /\/v1\/responses(?=\?|$)/,
        replacement: "/anthropic/v1/messages",
      },
      direct: {
        match: /\/responses(?=\?|$)/,
        replacement: "/messages",
      },
    },
    requestHeaders: {
      include: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      exclude: [
        "content-length",
        "openai-beta",
        "openai-organization",
        "openai-project",
      ],
    },
    directHeaders: {
      include: { "anthropic-dangerous-direct-browser-access": "true" },
      exclude: ["authorization"],
      rename: {
        from: "authorization",
        to: "x-api-key",
        stripPrefix: /^Bearer\s+/i,
      },
    },
    responseHeaders: {
      include: { "content-type": "application/json" },
      exclude: ["content-length", "content-encoding"],
    },
  },
};
