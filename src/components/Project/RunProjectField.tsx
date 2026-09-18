import { BlockStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paragraph } from "@/components/ui/typography";
import { usePipelineProjects } from "@/services/projects/usePipelineProjects";

import { useRunProjectContext } from "./useRunProjectContext";

const NO_PROJECT = "none";

export function RunProjectField({
  pipelineName,
}: {
  pipelineName: string | undefined;
}) {
  const { enabled, projectId, setProjectId } = useRunProjectContext();
  const projects = usePipelineProjects(enabled ? pipelineName : undefined);

  if (!enabled || projects.length === 0) {
    return null;
  }

  return (
    <BlockStack gap="2">
      <Paragraph tone="subdued" size="sm">
        Project
      </Paragraph>
      <Select
        value={projectId ?? NO_PROJECT}
        onValueChange={(value) =>
          setProjectId(value === NO_PROJECT ? undefined : value)
        }
      >
        <SelectTrigger className="w-full" aria-label="Project for this run">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>No project</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </BlockStack>
  );
}
