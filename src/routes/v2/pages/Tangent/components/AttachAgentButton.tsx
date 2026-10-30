import type { Components } from "react-markdown";

import { Markdown } from "@/components/shared/Markdown/Markdown";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { TANGENT_CONFIG } from "@/config/tangentConfiguration";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import type { DialogProps } from "@/providers/DialogProvider/types";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { CommandBlock } from "@/routes/v2/shared/components/CommandBlock";
import { tracking } from "@/utils/tracking";

/**
 * One coding agent you can attach from. `id` doubles as the ACP agent the skill
 * spawns (baked into the command as the third positional), so the sub-agent
 * matches its host — Claude joins Claude, Codex joins Codex, and so on.
 */
interface AttachTarget {
  id: string;
  label: string;
  command: (url: string, sessionId: string) => string;
}

const TARGETS: AttachTarget[] = [
  {
    id: "claude",
    label: "Claude",
    command: (url, session) => `/tangent-acp-attach ${url} ${session} claude`,
  },
  {
    id: "codex",
    label: "Codex",
    command: (url, session) => `$tangent-acp-attach ${url} ${session} codex`,
  },
  {
    id: "cursor",
    label: "Cursor",
    command: (url, session) => `/tangent-acp-attach ${url} ${session} cursor`,
  },
  {
    id: "pi",
    label: "Pi",
    command: (url, session) => `/skill:tangent-acp-attach ${url} ${session} pi`,
  },
];

const INLINE_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
};

interface AttachAgentDialogProps {
  baseUrl: string;
  sessionId: string;
}

function AttachAgentDialog({
  close,
  baseUrl,
  sessionId,
}: DialogProps<void, AttachAgentDialogProps>) {
  const { dialogDescription, commandInstructions } =
    TANGENT_CONFIG.ui.AttachLocalAgentButton;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Attach an agent</DialogTitle>
        <DialogDescription>
          <Markdown
            body={dialogDescription}
            components={INLINE_MARKDOWN_COMPONENTS}
          />
        </DialogDescription>
      </DialogHeader>
      <BlockStack gap="1">
        <Tabs defaultValue={TARGETS[0].id} className="w-full">
          <TabsList className="w-full">
            {TARGETS.map((target) => (
              <TabsTrigger key={target.id} value={target.id}>
                {target.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TARGETS.map((target) => (
            <TabsContent key={target.id} value={target.id}>
              <Markdown body={commandInstructions} />
              <CommandBlock
                command={target.command(baseUrl, sessionId)}
                contained
                trackingId="projects.attach_agent.copy_command"
                trackingMetadata={{ agent: target.id }}
              />
            </TabsContent>
          ))}
        </Tabs>
      </BlockStack>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => close()}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

interface AttachAgentButtonProps {
  projectId: string;
  sessionId: string;
}

/**
 * No auth UI here on purpose: the attach skill resolves its own
 * authorization — self-minting a session-scoped token and running the SSO
 * login when the Shell is Okta-protected.
 */
export function AttachAgentButton({
  projectId,
  sessionId,
}: AttachAgentButtonProps) {
  const { open } = useDialog();
  const { baseUrl } = useTangentBaseUrl(projectId);

  if (!baseUrl) return null;

  const openDialog = () =>
    void open<void, AttachAgentDialogProps>({
      component: AttachAgentDialog,
      props: { baseUrl, sessionId },
      routeKey: "attach-agent",
      size: "sm",
    }).catch(convertCancelErrorTo(undefined));

  return (
    <Button
      variant="outline"
      size="xs"
      aria-label="Attach a local agent"
      title="Attach a local agent"
      className="shrink-0"
      onClick={openDialog}
      {...tracking("projects.attach_agent")}
    >
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Icon name="Laptop" size="xs" />
        <Text size="xs">Attach a local agent</Text>
      </InlineStack>
    </Button>
  );
}
