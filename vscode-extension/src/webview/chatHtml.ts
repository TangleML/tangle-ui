import {
  CHAT_CONFIG_ELEMENT_ID,
  type ChatWebviewConfig,
} from "./chatConfig.ts";

export interface ChatPageOptions {
  cspSource: string;
  scriptUri: string;
  nonce: string;
  embedOrigin: string;
  config: ChatWebviewConfig;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Keeps a `</script>` inside a string value from closing the JSON block. */
function inertJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The embed runtime, its modules, styles, workers, and sockets all come from
 * the embed origin (the loopback proxy in front of the Shell).
 */
export function chatContentSecurityPolicy({
  cspSource,
  nonce,
  embedOrigin,
}: Pick<ChatPageOptions, "cspSource" | "nonce" | "embedOrigin">): string {
  const socketOrigin = embedOrigin.replace(/^http/, "ws");
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${cspSource} ${embedOrigin}`,
    `style-src ${cspSource} ${embedOrigin} 'unsafe-inline'`,
    `connect-src ${embedOrigin} ${socketOrigin}`,
    `img-src ${cspSource} ${embedOrigin} data: blob: https:`,
    `font-src ${cspSource} ${embedOrigin} data:`,
    `worker-src ${embedOrigin} blob:`,
    `frame-src ${embedOrigin} blob:`,
  ].join("; ");
}

export function chatPageHtml(options: ChatPageOptions): string {
  const csp = chatContentSecurityPolicy(options);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body, #root { height: 100%; margin: 0; padding: 0; }
      body { background: var(--vscode-editor-background); color: var(--vscode-foreground); font-family: var(--vscode-font-family); }
      .notice { padding: 16px; font-size: var(--vscode-font-size); color: var(--vscode-descriptionForeground); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="application/json" id="${CHAT_CONFIG_ELEMENT_ID}">${inertJson(options.config)}</script>
    <script type="module" nonce="${escapeAttribute(options.nonce)}" src="${escapeAttribute(options.scriptUri)}"></script>
  </body>
</html>`;
}
