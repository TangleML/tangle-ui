import { Link, Outlet } from "@tanstack/react-router";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link as UILink } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  ABOUT_URL,
  DOCUMENTATION_URL,
  GIT_COMMIT,
  GIT_REPO_URL,
  GIVE_FEEDBACK_URL,
  PRIVACY_POLICY_URL,
  TOP_NAV_HEIGHT,
} from "@/utils/constants";

interface SidebarItem {
  to: string;
  label: string;
  icon: IconName;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { to: "/runs", label: "Runs", icon: "Play" },
  { to: "/pipelines", label: "Pipelines", icon: "GitBranch" },
  { to: "/components", label: "Components", icon: "Package" },
  { to: "/favorites", label: "Favorites", icon: "Star" },
  { to: "/recently-viewed", label: "Recently Viewed", icon: "Clock" },
];

const navItemClass = (isActive: boolean) =>
  cn(
    "w-full px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent",
    isActive && "bg-accent font-medium",
  );

export function DashboardLayout() {
  const requiresAuthorization = isAuthorizationRequired();

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      {/* Sidebar — fixed height, independent scroll */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-y-auto">
        {/* Dashboard heading */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <InlineStack gap="2" blockAlign="center">
            <Text size="lg" weight="semibold">
              Dashboard
            </Text>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              Beta
            </Badge>
          </InlineStack>
        </div>

        <BlockStack gap="1" className="px-3">
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

        {/* Spacer */}
        <div className="flex-1 min-h-4" />

        {/* Bottom utilities */}
        <div className="flex flex-col gap-1 px-3 border-t border-border pt-3 pb-3">
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

          {/* Footer links */}
          <div className="flex flex-col gap-0.5 pt-2 mt-1 border-t border-border">
            {[
              { label: "About", href: ABOUT_URL },
              { label: "Give feedback", href: GIVE_FEEDBACK_URL },
              { label: "Privacy policy", href: PRIVACY_POLICY_URL },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
              >
                {label}
              </a>
            ))}
            <a
              href={`${GIT_REPO_URL}/commit/${GIT_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-accent font-mono"
            >
              ver: {GIT_COMMIT.substring(0, 6)}
            </a>
          </div>
        </div>
      </div>

      {/* Main content — independent scroll */}
      <div className="flex-1 min-w-0 overflow-y-auto px-8 pb-6 pt-4">
        <Outlet />
      </div>
    </div>
  );
}
