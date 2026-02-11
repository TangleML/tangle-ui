import { Code, InfoIcon, ListFilter } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference } from "@/utils/componentSpec";

import InfoIconButton from "../Buttons/InfoIconButton";
import { ComponentFavoriteToggle } from "../FavoriteComponentToggle";
import { InfoBox } from "../InfoBox";
import { PublishComponent } from "../ManageComponent/PublishComponent";
import { PublishedComponentDetails } from "../ManageComponent/PublishedComponentDetails";
import { useFlagValue } from "../Settings/useFlags";
import { withSuspenseWrapper } from "../SuspenseWrapper";
import { TaskDetails, TaskImplementation, TaskIO } from "../TaskDetails";
import TaskActions from "../TaskDetails/Actions";
import { DialogContext } from "./dialog.context";

interface ComponentDetailsProps {
  component: ComponentReference;
  displayName: string;
  readOnly?: boolean;
  trigger?: ReactNode;
  onClose?: () => void;
}

const ComponentDetailsDialogContentSkeleton = () => {
  return (
    <BlockStack className="h-full" gap="3">
      <BlockStack>
        <InlineStack gap="2" align="space-between" className="w-full">
          <Skeleton size="lg" shape="button" />
          <Skeleton size="lg" shape="button" />
          <Skeleton size="lg" shape="button" />
        </InlineStack>
      </BlockStack>
      <BlockStack className="h-[40vh] mt-4" gap="2" inlineAlign="space-between">
        <BlockStack gap="2">
          <Skeleton size="full" />
          <Skeleton size="half" />
          <Skeleton size="full" />
          <Skeleton size="half" />
          <Skeleton size="full" />
        </BlockStack>
        <BlockStack gap="2" align="end">
          <Skeleton size="lg" shape="button" />
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
};

const ComponentDetailsDialogContent = withSuspenseWrapper(
  ({ component, displayName, readOnly }: ComponentDetailsProps) => {
    const remoteComponentLibrarySearchEnabled = useFlagValue(
      "remote-component-library-search",
    );

    const componentRef = useHydrateComponentReference(component);

    if (!componentRef) {
      return (
        <InfoBox title="Component not found" variant="error">
          Failed to load component.
        </InfoBox>
      );
    }

    const componentSpec = componentRef.spec;

    const hasPublishSection =
      remoteComponentLibrarySearchEnabled && component.owned;

    return (
      <>
        {!componentSpec && (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">
              Component specification not found.
            </span>
          </div>
        )}

        {componentSpec && (
          <Tabs
            defaultValue="details"
            className="mt-4 flex flex-col"
            data-testid="component-details-tabs"
          >
            <TabsList className="w-full mb-4">
              <TabsTrigger value="details" className="flex-1">
                <InfoIcon className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="io" className="flex-1">
                <ListFilter className="h-4 w-4" />
                Inputs/Outputs
              </TabsTrigger>
              <TabsTrigger value="implementation" className="flex-1">
                <Code className="h-4 w-4" />
                Implementation
              </TabsTrigger>

              {hasPublishSection && (
                <TabsTrigger value="publish" className="flex-1">
                  <Icon name="LibraryBig" />
                  Publish
                </TabsTrigger>
              )}
            </TabsList>

            <div className="overflow-auto h-[40vh]">
              <TabsContent value="details">
                {remoteComponentLibrarySearchEnabled && (
                  <PublishedComponentDetails
                    component={componentRef}
                    readOnly={readOnly}
                  />
                )}

                <TaskDetails componentRef={componentRef} />
                <TaskActions
                  componentRef={componentRef}
                  readOnly={readOnly}
                  className="mt-2"
                />
              </TabsContent>

              <TabsContent value="io">
                <TaskIO componentSpec={componentSpec} />
              </TabsContent>

              <TabsContent value="implementation">
                <TaskImplementation
                  displayName={displayName}
                  componentRef={componentRef}
                />
              </TabsContent>

              {hasPublishSection && (
                <TabsContent value="publish">
                  <PublishComponent
                    component={componentRef}
                    displayName={displayName}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}
      </>
    );
  },
  ComponentDetailsDialogContentSkeleton,
);

const ComponentDetails = ({
  component,
  displayName,
  trigger,
  readOnly,
  onClose,
}: ComponentDetailsProps) => {
  const [open, setOpen] = useState(false);
  const dialogTriggerButton = trigger || <InfoIconButton />;

  const dialogContextValue = useMemo(
    () => ({
      name: "ComponentDetails",
      close: () => {
        setOpen(false);
      },
    }),
    [],
  );

  const onOpenChange = useCallback((open: boolean) => {
    setOpen(open);
    if (!open) {
      onClose?.();
    }
  }, []);

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{dialogTriggerButton}</DialogTrigger>

      <DialogDescription
        className="hidden"
        aria-label={`${displayName} component details`}
      >
        {`${displayName} component details`}
      </DialogDescription>
      <DialogContent
        className="max-w-2xl min-w-2xl overflow-hidden"
        aria-label={`${displayName} component details`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 mr-5">
            <span>{displayName}</span>
            <ComponentFavoriteToggle component={component} />
          </DialogTitle>
        </DialogHeader>

        <DialogContext.Provider value={dialogContextValue}>
          <ComponentDetailsDialogContent
            component={component}
            displayName={displayName}
            readOnly={readOnly}
          />
        </DialogContext.Provider>
      </DialogContent>
    </Dialog>
  );
};

export default ComponentDetails;
