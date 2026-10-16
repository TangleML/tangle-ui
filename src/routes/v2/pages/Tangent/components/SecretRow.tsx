import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { WorkspaceSecret } from "@/services/projects/types";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { ListRowIcon } from "./ListRowIcon";

interface SecretRowProps {
  secret: WorkspaceSecret;
  disabled: boolean;
  onReplace: (secret: WorkspaceSecret) => void;
  onDelete: (secret: WorkspaceSecret) => void;
}

function secretDetail(secret: WorkspaceSecret): string {
  if (secret.description) return secret.description;

  const updated = formatRelativeTime(secret.updatedAt);
  return secret.createdBy
    ? `Added by ${secret.createdBy} · updated ${updated}`
    : `Updated ${updated}`;
}

export function SecretRow({
  secret,
  disabled,
  onReplace,
  onDelete,
}: SecretRowProps) {
  const detail = secretDetail(secret);

  return (
    <InlineStack
      gap="3"
      blockAlign="start"
      wrap="nowrap"
      className="w-full px-2 py-2"
    >
      <ListRowIcon icon="KeyRound" />
      <BlockStack align="start" className="min-w-0 flex-1">
        <Text
          size="sm"
          weight="medium"
          font="mono"
          className="max-w-full truncate"
          title={secret.name}
        >
          {secret.name}
        </Text>
        <Text
          size="xs"
          tone="subdued"
          className="max-w-full truncate"
          title={detail}
        >
          {detail}
        </Text>
      </BlockStack>
      {secret.canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Secret actions: ${secret.name}`}
              {...tracking("projects.workspace_secrets.row_menu")}
            >
              <Icon name="EllipsisVertical" size="sm" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => onReplace(secret)}
              {...tracking("projects.workspace_secrets.replace_open")}
            >
              <Icon name="RefreshCw" size="sm" />
              Replace value
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => onDelete(secret)}
              {...tracking("projects.workspace_secrets.delete_open")}
            >
              <Icon name="Trash" size="sm" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </InlineStack>
  );
}
