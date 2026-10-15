import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { DialogProps } from "@/providers/DialogProvider/types";
import type { WorkspaceSecret } from "@/services/projects/types";
import {
  useCreateWorkspaceSecret,
  useReplaceWorkspaceSecret,
} from "@/services/projects/useWorkspaceSecrets";
import { toEndOfDayUTC } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { SECRET_MUTATED_EVENT } from "./workspaceSecretEvents";

export interface WorkspaceSecretDialogProps {
  workspaceId: string;
  secret?: WorkspaceSecret;
}

function nameProblem(name: string): string | undefined {
  if (name === "") return "Name cannot be empty";
  if (name.includes("/")) return "Name cannot contain /";
  return undefined;
}

const describedBy = (...ids: (string | false)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

export function WorkspaceSecretDialog({
  close,
  cancel,
  workspaceId,
  secret,
}: DialogProps<WorkspaceSecret, WorkspaceSecretDialogProps>) {
  const replacing = secret !== undefined;
  const originalDescription = secret?.description ?? "";

  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(originalDescription);
  const [expiresOn, setExpiresOn] = useState<Date | undefined>();
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const createSecret = useCreateWorkspaceSecret(workspaceId);
  const replaceSecret = useReplaceWorkspaceSecret(workspaceId);
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const nameId = useId();
  const nameErrorId = useId();
  const valueId = useId();
  const valueHintId = useId();
  const valueErrorId = useId();
  const descriptionId = useId();
  const expiryId = useId();
  const expiryHintId = useId();

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const nameError = replacing ? undefined : nameProblem(trimmedName);
  const valueError = value === "" ? "Value cannot be empty" : undefined;
  const showNameError = submitAttempted && nameError !== undefined;
  const showValueError = submitAttempted && valueError !== undefined;
  const isSaving = createSecret.isPending || replaceSecret.isPending;
  const trackingPrefix = replacing
    ? "projects.workspace_secrets.replace"
    : "projects.workspace_secrets.add";

  const expiresAt = expiresOn ? toEndOfDayUTC(expiresOn) : undefined;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (nameError || valueError || isSaving) return;

    if (replacing) {
      replaceSecret.mutate(
        {
          name: secret.name,
          input: {
            value,
            description:
              trimmedDescription === originalDescription
                ? undefined
                : trimmedDescription,
            expiresAt,
          },
        },
        {
          onSuccess: (saved) => {
            track(SECRET_MUTATED_EVENT, { action: "replaced" });
            notify("Secret replaced", "success");
            close(saved);
          },
        },
      );
      return;
    }

    createSecret.mutate(
      {
        name: trimmedName,
        value,
        description: trimmedDescription === "" ? undefined : trimmedDescription,
        expiresAt,
      },
      {
        onSuccess: (saved) => {
          track(SECRET_MUTATED_EVENT, { action: "created" });
          notify("Secret added", "success");
          close(saved);
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {replacing ? `Replace ${secret.name}` : "Add a secret"}
        </DialogTitle>
        <DialogDescription>
          {replacing
            ? "Runs that start after this use the new value."
            : "Every project in this workspace can use it."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <BlockStack gap="4">
          {!replacing && (
            <BlockStack gap="2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                value={name}
                placeholder="API_KEY"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={showNameError}
                aria-describedby={showNameError ? nameErrorId : undefined}
                autoFocus
              />
              {showNameError && (
                <FieldMessage
                  id={nameErrorId}
                  icon="CircleAlert"
                  tone="critical"
                >
                  {nameError}
                </FieldMessage>
              )}
            </BlockStack>
          )}

          <BlockStack gap="2">
            <Label htmlFor={valueId}>{replacing ? "New value" : "Value"}</Label>
            <Input
              id={valueId}
              type="password"
              value={value}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={showValueError}
              aria-describedby={describedBy(
                valueHintId,
                showValueError && valueErrorId,
              )}
              autoFocus={replacing}
            />
            {showValueError && (
              <FieldMessage
                id={valueErrorId}
                icon="CircleAlert"
                tone="critical"
              >
                {valueError}
              </FieldMessage>
            )}
            <FieldMessage id={valueHintId}>
              {"Stored securely. It can't be viewed after saving."}
            </FieldMessage>
          </BlockStack>

          <BlockStack gap="2">
            <Label htmlFor={descriptionId}>Description (optional)</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this secret is for"
            />
          </BlockStack>

          <BlockStack gap="2">
            <Label htmlFor={expiryId}>Expires (optional)</Label>
            <ExpiryDatePicker
              id={expiryId}
              value={expiresOn}
              onChange={setExpiresOn}
              describedBy={expiryHintId}
            />
            <FieldMessage id={expiryHintId}>
              {replacing
                ? "Leave empty to keep it unchanged."
                : "A reminder only. The secret keeps working after this date."}
            </FieldMessage>
          </BlockStack>

          <DialogFooter className="w-full">
            <InlineStack gap="2" className="w-full" align="end">
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                {...tracking(`${trackingPrefix}_cancel`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                {...tracking(`${trackingPrefix}_submit`)}
              >
                {replacing ? "Replace" : "Add secret"}
              </Button>
            </InlineStack>
          </DialogFooter>
        </BlockStack>
      </form>
    </>
  );
}
