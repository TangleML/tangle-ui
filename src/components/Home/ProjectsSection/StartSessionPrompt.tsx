import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_THINKING_LEVEL,
} from "@tangent/shared/contracts.ts";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { WorkspaceNotice } from "@/components/Project/WorkspaceNotice";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { TANGENT_AI_REQUIRED } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { rememberLastUsedWorkspace } from "@/services/projects/defaultWorkspace";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { provisionalNameMetadata } from "@/services/projects/provisionalName";
import { startingSessionMetadata } from "@/services/projects/startingSession";
import { useCreateProject } from "@/services/projects/useProjects";
import { useWorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { nextProjectName } from "./nextProjectName";
import { StartSessionToolbar } from "./StartSessionToolbar";
import { useMyProjects } from "./useMyProjects";

export function StartSessionPrompt() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingLevel>(
    DEFAULT_THINKING_LEVEL,
  );
  const composer = useRef<HTMLTextAreaElement>(null);
  const hasFocused = useRef(false);
  const navigate = useNavigate();
  const { mutate: startProject, isPending: isStarting } = useCreateProject();
  const { track } = useAnalytics();
  const { configured, available, ready } = useBackend();
  const { data: workspaces, isPending: isFindingWorkspace } = useWorkspaces();
  const workspaceChoice = useWorkspaceChoice(workspaces);
  const { projects } = useMyProjects();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();

  const workspace = workspaceChoice.selected;

  const isEmpty = prompt.trim() === "";
  // The box is the point of the page, so what stops it working leaves it
  // standing and disabled rather than taking it away.
  const isUnavailable = isFindingWorkspace || !workspace || !isAiConfigured;
  const isBusy = isStarting || isUnavailable;
  const isBackendMissing = ready && !(configured && available);

  // Once, as soon as it can take input: arriving here is the act of wanting to
  // type, but the box is disabled until the backend says where a project would
  // go, and focusing again later would move the caret off whatever came next.
  useEffect(() => {
    if (hasFocused.current || isUnavailable) return;
    hasFocused.current = true;
    composer.current?.focus();
  }, [isUnavailable]);

  const submit = () => {
    if (isEmpty || isBusy || !workspace) return;

    const startingPrompt = prompt.trim();
    const workspaceChanged = workspaceChoice.changedFromDefault;

    // The prompt rides on the project rather than the url, so arriving at
    // Tangent starts a session and runs it as the opening turn. The name is
    // marked as nobody's choice, so the agent may replace it with a real one.
    startProject(
      {
        workspaceId: workspace.id,
        name:
          nameFromPrompt(startingPrompt) ??
          nextProjectName(projects.map((p) => p.name)),
        origin: "agent",
        metadata: provisionalNameMetadata(
          startingSessionMetadata({
            prompt: startingPrompt,
            model,
            thinkingDepth,
          }),
        ),
      },
      {
        onSuccess: (project) => {
          rememberLastUsedWorkspace(workspace.id);
          track("projects.start_session_completed", {
            model,
            thinkingDepth,
            workspace_changed: workspaceChanged,
          });
          setPrompt("");
          void navigate({
            to: APP_ROUTES.TANGENT_PROJECT,
            params: { projectId: project.id },
          });
        },
      },
    );
  };

  return (
    <BlockStack gap="2" align="stretch" className="w-full max-w-4xl">
      <div className="w-full rounded-xl border border-brand-accent/40 bg-card p-3 shadow-sm transition-colors focus-within:border-brand-accent">
        <InlineStack
          gap="3"
          blockAlign="start"
          wrap="nowrap"
          className="w-full"
        >
          {/* No offset: the icon box is the height of one line, so it sits on
            the placeholder's line rather than below it. */}
          <Icon
            name="Sparkles"
            size="lg"
            className="shrink-0 text-brand-accent"
            aria-hidden="true"
          />
          <Textarea
            ref={composer}
            value={prompt}
            disabled={isBusy}
            placeholder="Start a new session"
            aria-label="Start a new session"
            rows={2}
            className="min-h-16 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, as it does in the chat this becomes; a newline
              // still needs saying so, because the box takes a whole brief.
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              submit();
            }}
          />
        </InlineStack>

        <StartSessionToolbar
          model={model}
          onModelChange={setModel}
          thinkingDepth={thinkingDepth}
          onThinkingDepthChange={setThinkingDepth}
          workspaceChoice={workspaceChoice}
          disabled={isBusy}
          canStart={!isEmpty}
          onStart={submit}
        />
      </div>

      {/* The AI provider comes first: it is a setting the user can change
          here and now, where a missing backend may not be theirs to fix. */}
      {!isAiConfigured ? (
        <InlineStack gap="2" blockAlign="center">
          <Text size="sm" tone="subdued">
            {TANGENT_AI_REQUIRED}
          </Text>
          <Link to={APP_ROUTES.SETTINGS_AGENT} className="text-sm underline">
            Open AI settings
          </Link>
        </InlineStack>
      ) : isBackendMissing ? (
        <Text size="sm" tone="subdued">
          Connect a backend to enable agentic features in Tangle
        </Text>
      ) : (
        <WorkspaceNotice />
      )}
    </BlockStack>
  );
}
