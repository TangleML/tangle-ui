import { type ReactNode, useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

import TooltipButton from "../../Buttons/TooltipButton";
import { ConfirmationDialog } from "../../Dialogs";

export type Action = {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  confirmation?: string;
  onClick: () => void;
  className?: string;
} & (
  | { icon: IconName; content?: never }
  | { content: ReactNode; icon?: never }
);

interface ActionBlockProps {
  title?: string;
  actions: Action[];
  className?: string;
}

export const ActionBlock = ({
  title,
  actions,
  className,
}: ActionBlockProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<Action | null>(null);

  const openConfirmationDialog = (action: Action) => {
    return () => {
      setDialogAction(action);
      setIsOpen(true);
    };
  };

  const handleConfirm = () => {
    setIsOpen(false);
    dialogAction?.onClick();
    setDialogAction(null);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setDialogAction(null);
  };

  return (
    <>
      <BlockStack className={className}>
        {title && <Heading level={3}>{title}</Heading>}
        <InlineStack gap="2">
          {actions.map((action) => {
            if (action.hidden) {
              return null;
            }

            return (
              <TooltipButton
                key={action.label}
                data-testid={`action-${action.label}`}
                variant={action.destructive ? "destructive" : "outline"}
                tooltip={action.label}
                onClick={
                  action.confirmation
                    ? openConfirmationDialog(action)
                    : action.onClick
                }
                disabled={action.disabled}
                className={action.className}
              >
                {action.content === undefined && action.icon ? (
                  <Icon name={action.icon} />
                ) : (
                  action.content
                )}
              </TooltipButton>
            );
          })}
        </InlineStack>
      </BlockStack>

      <ConfirmationDialog
        isOpen={isOpen}
        title={dialogAction?.label}
        description={dialogAction?.confirmation}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};
