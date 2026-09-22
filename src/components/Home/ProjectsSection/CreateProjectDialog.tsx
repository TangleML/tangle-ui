import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

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
import { APP_ROUTES } from "@/routes/appRoutes";
import { useCreateProject } from "@/services/projects/useProjects";
import { tracking } from "@/utils/tracking";

interface CreateProjectDialogProps {
  workspaceId: string;
  trigger: ReactNode;
}

export function CreateProjectDialog({
  workspaceId,
  trigger,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [description, setDescription] = useState("");

  const createProject = useCreateProject();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      track("projects.create_project_dialog_impression");
    }
  }, [open, track]);

  const trimmedName = name.trim();
  const nameError = trimmedName === "" ? "Name cannot be empty" : undefined;
  // Create stays pressable while the name is empty, because pressing it is what
  // asks for the complaint. Revealing the complaint on blur instead grew the
  // dialog between mousedown and mouseup, which moved Cancel out from under the
  // pointer and swallowed the click.
  const canSubmit = !nameError && !createProject.isPending;

  const resetForm = () => {
    setName("");
    setSubmitAttempted(false);
    setDescription("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) return;

    const trimmedDescription = description.trim();

    createProject.mutate(
      {
        workspaceId,
        name: trimmedName,
        description: trimmedDescription === "" ? undefined : trimmedDescription,
      },
      {
        onSuccess: (project) => {
          track("projects.create_project_completed", {
            has_description: trimmedDescription !== "",
          });
          notify("Project created", "success");
          resetForm();
          setOpen(false);
          void navigate({
            to: APP_ROUTES.TANGENT_PROJECT,
            params: { projectId: project.id },
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild {...tracking("projects.create_project_open")}>
        {trigger}
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
                aria-invalid={submitAttempted && nameError !== undefined}
                placeholder="Churn model"
                autoFocus
              />
              {submitAttempted && nameError && (
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
                  disabled={createProject.isPending}
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
