import { Link, Outlet } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

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

export function DashboardLayout() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <BlockStack gap="6">
        <InlineStack gap="2" blockAlign="center">
          <Heading level={1}>Dashboard</Heading>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Beta
          </Badge>
        </InlineStack>

        <InlineStack gap="8" blockAlign="start" className="w-full min-h-100">
          <BlockStack
            gap="1"
            className="w-48 shrink-0 border-r border-border pr-4"
          >
            {SIDEBAR_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="w-full"
                activeProps={{ className: "is-active" }}
              >
                {({ isActive }) => (
                  <div
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-accent",
                      isActive && "bg-accent font-medium",
                    )}
                  >
                    <Icon name={item.icon} size="sm" />
                    <Text size="sm">{item.label}</Text>
                  </div>
                )}
              </Link>
            ))}
          </BlockStack>

          <BlockStack className="flex-1 min-w-0">
            <Outlet />
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </div>
  );
}
