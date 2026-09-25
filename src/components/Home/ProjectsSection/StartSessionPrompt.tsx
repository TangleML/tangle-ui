import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_THINKING_LEVEL,
  THINKING_LEVELS,
} from "@tangent/shared/contracts.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { nameFromPrompt } from "@/services/projects/nameFromPrompt";
import { createProject } from "@/services/projects/projectsService";
import { provisionalNameExtraData } from "@/services/projects/provisionalName";
import { startingSessionExtraData } from "@/services/projects/startingSession";
import { ProjectsQueryKeys } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { nextProjectName } from "./nextProjectName";
import { useMyProjects } from "./useMyProjects";

const THINKING_LABELS: Partial<Record<ThinkingLevel, string>> = {
  xhigh: "Extra high",
};

const thinkingLabel = (level: ThinkingLevel) =>
  THINKING_LABELS[level] ?? level.charAt(0).toUpperCase() + level.slice(1);

export function StartSessionPrompt() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL_ID);
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingLevel>(
    DEFAULT_THINKING_LEVEL,
  );
  const composer = useRef<HTMLTextAreaElement>(null);
  const hasFocused = useRef(false);
  const navigate = useNavigate();
  const notify = useToastNotification();
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const { data: workspaces, isPending: isFindingWorkspace } = useWorkspaces();
  const { projects } = useMyProjects();

  const workspace = workspaces?.find((w) => w.isActive) ?? workspaces?.[0];

  const { mutate: start, isPending } = useMutation({
    mutationFn: async (startingPrompt: string) => {
      if (!workspace) {
        throw new Error("No workspace is available to create a project.");
      }
      // What to run rides on the project rather than the url: arriving at a
      // project with no sessions, Tangent starts one and runs the prompt as
      // the opening turn, so the agent is working before anyone reaches for
      // the composer.
      //
      // Named after the ask, and marked as nobody's choice, so the agent may
      // replace it with a real title once it knows what it is building.
      return createProject({
        workspaceId: workspace.id,
        name:
          nameFromPrompt(startingPrompt) ??
          nextProjectName(projects.map((p) => p.name)),
        origin: "agent",
        extraData: provisionalNameExtraData(
          startingSessionExtraData({
            prompt: startingPrompt,
            model,
            thinkingDepth,
          }),
        ),
      });
    },
    onSuccess: (project) => {
      track("projects.start_session_completed", { model, thinkingDepth });
      setPrompt("");
      void queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.All() });
      void navigate({
        to: APP_ROUTES.TANGENT_PROJECT,
        params: { projectId: project.id },
      });
    },
    onError: (error) => {
      notify(getErrorMessage(error), "error");
    },
  });

  const isEmpty = prompt.trim() === "";
  // The box is the point of the page, so a backend that cannot say where a
  // project would go leaves it standing and unusable rather than taking it
  // away. What is wrong is said below it, where the projects would be.
  const isUnavailable = isFindingWorkspace || !workspace;
  const isBusy = isPending || isUnavailable;
  // Only once the lookup has settled: said while it is still running, this
  // would accuse a backend that is about to answer.
  const hasNoBackend = !isFindingWorkspace && !workspace;

  // Once, as soon as it can take input: arriving here is the act of wanting to
  // type, but the box is disabled until the backend says where a project would
  // go, and focusing again later would take the caret off whatever the user
  // moved to.
  useEffect(() => {
    if (hasFocused.current || isUnavailable) return;
    hasFocused.current = true;
    composer.current?.focus();
  }, [isUnavailable]);

  const submit = () => {
    if (isEmpty || isBusy) return;
    start(prompt.trim());
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

        <InlineStack gap="2" blockAlign="center" className="w-full pt-2">
          <Select value={model} onValueChange={setModel} disabled={isBusy}>
            <SelectTrigger aria-label="Model" className="h-8 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={thinkingDepth}
            onValueChange={(value) => setThinkingDepth(value as ThinkingLevel)}
            disabled={isBusy}
          >
            <SelectTrigger aria-label="Thinking" className="h-8 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THINKING_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {thinkingLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            size="icon"
            className="bg-brand-accent text-white hover:bg-brand-accent/90 disabled:opacity-40 dark:text-slate-950"
            aria-label="Start session"
            disabled={isEmpty || isBusy}
            onClick={submit}
            {...tracking("projects.start_session_submit")}
          >
            <Icon name="ArrowUp" size="sm" />
          </Button>
        </InlineStack>
      </div>

      {hasNoBackend && (
        <Text size="sm" tone="subdued">
          Connect a backend to enable agentic features in Tangle
        </Text>
      )}
    </BlockStack>
  );
}
