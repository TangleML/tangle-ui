import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import { AddDocumentDialog } from "./AddDocumentDialog";
import { entityIcon } from "./resourceEntities";

interface AddResourceMenuProps {
  projectId: string;
}

export function AddResourceMenu({ projectId }: AddResourceMenuProps) {
  const [documentOpen, setDocumentOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            {...tracking("projects.add_resource_menu")}
          >
            <Icon name="Plus" size="xs" />
            Add
            <Icon name="ChevronDown" size="xs" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => setDocumentOpen(true)}
            {...tracking("projects.add_document_open")}
          >
            <Icon name={entityIcon("document")} size="sm" />
            Document
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>
            <BlockStack gap="1">
              <Text size="xs" tone="subdued">
                Not yet available here
              </Text>
              <Text size="xs" tone="subdued" className="max-w-56">
                Add a pipeline or an agent session from where it lives, once
                that is built.
              </Text>
            </BlockStack>
          </DropdownMenuLabel>
          <DropdownMenuItem disabled>
            <Icon name={entityIcon("pipeline")} size="sm" />
            Pipeline
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Icon name={entityIcon("agent_session")} size="sm" />
            Agent session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddDocumentDialog
        projectId={projectId}
        open={documentOpen}
        onOpenChange={setDocumentOpen}
      />
    </>
  );
}
