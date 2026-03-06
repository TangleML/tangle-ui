import { Link, Outlet, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { SettingsFlagsProvider } from "./SettingsFlagsContext";

interface SidebarItem {
  to: string;
  label: string;
  icon: IconName;
  testId: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    to: "/settings/backend",
    label: "Backend",
    icon: "Database",
    testId: "settings-nav-backend",
  },
  {
    to: "/settings/preferences",
    label: "Preferences",
    icon: "Settings",
    testId: "settings-nav-preferences",
  },
  {
    to: "/settings/beta-features",
    label: "Beta Features",
    icon: "FlaskConical",
    testId: "settings-nav-beta-features",
  },
  {
    to: "/settings/secrets",
    label: "Secrets",
    icon: "Lock",
    testId: "settings-nav-secrets",
  },
];

export function SettingsLayout() {
  const router = useRouter();

  const handleGoBack = () => {
    router.history.back();
  };

  return (
    <SettingsFlagsProvider>
      <div className="container mx-auto p-6 max-w-4xl">
        <BlockStack gap="6">
          <InlineStack gap="3" blockAlign="center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              data-testid="settings-back-button"
            >
              <Icon name="ArrowLeft" />
              <Heading level={1}>Settings</Heading>
            </Button>
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
                  replace
                  data-testid={item.testId}
                  className="w-full"
                  activeProps={{ className: "is-active" }}
                >
                  {({ isActive }) => (
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-accent",
                      )}
                    >
                      <Icon name={item.icon} size="sm" />
                      <Text size="sm">{item.label}</Text>
                    </Button>
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
    </SettingsFlagsProvider>
  );
}
