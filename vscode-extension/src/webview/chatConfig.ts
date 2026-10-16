import * as z from "zod/mini";

export type ColorScheme = "light" | "dark";

export interface ChatWebviewConfig {
  embedBaseUrl: string;
  sessionId: string;
  colorScheme: ColorScheme;
  authToken: string;
}

export interface EmbedEndpoints {
  channelUrl: string;
  socketUrl: string;
  socketPath: string;
}

export interface ThemeMessage {
  type: "theme";
  colorScheme: ColorScheme;
}

export const webviewToHostMessage = z.union([
  z.object({
    type: z.literal("openArtifact"),
    url: z.string(),
    title: z.string(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type WebviewToHostMessage = z.infer<typeof webviewToHostMessage>;

export const CHAT_CONFIG_ELEMENT_ID = "tangent-chat-config";

/**
 * Socket.IO treats its URL as an origin and takes the path separately, so a
 * Shell mounted under a prefix moves that prefix into `socketPath`.
 */
export function embedEndpoints(embedBaseUrl: string): EmbedEndpoints {
  const url = new URL(embedBaseUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  return {
    channelUrl: `${url.origin}${prefix}/embed/v1/tangent-elements.js`,
    socketUrl: url.origin,
    socketPath: `${prefix}/socket.io`,
  };
}

function isColorScheme(value: unknown): value is ColorScheme {
  return value === "light" || value === "dark";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isChatWebviewConfig(
  value: unknown,
): value is ChatWebviewConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.embedBaseUrl === "string" &&
    typeof value.sessionId === "string" &&
    isColorScheme(value.colorScheme) &&
    typeof value.authToken === "string"
  );
}

export function isThemeMessage(value: unknown): value is ThemeMessage {
  if (!isRecord(value)) return false;
  return value.type === "theme" && isColorScheme(value.colorScheme);
}
