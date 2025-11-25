import { type ComponentProps, type PropsWithChildren } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Text } from "@/components/ui/typography";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import type {
  ComponentReferenceWithDigest,
  HydratedComponentReference,
} from "@/utils/componentSpec";

import { withSuspenseWrapper } from "../SuspenseWrapper";
import { ComponentQuickDetailsDialogTrigger } from "./ComponentQuickDetailsDialog";
import { ComponentUsageCount } from "./ComponentUsageCount";
import { DeprecatePublishedComponentButton } from "./DeprecatePublishedComponentButton";
import { useForceUpdateTasks } from "./hooks/useForceUpdateTasks";
import { PublishComponentButton } from "./PublishComponentButton";
import { TrimmedDigest } from "./TrimmedDigest";

const ComponentHistoryTimelineItem = ({
  icon,
  iconClassName,
  children,
}: PropsWithChildren<{
  icon: ComponentProps<typeof Icon>["name"];
  iconClassName?: string;
}>) => {
  return (
    <li className="relative">
      <InlineStack align="center" blockAlign="start" gap="3">
        <Icon
          name={icon}
          size="xs"
          className={cn(
            "relative z-10 shrink-0 bg-background rounded-full translate-y-0.5",
            iconClassName,
          )}
        />

        <BlockStack gap="1" className="flex-1 min-w-0" align="start">
          {children}
        </BlockStack>
      </InlineStack>
    </li>
  );
};

const ComponentHistoryTimelineSkeleton = () => {
  return (
    <BlockStack gap="2">
      <Heading level={2}>Publish History</Heading>
      <BlockStack gap="2">
        <Skeleton size="full" />
        <Skeleton size="half" />
        <Skeleton size="full" />
        <Skeleton size="half" />
      </BlockStack>
    </BlockStack>
  );
};

export const ComponentHistoryTimeline = withSuspenseWrapper(
  ({
    history,
    currentComponent,
    currentUserName,
    onChange,
  }: {
    history: ComponentReferenceWithDigest[];
    currentComponent: HydratedComponentReference;
    currentUserName?: string;
    onChange?: () => void;
  }) => {
    const onForceUpdate = useForceUpdateTasks(currentComponent);

    const lastComponentInHistory =
      history.length === 0 ? undefined : history[history.length - 1];
    const lastHydratedComponent = useHydrateComponentReference(
      lastComponentInHistory ?? {},
    );

    const isPotentiallyOutdated = Boolean(
      history.length > 0 &&
        history.find((c) => c.digest === currentComponent.digest) !==
          history[history.length - 1],
    );

    const isPotentialNewRelease =
      lastHydratedComponent &&
      lastComponentInHistory &&
      !history.find((c) => c.digest === currentComponent.digest) &&
      lastComponentInHistory.name === currentComponent.name &&
      !lastComponentInHistory.deprecated &&
      lastComponentInHistory.published_by === currentUserName;

    const isFirstPublish = history.length === 0;

    return (
      <BlockStack gap="2">
        <Heading level={2}>Publish History</Heading>
        <BlockStack className="relative">
          {/* Timeline line - absolute positioned */}
          <div
            className={cn("absolute left-[5px] top-0 bottom-0 w-0.5 bg-border")}
            aria-hidden="true"
          />
          <BlockStack gap="2" as="ul" className="relative">
            {history.map((item, index, { length }) => {
              const isMostRecent = index === length - 1;
              const isMatchCurrentComponent =
                item.digest === currentComponent.digest;

              const icon = [
                isMostRecent && "CircleDot",
                isMatchCurrentComponent && "OctagonAlert",
                "Circle",
              ].find(Boolean) as ComponentProps<typeof Icon>["name"];

              return (
                <ComponentHistoryTimelineItem key={item.digest} icon={icon}>
                  <InlineStack gap="1" blockAlign="center">
                    <ComponentQuickDetailsDialogTrigger component={item} />
                    <Text size="xs">by {item.published_by}</Text>

                    {isMatchCurrentComponent && isPotentiallyOutdated ? (
                      <Text size="xs" tone="critical">
                        | You have an outdated version of this component in your
                        library.
                      </Text>
                    ) : null}
                  </InlineStack>

                  <ComponentUsageCount digest={item.digest}>
                    {(count) => (
                      <Text size="xs" tone="subdued">
                        Used {count} times in this Pipeline.
                        {isMostRecent ? null : (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => onForceUpdate(item.digest)}
                          >
                            Review tasks
                          </Button>
                        )}
                      </Text>
                    )}
                  </ComponentUsageCount>
                </ComponentHistoryTimelineItem>
              );
            })}
            {isPotentialNewRelease || isFirstPublish ? (
              <ComponentHistoryTimelineItem
                icon="CircleFadingArrowUp"
                iconClassName="text-green-500"
              >
                <BlockStack gap="1">
                  <InlineStack gap="1">
                    <TrimmedDigest
                      digest={currentComponent.digest}
                      weight="semibold"
                    />
                    <Text size="xs" tone="subdued">
                      {isFirstPublish
                        ? "| this component has not been published yet"
                        : "| you have a version of this component that is not published yet"}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="1" blockAlign="center">
                    {isPotentialNewRelease ? (
                      <DeprecatePublishedComponentButton
                        predecessorComponent={lastHydratedComponent}
                        successorComponent={currentComponent}
                        onSuccess={onChange}
                      />
                    ) : null}
                    {isFirstPublish ? (
                      <PublishComponentButton
                        component={currentComponent}
                        onSuccess={onChange}
                      />
                    ) : null}
                  </InlineStack>
                </BlockStack>
              </ComponentHistoryTimelineItem>
            ) : null}

            {!isFirstPublish && !isPotentiallyOutdated ? (
              <ComponentHistoryTimelineItem
                icon="CircleDashed"
                iconClassName="text-gray-500"
              >
                <InlineStack gap="1" blockAlign="center">
                  <Text size="xs" tone="subdued">
                    To release a new version, drop the new component YAML file
                    on the Pipeline Editor.
                  </Text>
                  {/* I commented out the ImportComponent because of behavior divergence. */}
                  {/* This use case will be addressed in future PRs. */}
                  {/* <ImportComponent
                    triggerComponent={
                      <Button variant="secondary" size="xs">
                        Release new version?
                      </Button>
                    }
                  /> */}
                </InlineStack>
              </ComponentHistoryTimelineItem>
            ) : null}
          </BlockStack>
        </BlockStack>
      </BlockStack>
    );
  },
  ComponentHistoryTimelineSkeleton,
);
