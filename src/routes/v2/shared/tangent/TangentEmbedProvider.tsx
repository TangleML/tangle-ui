import type {
  AnchorProtocolMap,
  ColorScheme,
  EmbedResource,
  HostResourceInput,
  HostUIComponentMap,
  NewSessionOptions,
  NewSessionResult,
  TangentContextValue,
} from "@tangent/embed-react";
import { TangentContext } from "@tangent/embed-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { getTangentSocketConfig } from "@/routes/v2/shared/tangent/socketConfig";

interface EmbedRuntimeHandle {
  newSession(
    prompt: string,
    bundleId: string,
    options?: NewSessionOptions,
  ): Promise<NewSessionResult>;
  listResources(sessionId: string): Promise<EmbedResource[]>;
  addResource(
    sessionId: string,
    input: HostResourceInput,
  ): Promise<EmbedResource>;
  removeResource(sessionId: string, uri: string): Promise<void>;
}

interface TangentProviderElementLike extends HTMLElement {
  config: {
    apiBase?: string;
    socketUrl?: string;
    socketPath?: string;
    getToken?: () => string | undefined | Promise<string | undefined>;
  };
  theme: {
    colorScheme?: ColorScheme;
    tokens?: Record<string, string>;
  };
  hostExtensions: {
    uiNames: string[];
    anchorProtocols: string[];
  };
  runtime?: EmbedRuntimeHandle | null;
}

interface TangentEmbedContextValue {
  getProvider: () => TangentProviderElementLike | null;
  ready: Promise<void>;
}

const TangentEmbedContext = createContext<TangentEmbedContextValue | null>(
  null,
);

const runtimeLoaders = new Map<string, Promise<void>>();

function defaultChannelUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/embed/v1/tangent-elements.js`;
}

function loadEmbedRuntime(url: string): Promise<void> {
  const existing = runtimeLoaders.get(url);
  if (existing) return existing;
  const loading = import(/* @vite-ignore */ /* webpackIgnore: true */ url).then(
    () => undefined,
  );
  runtimeLoaders.set(url, loading);
  return loading;
}

function useTangentEmbedContext(): TangentEmbedContextValue {
  const context = useContext(TangentEmbedContext);
  if (!context) {
    throw new Error("useTangent must be used within a <TangentEmbedProvider>");
  }
  return context;
}

async function resolveRuntime(
  ready: Promise<void>,
  getProvider: () => TangentProviderElementLike | null,
): Promise<EmbedRuntimeHandle> {
  await ready;
  const runtime = getProvider()?.runtime;
  if (!runtime) {
    throw new Error("Tangent runtime is not ready");
  }
  if (typeof runtime.addResource !== "function") {
    throw new Error(
      "This Tangent runtime does not support resources. Update the served embed runtime.",
    );
  }
  return runtime;
}

export function useTangent() {
  const context = useTangentEmbedContext();
  return {
    async newSession(
      prompt: string,
      bundleId: string,
      options?: NewSessionOptions,
    ) {
      await context.ready;
      const runtime = context.getProvider()?.runtime;
      if (!runtime) {
        throw new Error("Tangent runtime is not ready");
      }
      return runtime.newSession(prompt, bundleId, options);
    },
    async listResources(sessionId: string) {
      const runtime = await resolveRuntime(context.ready, context.getProvider);
      return runtime.listResources(sessionId);
    },
    async addResource(sessionId: string, input: HostResourceInput) {
      const runtime = await resolveRuntime(context.ready, context.getProvider);
      return runtime.addResource(sessionId, input);
    },
    async removeResource(sessionId: string, uri: string) {
      const runtime = await resolveRuntime(context.ready, context.getProvider);
      return runtime.removeResource(sessionId, uri);
    },
  };
}

interface TangentEmbedProviderProps {
  baseUrl: string;
  colorScheme?: ColorScheme;
  getToken?: () => string | undefined | Promise<string | undefined>;
  instance?: string;
  /** Host-owned UI components that replace bundle components, keyed by name. */
  uiComponents?: HostUIComponentMap;
  /** Host-owned anchor components, keyed by protocol scheme (no `://`). */
  anchorProtocols?: AnchorProtocolMap;
  children?: ReactNode;
}

/**
 * Tangle-ui wrapper around the embed runtime provider. Applies API/socket
 * config, theme, and host extensions synchronously during render so Socket.IO
 * reads the Tangent origin (and the runtime knows which slots the host owns)
 * before descendant chat elements subscribe — embed-react's `TangentProvider`
 * sets these in `useEffect`, which is too late.
 *
 * It also populates embed-react's own `TangentContext` so `<Chat>` can project
 * host-owned UI (`uiComponents`) and anchor (`anchorProtocols`) slots into the
 * host React tree, while `useTangent` keeps reading this sync-configured
 * element for session/resource calls.
 */
export function TangentEmbedProvider({
  baseUrl,
  colorScheme,
  getToken,
  instance,
  uiComponents,
  anchorProtocols,
  children,
}: TangentEmbedProviderProps) {
  const channelUrl = defaultChannelUrl(baseUrl);
  const { socketUrl, socketPath } = getTangentSocketConfig(baseUrl);
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [readyPromise] = useState(() => loadEmbedRuntime(channelUrl));

  const config = {
    apiBase: baseUrl,
    socketUrl,
    socketPath,
    getToken,
  };
  const theme = { colorScheme };
  const hostExtensions = {
    uiNames: Object.keys(uiComponents ?? {}),
    anchorProtocols: Object.keys(anchorProtocols ?? {}),
  };

  function applyProviderProps(element: TangentProviderElementLike | null) {
    if (!element) return;
    element.config = config;
    element.theme = theme;
    element.hostExtensions = hostExtensions;
  }

  useEffect(() => {
    let active = true;
    void readyPromise.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [readyPromise]);

  if (ready) {
    applyProviderProps(ref.current as TangentProviderElementLike | null);
  }

  useLayoutEffect(() => {
    if (!ready) return;
    applyProviderProps(ref.current as TangentProviderElementLike | null);
  }, [
    ready,
    baseUrl,
    socketUrl,
    socketPath,
    getToken,
    colorScheme,
    uiComponents,
    anchorProtocols,
  ]);

  const context: TangentEmbedContextValue = {
    getProvider: () => ref.current as TangentProviderElementLike | null,
    ready: readyPromise,
  };

  const embedContext: TangentContextValue = {
    getProvider: () => ref.current as TangentProviderElementLike | null,
    ready: readyPromise,
    uiComponents: uiComponents ?? {},
    anchorProtocols: anchorProtocols ?? {},
  };

  return (
    <TangentEmbedContext.Provider value={context}>
      <TangentContext.Provider value={embedContext}>
        <tangent-provider ref={ref} instance={instance}>
          {ready ? children : null}
        </tangent-provider>
      </TangentContext.Provider>
    </TangentEmbedContext.Provider>
  );
}
