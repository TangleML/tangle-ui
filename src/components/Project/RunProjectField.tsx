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

interface RunProjectFieldProps {
  pipelineName: string | undefined;
  value: string | undefined;
  onChange: (projectId: string | undefined) => void;
}

/**
 * Attribution is written once, when the run is created, so this is the last
 * chance to change it. What it chooses is spent on this submission alone and
 * does not disturb the editor's own project context.
 */
export function RunProjectField({
  pipelineName,
  value,
  onChange,
}: RunProjectFieldProps) {
  const { enabled, projectName } = useRunProjectContext();
  const { memberships } = usePipelineProjects(
    enabled ? pipelineName : undefined,
  );

  const options = memberships.map(({ project }) => ({
    id: project.id,
    name: project.name,
  }));
  if (value && !options.some((option) => option.id === value)) {
    options.unshift({ id: value, name: projectName ?? "Current project" });
  }

  if (!enabled || options.length === 0) {
    return null;
  }

  return (
    <BlockStack gap="2">
      <Paragraph tone="subdued" size="sm">
        Project
      </Paragraph>
      <Select
        value={value ?? NO_PROJECT}
        onValueChange={(next) =>
          onChange(next === NO_PROJECT ? undefined : next)
        }
      >
        <SelectTrigger className="w-full" aria-label="Project for this run">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT}>No project</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </BlockStack>
  );
}
