import { Chat, TangentProvider } from "@tangent/embed-react";
import { type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  CHAT_CONFIG_ELEMENT_ID,
  type ChatWebviewConfig,
  type ColorScheme,
  embedEndpoints,
  isChatWebviewConfig,
  isThemeMessage,
  type WebviewToHostMessage,
} from "./chatConfig.ts";

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

declare global {
  interface Window {
    $RefreshReg$?: () => void;
    $RefreshSig$?: () => <T>(type: T) => T;
  }
}

type RuntimeStatus = "loading" | "ready" | "unreachable";

const vscodeApi = acquireVsCodeApi();

/**
 * A Shell running under the Vite dev server ships React Fast Refresh code that
 * throws unless the host page installed `@vitejs/plugin-react`'s preamble. Host
 * pages that are Vite dev apps themselves happen to provide it; this panel is
 * not one. A production Shell never reads these globals.
 */
function installViteDevPreamble(): void {
  window.$RefreshReg$ ??= () => undefined;
  window.$RefreshSig$ ??= () => (type) => type;
}

function readConfig(): ChatWebviewConfig {
  const element = document.getElementById(CHAT_CONFIG_ELEMENT_ID);
  const config: unknown = JSON.parse(element?.textContent ?? "null");
  if (!isChatWebviewConfig(config)) {
    throw new Error("The chat panel has no valid configuration.");
  }
  return config;
}

function useColorScheme(initial: ColorScheme): ColorScheme {
  const [colorScheme, setColorScheme] = useState(initial);
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (isThemeMessage(event.data)) setColorScheme(event.data.colorScheme);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return colorScheme;
}

/**
 * `TangentProvider` never reports a failed runtime import, so a missing Shell
 * would leave the panel blank. Importing the same URL here surfaces the
 * failure; module imports are cached per URL, so it is fetched once.
 */
function useRuntimeStatus(channelUrl: string): RuntimeStatus {
  const [status, setStatus] = useState<RuntimeStatus>("loading");
  useEffect(() => {
    let active = true;
    import(/* @vite-ignore */ channelUrl).then(
      () => active && setStatus("ready"),
      () => active && setStatus("unreachable"),
    );
    return () => {
      active = false;
    };
  }, [channelUrl]);
  return status;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}

function SessionChat({ config }: { config: ChatWebviewConfig }) {
  const colorScheme = useColorScheme(config.colorScheme);
  const { channelUrl, socketUrl, socketPath } = embedEndpoints(
    config.embedBaseUrl,
  );
  const runtime = useRuntimeStatus(channelUrl);

  if (runtime === "loading") return <Notice>Loading chat…</Notice>;
  if (runtime === "unreachable") {
    return (
      <Notice>
        Cannot load the Tangent chat from the Shell. Check that the Shell is
        running, then reopen this session.
      </Notice>
    );
  }

  return (
    <TangentProvider
      baseUrl={config.embedBaseUrl}
      channelUrl={channelUrl}
      getToken={() => config.authToken}
      socketUrl={socketUrl}
      socketPath={socketPath}
      colorScheme={colorScheme}
    >
      <Chat
        sessionId={config.sessionId}
        autoFocus
        onOpenArtifact={(url, title) =>
          vscodeApi.postMessage({ type: "openArtifact", url, title })
        }
        onError={(message) => vscodeApi.postMessage({ type: "error", message })}
      />
    </TangentProvider>
  );
}

installViteDevPreamble();
const root = document.getElementById("root");
if (!root) throw new Error("The chat panel is missing its root element.");
createRoot(root).render(<SessionChat config={readConfig()} />);
