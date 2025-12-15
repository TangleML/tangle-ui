import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReferenceWithDigest } from "@/utils/componentSpec";

import { withSuspenseWrapper } from "../SuspenseWrapper";
import TaskImplementation from "../TaskDetails/Implementation";
import { ComponentSpecProperty } from "./ComponentSpecProperty";
import { trimDigest } from "./utils/digest";

export const ComponentQuickDetailsDialogTrigger = ({
  component,
}: {
  component: ComponentReferenceWithDigest;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="link-info"
        size="inline-xs"
        onClick={() => setIsOpen(true)}
      >
        {trimDigest(component.digest)}
      </Button>
      {/* not showing the dialog prevents excessive requests */}
      {isOpen ? (
        <ComponentQuickDetailsDialog
          component={component}
          open={isOpen}
          onOpenChange={setIsOpen}
        />
      ) : null}
    </>
  );
};

const ComponentQuickDetailsDialogSkeleton = () => {
  /**
   * this appears as a tiny spinner inline, next to the trigger.
   */
  return <Spinner size={10} />;
};

const ComponentQuickDetailsDialog = withSuspenseWrapper(
  ({
    component,
    open,
    onOpenChange,
  }: {
    component: ComponentReferenceWithDigest;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    const hydratedComponent = useHydrateComponentReference(component);

    if (!hydratedComponent) {
      return null;
    }

    const displayName = hydratedComponent.name;

    return (
      <Dialog modal open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl min-w-2xl overflow-hidden"
          aria-label={`${displayName} component details`}
        >
          <DialogDescription className="hidden">
            Implementation details for the &quot;{displayName}&quot; component
            of version {trimDigest(hydratedComponent.digest)}.
          </DialogDescription>
          <DialogTitle className="flex items-center gap-2 mr-5">
            <Text>
              {displayName}: {trimDigest(hydratedComponent.digest)}
            </Text>
          </DialogTitle>

          <BlockStack gap="1" className="h-[400px]" align="stretch">
            <ComponentSpecProperty
              label="Digest"
              value={hydratedComponent.digest}
            />

            <TaskImplementation
              displayName={displayName}
              componentRef={hydratedComponent}
            />
          </BlockStack>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
  ComponentQuickDetailsDialogSkeleton,
);
