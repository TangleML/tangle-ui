import { type ReactNode, useEffect, useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { Project } from "@/services/projects/types";
import { useProjectInstructions } from "@/services/projects/useProjectInstructions";
import { useUpdateProject } from "@/services/projects/useProjects";

interface ProjectAboutProps {
  project: Project;
  showInstructions?: boolean;
}

export function ProjectAbout({
  project,
  showInstructions = true,
}: ProjectAboutProps) {
  return (
    <BlockStack gap="4">
      <ProjectDescriptionField project={project} />
      {showInstructions && <ProjectInstructionsField projectId={project.id} />}
    </BlockStack>
  );
}

interface FieldAppearance {
  label?: ReactNode;
  labelClassName?: string;
  placeholder?: string;
  className?: string;
}

export function ProjectDescriptionField({
  project,
  label = "Description",
  placeholder = "What this project is for",
  ...appearance
}: { project: Project } & FieldAppearance) {
  const updateProject = useUpdateProject();
  const { track } = useAnalytics();

  const commit = (description: string | null) => {
    updateProject.mutate(
      { id: project.id, input: { description } },
      {
        onSuccess: () => {
          track("projects.update_project_completed", { field: "description" });
        },
      },
    );
  };

  return (
    <EditableText
      label={label}
      placeholder={placeholder}
      value={project.description}
      onCommit={commit}
      {...appearance}
    />
  );
}

export function ProjectInstructionsField({
  projectId,
  label = "Instructions",
  placeholder = "Standing context for agents working on this project",
  ...appearance
}: { projectId: string } & FieldAppearance) {
  const { instructions, isPending, save } = useProjectInstructions(projectId);
  const { track } = useAnalytics();

  const commit = (value: string | null) => {
    save(value ?? "");
    track("projects.update_project_completed", { field: "instructions" });
  };

  return (
    // Until the document has loaded there is nothing to say it is empty, and an
    // edit made before then would replace instructions the reader never saw.
    <EditableText
      label={label}
      placeholder={placeholder}
      hint="Shared with every agent, in every session of this project."
      value={instructions}
      disabled={isPending}
      onCommit={commit}
      {...appearance}
    />
  );
}

interface EditableTextProps {
  label: ReactNode;
  labelClassName?: string;
  placeholder: string;
  className?: string;
  hint?: string;
  value: string | null;
  disabled?: boolean;
  onCommit: (value: string | null) => void;
}

function EditableText({
  label,
  labelClassName,
  placeholder,
  className,
  hint,
  value,
  disabled,
  onCommit,
}: EditableTextProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const saved = value ?? "";
  const [draft, setDraft] = useState(saved);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const handleBlur = () => {
    const trimmed = draft.trim();
    if (trimmed === saved.trim()) return;
    onCommit(trimmed === "" ? null : trimmed);
  };

  return (
    <BlockStack gap="2">
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <Textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        className={className}
      />
      {hint && (
        <Paragraph id={hintId} size="xs" tone="subdued">
          {hint}
        </Paragraph>
      )}
    </BlockStack>
  );
}
