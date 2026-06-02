import { Link, Outlet, useSearch } from "@tanstack/react-router";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link as UILink } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/router";
import { PIPELINE_FILTER_LABELS } from "@/routes/tangent/labels";
import type { PipelineFilter } from "@/routes/tangent/types";
import {
  ABOUT_URL,
  DOCUMENTATION_URL,
  GIT_COMMIT,
  GIT_REPO_URL,
  GIVE_FEEDBACK_URL,
  PRIVACY_POLICY_URL,
  TOP_NAV_HEIGHT,
} from "@/utils/constants";

interface TangentSearch {
  filter?: string;
}

interface FilterLink {
  filter: Exclude<PipelineFilter, "all">;
  icon: IconName;
}

const FILTER_LINKS: FilterLink[] = [
  { filter: "my_pipelines", icon: "GitBranch" },
  { filter: "no_scenario", icon: "CircleDashed" },
  { filter: "has_results", icon: "ChartLine" },
];

const navItemClass = (isActive: boolean) =>
  cn(
    "w-full px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent",
    isActive && "bg-accent font-medium",
  );

export function TangentLayout() {
  const search = useSearch({ strict: false }) as TangentSearch;
  const activeFilter = search.filter;

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      {/* Sidebar — fixed height, independent scroll */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-y-auto">
        {/* Tangent heading */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <Text size="lg" weight="semibold">
            Tangent
          </Text>
        </div>

        <BlockStack gap="1" className="px-3">
          <Link
            to={APP_ROUTES.TANGENT}
            search={{ filter: undefined }}
            className="w-full"
          >
            {({ isActive }) => (
              <InlineStack
                gap="2"
                blockAlign="center"
                className={navItemClass(isActive && !activeFilter)}
              >
                <Icon name="LayoutDashboard" size="sm" />
                <Text size="sm">Tangent Dashboard</Text>
              </InlineStack>
            )}
          </Link>

          {FILTER_LINKS.map(({ filter, icon }) => (
            <Link
              key={filter}
              to={APP_ROUTES.TANGENT}
              search={{ filter }}
              className="w-full"
            >
              <InlineStack
                gap="2"
                blockAlign="center"
                className={navItemClass(activeFilter === filter)}
              >
                <Icon name={icon} size="sm" />
                <Text size="sm">{PIPELINE_FILTER_LABELS[filter]}</Text>
              </InlineStack>
            </Link>
          ))}
        </BlockStack>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Bottom utilities */}
        <BlockStack gap="1" className="px-3 border-t border-border pt-3 pb-3">
          <Link to={APP_ROUTES.DASHBOARD} className="w-full">
            <InlineStack
              gap="2"
              blockAlign="center"
              className={navItemClass(false)}
            >
              <Icon name="ArrowLeft" size="sm" />
              <Text size="sm">Back to My Dashboard</Text>
            </InlineStack>
          </Link>
          <UILink
            href={DOCUMENTATION_URL}
            external
            variant="block"
            size="sm"
            className={cn("w-full", navItemClass(false))}
          >
            <InlineStack gap="2" blockAlign="center" className="flex-1">
              <Icon name="CircleQuestionMark" size="sm" />
              <Text size="sm">Docs</Text>
            </InlineStack>
          </UILink>
          <Link to={APP_ROUTES.SETTINGS_BACKEND} className="w-full">
            {({ isActive }) => (
              <InlineStack
                gap="2"
                blockAlign="center"
                className={navItemClass(isActive)}
              >
                <Icon name="Settings" size="sm" />
                <Text size="sm">Settings</Text>
              </InlineStack>
            )}
          </Link>

          {/* Footer links */}
          <BlockStack className="gap-0.5 pt-2 mt-1 border-t border-border">
            {[
              { label: "About", href: ABOUT_URL },
              { label: "Give feedback", href: GIVE_FEEDBACK_URL },
              { label: "Privacy policy", href: PRIVACY_POLICY_URL },
            ].map(({ label, href }) => (
              <UILink
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                variant="block"
                size="xs"
                className="px-3 py-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
              >
                {label}
              </UILink>
            ))}
            <UILink
              href={`${GIT_REPO_URL}/commit/${GIT_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="block"
              size="xs"
              className="px-3 py-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent font-mono"
            >
              ver: {GIT_COMMIT.substring(0, 6)}
            </UILink>
          </BlockStack>
        </BlockStack>
      </div>

      {/* Main content — independent scroll */}
      <div className="flex-1 min-w-0 overflow-y-auto px-8 pb-6 pt-4">
        <Outlet />
      </div>
    </div>
  );
}
