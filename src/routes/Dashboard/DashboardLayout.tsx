import { Link, Outlet } from "@tanstack/react-router";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link as UILink } from "@/components/ui/link";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { DOCUMENTATION_URL } from "@/utils/constants";

interface SidebarItem {
  to: string;
  label: string;
  icon: IconName;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { to: "/dashboard/runs", label: "Runs", icon: "Play" },
  { to: "/dashboard/pipelines", label: "Pipelines", icon: "GitBranch" },
  { to: "/dashboard/components", label: "Components", icon: "Package" },
  { to: "/dashboard/favorites", label: "Favorites", icon: "Star" },
  { to: "/dashboard/recently-viewed", label: "Recently Viewed", icon: "Clock" },
];

const navItemClass = (isActive: boolean) =>
  cn(
    "w-full px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent",
    isActive && "bg-accent font-medium",
  );

export function DashboardLayout() {
  const requiresAuthorization = isAuthorizationRequired();

  return (
    <div className="w-full px-8 py-6">
      <BlockStack gap="6">
        <InlineStack gap="2" blockAlign="center">
          <Heading level={1}>Dashboard</Heading>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Beta
          </Badge>
        </InlineStack>

        <InlineStack gap="8" blockAlign="start" className="w-full min-h-100">
          <BlockStack
            inlineAlign="space-between"
            className="w-48 shrink-0 border-r border-border pr-4 self-stretch"
          >
            {/* Top nav */}
            <BlockStack gap="1">
              {SIDEBAR_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="w-full"
                  activeProps={{ className: "is-active" }}
                >
                  {({ isActive }) => (
                    <InlineStack
                      gap="2"
                      blockAlign="center"
                      className={navItemClass(isActive)}
                    >
                      <Icon name={item.icon} size="sm" />
                      <Text size="sm">{item.label}</Text>
                    </InlineStack>
                  )}
                </Link>
              ))}
            </BlockStack>

            {/* Bottom utilities */}
            <BlockStack gap="1" className="border-t border-border pt-3">
              <UILink
                href={DOCUMENTATION_URL}
                external
                variant="block"
                className={navItemClass(false)}
              >
                <InlineStack gap="2" blockAlign="center">
                  <Icon name="CircleQuestionMark" size="sm" />
                  <Text size="sm">Docs</Text>
                </InlineStack>
              </UILink>
              <Link to="/settings/backend" className="w-full">
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
              {requiresAuthorization && (
                <div className="px-3 py-2">
                  <TopBarAuthentication />
                </div>
              )}
            </BlockStack>
          </BlockStack>

          <BlockStack className="flex-1 min-w-0">
            <Outlet />
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </div>
  );
}
