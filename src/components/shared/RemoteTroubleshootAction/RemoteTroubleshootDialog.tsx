import { CheckCircle2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Paragraph, Text } from "@/components/ui/typography";

interface RemoteTroubleshootDialogProps {
  open: boolean;
  title: string;
  description?: string;
  successTitle: string;
  successMessage: string;
  onSubmit: (additionalComments: string) => Promise<void>;
  onClose: () => void;
}

type DialogState = "input" | "submitting" | "success";

export function RemoteTroubleshootDialog({
  open,
  title,
  description,
  successTitle,
  successMessage,
  onSubmit,
  onClose,
}: RemoteTroubleshootDialogProps) {
  const [state, setState] = useState<DialogState>("input");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setState("input");
      setComments("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && state === "input" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, state]);

  const handleSubmit = async () => {
    setState("submitting");
    setError(null);
    try {
      await onSubmit(comments);
      setState("success");
    } catch (err) {
      setState("input");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  const canClose = state !== "submitting";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && canClose) onClose();
      }}
    >
      <DialogContent>
        {state === "success" ? (
          <BlockStack gap="4" className="items-center py-4 text-center">
            <CheckCircle2Icon className="w-12 h-12 text-success animate-in zoom-in-50 duration-300" />
            <BlockStack gap="2" className="items-center">
              <DialogTitle asChild>
                <Heading level={3}>{successTitle}</Heading>
              </DialogTitle>
              <DialogDescription asChild>
                <Paragraph tone="subdued">{successMessage}</Paragraph>
              </DialogDescription>
            </BlockStack>
            <Button onClick={onClose}>Done</Button>
          </BlockStack>
        ) : (
          <>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
            <Textarea
              ref={textareaRef}
              aria-label="Additional comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional: add any context or questions..."
              className="min-h-28"
              disabled={state === "submitting"}
            />
            {error && (
              <Text size="sm" tone="critical">
                {error}
              </Text>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={state === "submitting"}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={state === "submitting"}>
                {state === "submitting" ? (
                  <>
                    <Spinner size={16} />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
