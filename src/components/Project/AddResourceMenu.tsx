import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { DocumentKind } from "@/services/projects/resourceDescriptor";
import { resourceMeta } from "@/services/projects/resourceMeta";
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
  const [documentKind, setDocumentKind] = useState<DocumentKind>("document");
  const [pipelineOpen, setPipelineOpen] = useState(false);

  const openDocument = (kind: DocumentKind) => {
    setDocumentKind(kind);
    setDocumentOpen(true);
  };

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
            onSelect={() => openDocument("document")}
            {...tracking("projects.add_document_open", { kind: "document" })}
          >
            <Icon name={entityIcon("document")} size="sm" />
            Document
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => openDocument("code")}
            {...tracking("projects.add_document_open", { kind: "code" })}
          >
            <Icon name={resourceMeta("code").icon} size="sm" />
            Code
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => setPipelineOpen(true)}
            {...tracking("projects.add_pipeline_open")}
          >
            <Icon name={entityIcon("pipeline")} size="sm" />
            Pipeline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddDocumentDialog
        projectId={projectId}
        open={documentOpen}
        onOpenChange={setDocumentOpen}
        kind={documentKind}
      />

      {/* Mounted only while open so the project page does not read browser
          storage for a picker nobody has asked for. */}
      {pipelineOpen && (
        <AddPipelineDialog
          projectId={projectId}
          resources={resources}
          onOpenChange={setPipelineOpen}
        />
      )}
    </>
  );
}
