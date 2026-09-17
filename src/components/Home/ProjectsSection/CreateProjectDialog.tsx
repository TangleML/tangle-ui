import { type FormEvent, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useCreateProject } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

interface CreateProjectDialogProps {
  workspaceId: string;
}

export function CreateProjectDialog({ workspaceId }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");

  const createProject = useCreateProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) {
      track("projects.create_project_dialog_impression");
    }
  }, [open, track]);

  const trimmedName = name.trim();
  const nameError = trimmedName === "" ? "Name cannot be empty" : undefined;
  const canSubmit = !nameError && !createProject.isPending;

  const resetForm = () => {
    setName("");
    setNameTouched(false);
    setDescription("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    const trimmedDescription = description.trim();

    createProject.mutate(
      {
        workspaceId,
        name: trimmedName,
        description: trimmedDescription === "" ? undefined : trimmedDescription,
      },
      {
        onSuccess: () => {
          track("projects.create_project_completed", {
            has_description: trimmedDescription !== "",
          });
          notify("Project created", "success");
          resetForm();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" {...tracking("projects.create_project_open")}>
          <Icon name="FolderPlus" size="lg" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="create-project-name">Name</Label>
              <Input
                id="create-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setNameTouched(true)}
                aria-invalid={nameTouched && nameError !== undefined}
                placeholder="Churn model"
                autoFocus
              />
              {nameTouched && nameError && (
                <Alert variant="destructive">
                  <Icon name="CircleAlert" />
                  <AlertDescription>{nameError}</AlertDescription>
                </Alert>
              )}
            </BlockStack>

            <BlockStack gap="2">
              <Label htmlFor="create-project-description">
                Description (optional)
              </Label>
              <Textarea
                id="create-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this project is for"
              />
            </BlockStack>

            <DialogFooter className="w-full">
              <InlineStack gap="2" className="w-full" align="end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  {...tracking("projects.create_project_cancel")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  {...tracking("projects.create_project_submit")}
                >
                  Create
                </Button>
              </InlineStack>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
