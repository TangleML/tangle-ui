import { Link } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { type ReactNode, useState } from "react";

import { PinProjectButton } from "@/components/Project/PinProjectButton";
import {
  ProjectDescriptionField,
  ProjectInstructionsField,
} from "@/components/Project/ProjectAbout";
import { ProjectWorkspaceLabel } from "@/components/Project/ProjectWorkspaceLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProjectHasSecrets } from "@/routes/v2/pages/Tangent/hooks/useProjectHasSecrets";
import type { Project } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { AgentTraceDialog } from "./AgentTraceDialog";
import { AttachAgentButton } from "./AttachAgentButton";
import { LocalEnvIndicator } from "./LocalEnvIndicator";
import { SecretsWindowContent } from "./SecretsWindowContent";

const FILLED_FIELD = "bg-background dark:bg-input/30";

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Radix focuses the first control on open, which rings the pin button before
 * anyone has touched the dialog. Focusing the dialog itself still moves focus
 * inside it, without singling out a control.
 */
function focusDialogItself(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
}

export const ProjectSettingsDialog = observer(function ProjectSettingsDialog({
  open,
  onOpenChange,
}: ProjectSettingsDialogProps) {
  const store = useTangentProject();
  const { data: project } = useProject(store.projectId);
  const hasSecrets = useProjectHasSecrets(store.projectId);
  const sessionId = store.activeSessionId;
  const [traceOpen, setTraceOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[85vh] gap-6 overflow-y-auto outline-none sm:max-w-xl"
          onOpenAutoFocus={focusDialogItself}
        >
          <DialogHeader>
            <InlineStack
              gap="3"
              blockAlign="center"
              wrap="nowrap"
              className="pr-6"
            >
              <InlineStack
                align="center"
                blockAlign="center"
                aria-hidden="true"
                className="size-12 shrink-0 rounded-xl bg-edge-selected/15 text-edge-selected"
              >
                <Icon name="FolderOpen" size="lg" />
              </InlineStack>
              <BlockStack gap="1" className="min-w-0 flex-1">
                <DialogTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Project settings
                </DialogTitle>
                {project ? (
                  <ProjectIdentity project={project} />
                ) : (
                  <DialogDescription>
                    Connections and tools for this project&apos;s agents.
                  </DialogDescription>
                )}
              </BlockStack>
            </InlineStack>
          </DialogHeader>

          {project && (
            <BlockStack gap="5">
              <ProjectDescriptionField
                project={project}
                placeholder="What is this project for?"
                className={FILLED_FIELD}
              />
              <ProjectInstructionsField
                projectId={project.id}
                label={
                  <>
                    <Icon
                      name="Sparkles"
                      size="sm"
                      className="text-edge-selected"
                      aria-hidden="true"
                    />
                    Instructions for agents
                  </>
                }
                placeholder="For example: prefer small, tested steps, and ask before deleting anything."
                className={cn(FILLED_FIELD, "min-h-28")}
              />
            </BlockStack>
          )}

          <SettingsGroup title="Connections">
            <BlockStack gap="4">
              <SettingRow
                icon="Monitor"
                tone="info"
                title="VS Code"
                description="Let agents work in the folder you have open in VS Code."
              >
                <LocalEnvIndicator />
              </SettingRow>
              <SettingRow
                icon="Bot"
                tone="accent"
                title="Agents"
                description={
                  sessionId
                    ? "Attach an agent running on your machine, or see what this session's agents did."
                    : "Start a session to attach a local agent or view its log."
                }
              >
                {sessionId && (
                  <>
                    <AttachAgentButton
                      projectId={store.projectId}
                      sessionId={sessionId}
                    />
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setTraceOpen(true)}
                      {...tracking("projects.settings.view_agent_log")}
                    >
                      <Icon name="ScrollText" size="xs" />
                      View agent log
                    </Button>
                  </>
                )}
              </SettingRow>
            </BlockStack>
          </SettingsGroup>

          {hasSecrets && (
            <SettingsGroup
              title="Secrets"
              description="Values agents and pipelines can use without seeing them."
            >
              <SecretsWindowContent />
            </SettingsGroup>
          )}

          {project && <ProjectHistory project={project} />}
        </DialogContent>
      </Dialog>

      {sessionId && (
        <AgentTraceDialog
          open={traceOpen}
          onOpenChange={setTraceOpen}
          scope={{ projectId: store.projectId, sessionId }}
        />
      )}
    </>
  );
});

function ProjectIdentity({ project }: { project: Project }) {
  return (
    <BlockStack gap="1">
      <InlineStack gap="1" blockAlign="center" wrap="nowrap" className="w-full">
        <DialogDescription asChild>
          <Link
            to={APP_ROUTES.PROJECT_DETAIL}
            params={{ projectId: project.id }}
            title="Open the project page"
            className="min-w-0 rounded-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            {...tracking("projects.open_project_details")}
          >
            <Text size="lg" weight="semibold" className="block truncate">
              {project.name}
            </Text>
          </Link>
        </DialogDescription>
        <PinProjectButton project={project} className="size-7" />
      </InlineStack>
      <ProjectWorkspaceLabel project={project} />
    </BlockStack>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <BlockStack gap="1">
        <Heading level={3} size="sm" weight="semibold">
          {title}
        </Heading>
        {description && (
          <Paragraph size="xs" tone="subdued">
            {description}
          </Paragraph>
        )}
      </BlockStack>
      {children}
    </section>
  );
}

const ROW_TONES = {
  info: "bg-info/15 text-info",
  accent: "bg-edge-selected/15 text-edge-selected",
};

interface SettingRowProps {
  icon: IconName;
  tone: keyof typeof ROW_TONES;
  title: string;
  description: string;
  children?: ReactNode;
}

function SettingRow({
  icon,
  tone,
  title,
  description,
  children,
}: SettingRowProps) {
  return (
    <InlineStack gap="3" blockAlign="start" wrap="nowrap">
      <InlineStack
        align="center"
        blockAlign="center"
        aria-hidden="true"
        className={cn("size-8 shrink-0 rounded-full", ROW_TONES[tone])}
      >
        <Icon name={icon} size="sm" />
      </InlineStack>
      <BlockStack gap="2" className="min-w-0 flex-1">
        <BlockStack>
          <Text size="sm" weight="medium">
            {title}
          </Text>
          <Paragraph size="xs" tone="subdued">
            {description}
          </Paragraph>
        </BlockStack>
        {children && (
          <InlineStack gap="2" blockAlign="center">
            {children}
          </InlineStack>
        )}
      </BlockStack>
    </InlineStack>
  );
}

function ProjectHistory({ project }: { project: Project }) {
  const created = formatDate(project.createdAt);

  return (
    <Paragraph size="xs" tone="subdued" className="border-t pt-4">
      {project.createdBy
        ? `Created by ${project.createdBy} on ${created}`
        : `Created ${created}`}
      {` · Updated ${formatRelativeTime(project.updatedAt)}`}
    </Paragraph>
  );
}
