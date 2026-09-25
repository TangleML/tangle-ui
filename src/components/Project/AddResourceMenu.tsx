import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

import { AddDocumentDialog } from "./AddDocumentDialog";
import { AddPipelineDialog } from "./AddPipelineDialog";
import { entityIcon } from "./resourceEntities";

interface AddResourceMenuProps {
  projectId: string;
  resources: ProjectResourceSummary[];
}

export function AddResourceMenu({
  projectId,
  resources,
}: AddResourceMenuProps) {
  const [documentOpen, setDocumentOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);

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

          <DropdownMenuItem
            onSelect={() => setPipelineOpen(true)}
            {...tracking("projects.add_pipeline_open")}
          >
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

      {/* Mounted only while open so the project page does not read browser
          storage for a picker nobody has asked for. */}
      {pipelineOpen && (
        <AddPipelineDialog
          projectId={projectId}
          resources={resources}
          open
          onOpenChange={setPipelineOpen}
        />
      )}
    </>
  );
}
