import { Link, Outlet } from "@tanstack/react-router";
import { Fragment } from "react";

import { TipOfTheDay } from "@/components/Learn/TipOfTheDay";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link as UILink } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/providers/OnboardingProvider/OnboardingProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { ExtraNavItems } from "@/routes/Dashboard/ExtraNavItems";
import {
  ABOUT_URL,
  DOCUMENTATION_URL,
  GIT_COMMIT,
  GIT_REPO_URL,
  GIVE_FEEDBACK_URL,
  PRIVACY_POLICY_URL,
} from "@/utils/constants";
import { contentHeight } from "@/utils/layout";

interface SidebarItem {
  to: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  highlighted?: boolean;
  badge?: string;
  dividerAfter?: boolean;
}

const BASE_SIDEBAR_ITEMS: SidebarItem[] = [
  {
    to: APP_ROUTES.DASHBOARD,
    label: "My Dashboard",
    icon: "LayoutDashboard",
    exact: true,
  },
  { to: "/pipelines", label: "My Pipelines", icon: "GitBranch" },
  { to: "/runs", label: "All Runs", icon: "Play" },
  { to: "/components", label: "Components", icon: "Package" },
  { to: "/favorites", label: "Favorites", icon: "Star" },
  { to: "/recently-viewed", label: "Recently Viewed", icon: "Clock" },
  { to: "/learn", label: "Learning Hub", icon: "GraduationCap" },
];

const COMPONENT_SEARCH_ITEM: SidebarItem = {
  to: APP_ROUTES.DASHBOARD_COMPONENTS_V2,
  label: "Components",
  icon: "PackageSearch",
};

const TANGENT_ITEM: SidebarItem = {
  to: APP_ROUTES.PROJECTS,
  label: "Tangent",
  icon: "Bot",
  highlighted: true,
  badge: "Beta",
  dividerAfter: true,
};

const navItemClass = (isActive: boolean, highlighted?: boolean) =>
  cn(
    "w-full px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent",
    isActive && "bg-accent font-medium",
    // Inset so the outline costs no layout and the row still lines up with the
    // items around it.
    highlighted && "ring-1 ring-inset ring-brand-accent/60",
  );

export function DashboardLayout() {
  const requiresAuthorization = isAuthorizationRequired();
  const isComponentSearchEnabled = useFlagValue("component-search-v2");
  const isProjectsEnabled = useFlagValue("projects");

  const { shouldShowOnboarding } = useOnboarding();

  const componentItems = isComponentSearchEnabled
    ? BASE_SIDEBAR_ITEMS.map((item) =>
        item.to === APP_ROUTES.DASHBOARD_COMPONENTS
          ? COMPONENT_SEARCH_ITEM
          : item,
      )
    : BASE_SIDEBAR_ITEMS;

  const baseItems = isProjectsEnabled
    ? [TANGENT_ITEM, ...componentItems]
    : componentItems;

  const sidebarItems: SidebarItem[] = shouldShowOnboarding
    ? [
        {
          to: APP_ROUTES.WELCOME,
          label: "Get Started",
          icon: "Rocket",
          exact: true,
        },
        ...baseItems,
      ]
    : baseItems;

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: contentHeight() }}
    >
      {/* Sidebar — fixed height, independent scroll */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-y-auto">
        {/* Dashboard heading */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <Text size="lg" weight="semibold">
            Dashboard
          </Text>
        </div>

        <BlockStack gap="1" className="px-3">
          {sidebarItems.map((item) => (
            <Fragment key={item.to}>
              <Link
                to={item.to}
                className="w-full"
                activeProps={{ className: "is-active" }}
                activeOptions={item.exact ? { exact: true } : undefined}
              >
                {({ isActive }) => (
                  <InlineStack
                    gap="2"
                    blockAlign="center"
                    className={navItemClass(isActive, item.highlighted)}
                  >
                    <Icon
                      name={item.icon}
                      size="sm"
                      className={cn(item.highlighted && "text-brand-accent")}
                    />
                    <Text size="sm">{item.label}</Text>
                    {item.badge && (
                      <Badge variant="brand" shape="rounded" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </InlineStack>
                )}
              </Link>
              {item.dividerAfter && <Separator className="my-2" />}
            </Fragment>
          ))}
        </BlockStack>

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Tip of the day */}
        <div className="px-3 pb-2">
          <div className="rounded-lg border border-border bg-card">
            <TipOfTheDay variant="compact" showHeader />
          </div>
        </div>

        {/* Bottom utilities */}
        <BlockStack gap="1" className="px-3 border-t border-border pt-3 pb-3">
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
          <ExtraNavItems className={cn("w-full", navItemClass(false))} />
          {requiresAuthorization && (
            <div className="px-3 py-2">
              <TopBarAuthentication />
            </div>
          )}

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
