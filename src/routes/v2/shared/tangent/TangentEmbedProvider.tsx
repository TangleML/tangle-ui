import type {
  ColorScheme,
  EmbedResource,
  HostResourceInput,
  NewSessionOptions,
  NewSessionResult,
} from "@tangent/embed-react";
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

function applyProviderConfig(
  element: TangentProviderElementLike | null,
  config: TangentProviderElementLike["config"],
) {
  if (!element) return;
  element.config = config;
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
  children?: ReactNode;
}

/**
 * Tangle-ui wrapper around the embed runtime provider. Applies API and socket
 * config synchronously during render so Socket.IO reads the Tangent origin
 * before descendant chat elements subscribe (embed-react sets config in
 * useEffect, which is too late).
 */
export function TangentEmbedProvider({
  baseUrl,
  colorScheme,
  getToken,
  instance,
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
    applyProviderConfig(
      ref.current as TangentProviderElementLike | null,
      config,
    );
    const element = ref.current as TangentProviderElementLike | null;
    if (element) element.theme = theme;
  }

  useLayoutEffect(() => {
    if (!ready) return;
    applyProviderConfig(
      ref.current as TangentProviderElementLike | null,
      config,
    );
    const element = ref.current as TangentProviderElementLike | null;
    if (element) element.theme = theme;
  }, [ready, baseUrl, socketUrl, socketPath, getToken, colorScheme]);

  const context: TangentEmbedContextValue = {
    getProvider: () => ref.current as TangentProviderElementLike | null,
    ready: readyPromise,
  };

  return (
    <TangentEmbedContext.Provider value={context}>
      <tangent-provider ref={ref} instance={instance}>
        {ready ? children : null}
      </tangent-provider>
    </TangentEmbedContext.Provider>
  );
}
