import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDialog } from "@/hooks/useDialog";
import useToastNotification from "@/hooks/useToastNotification";
import {
  DialogCancelledError,
  type DialogProps,
} from "@/providers/DialogProvider/types";

import { InlineStack } from "../ui/layout";

interface DialogResult {
  message: string;
}

export function TestDialogButton() {
  const { open: openDialog } = useDialog();
  const notify = useToastNotification();

  const { mutate: showTestDialog, isPending } = useMutation({
    mutationFn: async () => {
      const result = await openDialog<DialogResult>({
        component: TestDialog,
        routeKey: "test-dialog",
      });

      notify(`Dialog result: ${result?.message}`, "info");
    },
    onError: (error) => {
      notify(`Error: ${error.message}`, "error");
    },
  });

  return (
    <Button onClick={() => showTestDialog()} disabled={isPending}>
      {isPending ? <Spinner /> : null}
      Open Test Dialog
    </Button>
  );
}

export function TestDialog({ close, cancel }: DialogProps) {
  const [message, setMessage] = useState("Hello, world!");
  const notify = useToastNotification();
  const confirmationDialog = useConfirmationDialog();

  const { mutate: confirmDialog, isPending: isConfirming } = useMutation({
    mutationFn: async () => {
      const result = await confirmationDialog({
        title: "Nested Dialog",
        description:
          "This is a nested confirmation dialog. It will be automatically stacked and displayed",
      }).catch((error) => {
        /**
         * Approach to detect "cancellation or closing" of the nested dialog
         */
        if (error instanceof DialogCancelledError) {
          return null;
        }
        throw error;
      });

      /**
       * Reading results. Result is typed
       */
      return result?.confirmed ? "confirmed" : "cancelled";
    },
    onSuccess: (result) => {
      notify(`Confirmation dialog result: ${result}`, "info");
    },
    onError: (error) => {
      notify(`Error: ${error.message}`, "error");
    },
  });

  return (
    <>
      <DialogTitle>Demo Dialog</DialogTitle>
      <DialogDescription>
        This is a demo dialog. It will pass the message to the parent component.
      </DialogDescription>

      <InlineStack gap="2" className="w-full" align="space-between">
        <Input
          type="text"
          value={message}
          className="flex-1"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setMessage(e.target.value)
          }
        />

        <Button
          variant="outline"
          onClick={() => confirmDialog()}
          disabled={isConfirming}
        >
          {isConfirming ? <Spinner /> : null}
          Call Nested Dialog
        </Button>
      </InlineStack>

      <DialogFooter>
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={() => close({ message })}>Show toast message</Button>
      </DialogFooter>
    </>
  );
}

export interface ConfirmationDialogResult {
  confirmed: boolean;
}

export function useConfirmationDialog() {
  const { open: openDialog } = useDialog();
  return useCallback(
    async (
      {
        title,
        description,
      }: {
        title: string;
        description: string;
      } = {
        title: "Confirmation",
        description: "Are you sure you want to proceed?",
      },
    ) => {
      return await openDialog<
        ConfirmationDialogResult,
        { title: string; description: string }
      >({
        component: ConfirmationDialog,
        props: {
          title,
          description,
        },
        routeKey: "confirmation",
      });
    },
    [openDialog],
  );
}

export function ConfirmationDialog({
  close,
  title,
  description,
}: { title: string; description: string } & DialogProps) {
  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>

      <DialogFooter>
        <Button variant="outline" onClick={() => close({ confirmed: false })}>
          Cancel
        </Button>
        <Button onClick={() => close({ confirmed: true })}>Confirm</Button>
      </DialogFooter>
    </>
  );
}
