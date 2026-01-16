import { Separator } from "@radix-ui/react-separator";

import { BlockStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useUserDetails } from "@/hooks/useUserDetails";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { withSuspenseWrapper } from "../SuspenseWrapper";
import { ComponentHistoryTimeline } from "./ComponentHistoryTimeline";
import { ComponentSpecProperty } from "./ComponentSpecProperty";
import { usePublishedComponentHistory } from "./hooks/usePublishedComponentHistory";

interface ComponentPublishProps {
  component: HydratedComponentReference;
  displayName: string;
}

const ComponentPublishDescription = () => {
  return (
    <Paragraph size="xs" tone="subdued">
      Published Components are shared components that are available to all users
      in the workspace. By publishing, you make this component discoverable and
      reusable by others through the component library. Once published, the
      component will appear in the components search result for easy access and
      collaboration.
    </Paragraph>
  );
};

const PublishComponentSkeleton = () => {
  return (
    <BlockStack gap="3">
      <ComponentPublishDescription />
      <Skeleton size="half" />
      <Skeleton size="full" />
      <Skeleton size="half" />
      <Skeleton size="full" />
    </BlockStack>
  );
};

export const PublishComponent = withSuspenseWrapper(
  ({ component }: ComponentPublishProps) => {
    const { data: currentUserDetails } = useUserDetails();

    const { data: history, refetch: refetchHistory } =
      usePublishedComponentHistory(component, currentUserDetails?.id ?? "");

    const onChange = () => {
      refetchHistory();
    };

    return (
      <ScrollArea className="h-full">
        <BlockStack inlineAlign="space-between" className="h-full" gap="3">
          <ComponentPublishDescription />

          <BlockStack
            gap="2"
            className="border rounded-md p-2 h-full"
            data-testid="component-review-container"
          >
            <Heading level={2}>Component Review</Heading>

            <BlockStack gap="1" className="border-l pl-2">
              <ComponentSpecProperty
                label="Author"
                value={component.spec.metadata?.annotations?.author}
              />
              <ComponentSpecProperty label="Name" value={component.name} />
              <ComponentSpecProperty
                label="Description"
                value={component.spec.description}
              />
              <ComponentSpecProperty label="Digest" value={component.digest} />
              <Separator />
              <ComponentSpecProperty
                label="Published by"
                value={currentUserDetails?.id}
                tooltip="Your current user name"
              />
            </BlockStack>

            <ComponentHistoryTimeline
              history={history}
              currentComponent={component}
              currentUserName={currentUserDetails?.id}
              onChange={onChange}
            />
          </BlockStack>
        </BlockStack>
      </ScrollArea>
    );
  },
  PublishComponentSkeleton,
);
