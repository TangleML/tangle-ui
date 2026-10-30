import { Link } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Paragraph, Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/router";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProjectLocalEnv } from "@/routes/v2/pages/Tangent/hooks/useProjectLocalEnv";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import type { TangentEnvironment } from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";
import {
  buildCursorConnectUrl,
  buildVscodeConnectUrl,
  type ConnectUrlParams,
} from "@/routes/v2/pages/Tangent/services/vscodeConnect";
import { useProject } from "@/services/projects/useProjects";
import { API_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

const CONNECT_STEPS = [
  "Open a connect link below and confirm the Tangent URL.",
];

function hostLabel(environment: TangentEnvironment): string {
  const separator = environment.environmentId.indexOf(":");
  return separator === -1
    ? environment.environmentId
    : environment.environmentId.slice(separator + 1);
}

function environmentLabel(environment: TangentEnvironment): string {
  return environment.metadata?.windowName ?? hostLabel(environment);
}

export const LocalEnvIndicator = observer(function LocalEnvIndicator() {
  const store = useTangentProject();
  const { baseUrl } = useTangentBaseUrl(store.projectId);
  const { sessions } = useProjectSessions(store.projectId);
  const { data: project } = useProject(store.projectId);
  const { localEnvironments, isLocalEnvConnected } = useProjectLocalEnv(
    baseUrl,
    sessions.map((session) => session.sessionId),
  );

  if (!baseUrl) return null;

  const connectParams = {
    shellUrl: baseUrl,
    apiUrl: API_URL || window.location.origin,
    projectId: store.projectId,
    projectName: project?.name,
  };

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      {isLocalEnvConnected && (
        <LocalEnvConnectedBadge environments={localEnvironments} />
      )}
      <ConnectEditorPopover
        connectParams={connectParams}
        isConnected={isLocalEnvConnected}
      />
    </InlineStack>
  );
});

function LocalEnvConnectedBadge({
  environments,
}: {
  environments: TangentEnvironment[];
}) {
  const [single] = environments;
  const label =
    environments.length === 1
      ? `Local env · ${environmentLabel(single)}`
      : `Local env (${environments.length})`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge asChild variant="outline" shape="rounded" size="sm">
          <button type="button" aria-label="Local environment connected">
            <span
              className="size-2 rounded-full bg-success"
              aria-hidden="true"
            />
            <Icon name="Monitor" size="xs" aria-hidden="true" />
            {label}
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <BlockStack gap="3">
          {environments.map((environment) => (
            <EnvironmentDetails
              key={environment.environmentId}
              environment={environment}
            />
          ))}
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}

function EnvironmentDetails({
  environment,
}: {
  environment: TangentEnvironment;
}) {
  const { metadata, owner, toolCount, subagentCount } = environment;

  return (
    <BlockStack gap="1">
      <Text size="sm" weight="semibold">
        {environmentLabel(environment)}
      </Text>
      <BlockStack gap="1">
        {metadata?.workspacePath && (
          <EnvironmentDetailRow
            label="Workspace"
            value={metadata.workspacePath}
          />
        )}
        {metadata?.editor && (
          <EnvironmentDetailRow label="Editor" value={metadata.editor} />
        )}
        {owner && <EnvironmentDetailRow label="Owner" value={owner} />}
        <EnvironmentDetailRow label="Tools" value={String(toolCount)} />
        <EnvironmentDetailRow
          label="Sub-agents"
          value={String(subagentCount)}
        />
      </BlockStack>
    </BlockStack>
  );
}

function EnvironmentDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <InlineStack gap="2" blockAlign="start">
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      <Text size="xs">{value}</Text>
    </InlineStack>
  );
}

function ConnectEditorPopover({
  connectParams,
  isConnected,
}: {
  connectParams: ConnectUrlParams;
  isConnected: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild {...tracking("projects.connect_editor")}>
        {isConnected ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Connect another editor window"
            title="Connect another editor window"
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Icon name="Plug" size="sm" />
          </Button>
        ) : (
          <Button variant="outline" size="xs">
            <InlineStack gap="1" blockAlign="center">
              <Icon name="Plug" size="xs" />
              Connect VS Code
            </InlineStack>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <BlockStack gap="3">
          <BlockStack gap="1">
            <Text size="sm" weight="semibold">
              Use your machine as a local environment
            </Text>
            <Paragraph size="xs" tone="subdued">
              The VS Code extension lets agents in this project run sub-agents
              and file tools in your open workspace folder.
            </Paragraph>
          </BlockStack>
          <ol className="list-decimal space-y-1 pl-4 text-xs">
            <li>
              <Text size="xs">
                <Link
                  to={APP_ROUTES.SETTINGS_VSCODE}
                  className="text-primary underline"
                >
                  Install the Tangent Local Agent extension in VS Code or
                  Cursor.
                </Link>
              </Text>
            </li>
            {CONNECT_STEPS.map((step) => (
              <li key={step}>
                <Text size="xs">{step}</Text>
              </li>
            ))}
          </ol>
          <InlineStack fill>
            <Button asChild size="sm" className="flex-1 gap-2 rounded-r-none">
              <a
                href={buildVscodeConnectUrl(connectParams)}
                {...tracking("projects.connect_vscode.open_link")}
              >
                <Icon name="ExternalLink" size="xs" />
                Connect in VS Code
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-l-none border-l border-l-primary-foreground/20 px-1.5"
                  aria-label="More editors"
                  {...tracking("projects.connect_editor_menu")}
                >
                  <Icon name="ChevronDown" size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  asChild
                  {...tracking("projects.connect_cursor.open_link")}
                >
                  <a href={buildCursorConnectUrl(connectParams)}>
                    <Icon name="ExternalLink" size="sm" />
                    Connect in Cursor
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </InlineStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
