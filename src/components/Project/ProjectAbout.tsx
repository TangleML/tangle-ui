import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { Project, UpdateProjectInput } from "@/services/projects/types";
import { useUpdateProject } from "@/services/projects/useProjects";

interface ProjectAboutProps {
  project: Project;
  showNotes?: boolean;
}

export function ProjectAbout({ project, showNotes = true }: ProjectAboutProps) {
  const updateProject = useUpdateProject();
  const { track } = useAnalytics();

  const commit = (
    field: "description" | "notes",
    input: UpdateProjectInput,
  ) => {
    updateProject.mutate(
      { id: project.id, input },
      {
        onSuccess: () => {
          track("projects.update_project_completed", { field });
        },
      },
    );
  };

  return (
    <BlockStack gap="4">
      <EditableText
        id="project-description"
        label="Description"
        value={project.description}
        placeholder="What this project is for"
        onCommit={(value) => commit("description", { description: value })}
      />
      {showNotes && (
        <EditableText
          id="project-notes"
          label="Notes"
          value={project.notes}
          placeholder="Anything worth knowing about this project"
          onCommit={(value) => commit("notes", { notes: value })}
        />
      )}
    </BlockStack>
  );
}

interface EditableTextProps {
  id: string;
  label: string;
  value: string | null;
  placeholder: string;
  onCommit: (value: string | null) => void;
}

function EditableText({
  id,
  label,
  value,
  placeholder,
  onCommit,
}: EditableTextProps) {
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
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
    </BlockStack>
  );
}
