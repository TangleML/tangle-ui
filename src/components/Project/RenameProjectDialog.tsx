import { type FormEvent, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { Project } from "@/services/projects/types";
import { useUpdateProject } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

interface RenameProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: RenameProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [touched, setTouched] = useState(false);

  const updateProject = useUpdateProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) {
      setName(project.name);
      setTouched(false);
      track("projects.rename_project_dialog_impression");
    }
  }, [open, project.name, track]);

  const trimmedName = name.trim();
  const nameError = trimmedName === "" ? "Name cannot be empty" : undefined;
  const canSubmit = !nameError && !updateProject.isPending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (trimmedName === project.name) {
      onOpenChange(false);
      return;
    }

    updateProject.mutate(
      { id: project.id, input: { name: trimmedName } },
      {
        onSuccess: () => {
          track("projects.rename_project_completed");
          notify("Project renamed", "success");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="rename-project-name">Name</Label>
              <Input
                id="rename-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && nameError !== undefined}
                autoFocus
              />
              {touched && nameError && (
                <Alert variant="destructive">
                  <Icon name="CircleAlert" />
                  <AlertDescription>{nameError}</AlertDescription>
                </Alert>
              )}
            </BlockStack>

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  {...tracking("projects.rename_project_cancel")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  {...tracking("projects.rename_project_submit")}
                >
                  Rename
                </Button>
              </InlineStack>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
