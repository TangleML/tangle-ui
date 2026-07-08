import { Link, useLocation, useParams } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import {
  EMPTY_GRAPH_COMPONENT_SPEC,
  useComponentSpec,
} from "@/providers/ComponentSpecProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import {
  AiChatStoreProvider,
  useAiChatStore,
} from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { createSidekickAgentWorker } from "./createSidekickAgentWorker";
import { createSidekickToolBridge } from "./createSidekickToolBridge";
import { getLearningSuggestion } from "./sidekickLearningSuggestions";

const SidekickTourSuggestions = observer(function SidekickTourSuggestions() {
  const aiChat = useAiChatStore();
  const thread = aiChat.activeThread;
  const lastUserMessage = thread?.messages
    .slice()
    .reverse()
    .find((message) => message.role === "user");
  const suggestion = getLearningSuggestion(lastUserMessage?.content ?? "");

  return (
    <InlineStack gap="2" wrap="wrap" className="border-t px-3 py-2">
      {suggestion.type === "tour" ? (
        <Button asChild size="sm" variant="outline">
          <Link
            to={APP_ROUTES.TOUR_DETAIL}
            params={{ tourId: suggestion.tourId }}
          >
            {suggestion.label}
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link to={suggestion.to} hash={suggestion.hash}>
            {suggestion.label}
          </Link>
        </Button>
      )}
      <Button asChild size="sm" variant="ghost">
        <Link to={APP_ROUTES.LEARN}>Open Learning Hub</Link>
      </Button>
    </InlineStack>
  );
});

function getRunId(params: Record<string, unknown>): string | undefined {
  return typeof params.id === "string" ? params.id : undefined;
}

function SidekickPipelineContextSync() {
  const { componentSpec } = useComponentSpec();
  const { navigation } = useSharedStores();

  useEffect(() => {
    if (componentSpec === EMPTY_GRAPH_COMPONENT_SPEC) {
      navigation.clearNavigation();
      return;
    }

    const deserializer = new YamlDeserializer(new IncrementingIdGenerator());
    navigation.initNavigation(deserializer.deserialize(componentSpec));
  }, [componentSpec, navigation]);

  return null;
}

function SidekickChat({ runId }: { runId?: string }) {
  return (
    <SharedStoreProvider>
      <SidekickPipelineContextSync />
      <AiChatStoreProvider
        key={runId ?? "general"}
        createWorker={createSidekickAgentWorker}
        context={{ mode: "general", ...(runId && { runId }) }}
      >
        <BlockStack className="min-h-0 flex-1">
          <AiChatContent
            createBridge={createSidekickToolBridge}
            emptyMessage="Ask anything about Tangle"
            inputPlaceholder="Ask about Tangle, pipelines, runs, components..."
            showNewThreadButton={false}
          />
          <SidekickTourSuggestions />
        </BlockStack>
      </AiChatStoreProvider>
    </SharedStoreProvider>
  );
}

export function SidekickAssistant() {
  const globalAgentEnabled = useFlagValue("global-agent");
  const { pathname } = useLocation();
  const params = useParams({ strict: false });
  const runId = getRunId(params);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isEditorRoute = pathname.startsWith(APP_ROUTES.EDITOR_V2);

  if (!globalAgentEnabled || isEditorRoute) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        shape="pill"
        className="group fixed bottom-6 right-6 z-50 h-11 w-11 gap-0 overflow-hidden bg-foreground px-0 text-background shadow-lg transition-[width,background-color,color,gap] duration-200 hover:w-32 hover:gap-2 hover:bg-[#5B35F5] hover:text-white focus-visible:w-32 focus-visible:gap-2"
        aria-label={open ? "Close Sidekick" : "Open Sidekick"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        {...tracking("sidekick.toggle")}
      >
        <Icon name="Bot" size="sm" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-20 group-hover:opacity-100 group-focus-visible:max-w-20 group-focus-visible:opacity-100"
        >
          Sidekick
        </span>
      </Button>

      <div
        role="dialog"
        aria-label="Sidekick assistant"
        hidden={!open}
        className={cn(
          "fixed bottom-20 left-4 right-4 z-50 flex h-[min(42rem,calc(100vh-7rem))] min-h-96 flex-col overflow-hidden resize rounded-2xl border border-border bg-background shadow-2xl sm:left-auto sm:w-[26rem] sm:min-w-80 sm:max-w-[calc(100vw-2rem)]",
          expanded && "h-[min(52rem,calc(100vh-7rem))] sm:w-[42rem]",
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <InlineStack
          align="space-between"
          blockAlign="center"
          className="border-b border-border px-4 py-3"
        >
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Bot" size="sm" className="text-primary" />
            <Heading level={3}>Sidekick</Heading>
          </InlineStack>
          <InlineStack gap="1" blockAlign="center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                expanded ? "Use compact Sidekick size" : "Expand Sidekick"
              }
              onClick={() => setExpanded((current) => !current)}
            >
              <Icon
                name={expanded ? "Minimize2" : "Maximize2"}
                size="sm"
                aria-hidden="true"
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close Sidekick"
              onClick={() => setOpen(false)}
            >
              <Icon name="X" size="sm" aria-hidden="true" />
            </Button>
          </InlineStack>
        </InlineStack>

        <SidekickChat runId={runId} />
      </div>
    </>
  );
}
