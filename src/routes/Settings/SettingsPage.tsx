import { Link, useParams, useRouter } from "@tanstack/react-router";

import { BetaFeatures } from "@/components/shared/Settings/BetaFeatures";
import { Settings } from "@/components/shared/Settings/Settings";
import { useFlagsReducer } from "@/components/shared/Settings/useFlagsReducer";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { ExistingFlags } from "@/flags";
import { cn } from "@/lib/utils";
import { SETTINGS_PATH } from "@/routes/router";

import { BackendSettings } from "./sections/BackendSettings";
import { SecretsSettings } from "./sections/SecretsSettings";

type SettingsSection = "backend" | "preferences" | "beta-features" | "secrets";

interface SidebarItem {
  id: SettingsSection;
  label: string;
  icon: IconName;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "backend", label: "Backend", icon: "Database" },
  { id: "preferences", label: "Preferences", icon: "Settings" },
  { id: "beta-features", label: "Beta Features", icon: "FlaskConical" },
  { id: "secrets", label: "Secrets", icon: "Lock" },
];

export const SettingsPage = () => {
  const router = useRouter();
  const { section } = useParams({ strict: false }) as { section?: string };
  const activeSection = (section as SettingsSection) || "backend";

  const [flags, dispatch] = useFlagsReducer(ExistingFlags);

  const handleSetFlag = (flag: string, enabled: boolean) => {
    dispatch({ type: "setFlag", payload: { key: flag, enabled } });
  };

  const betaFlags = Object.values(flags).filter(
    (flag) => flag.category === "beta",
  );
  const settings = Object.values(flags).filter(
    (flag) => flag.category === "setting",
  );

  const handleGoBack = () => {
    router.history.back();
  };

  const renderContent = () => {
    switch (activeSection) {
      case "backend":
        return <BackendSettings />;
      case "preferences":
        return <Settings settings={settings} onChange={handleSetFlag} />;
      case "beta-features":
        return <BetaFeatures betaFlags={betaFlags} onChange={handleSetFlag} />;
      case "secrets":
        return <SecretsSettings />;
      default:
        return <BackendSettings />;
    }
  };

  return (
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
          </Button>
          <Heading level={1}>Settings</Heading>
        </InlineStack>

        <InlineStack gap="8" blockAlign="start" className="min-h-[400px]">
          <BlockStack
            gap="1"
            className="w-48 shrink-0 border-r border-border pr-4"
          >
            {SIDEBAR_ITEMS.map((item) => (
              <Link
                key={item.id}
                to={`${SETTINGS_PATH}/${item.id}` as string}
                replace
                data-testid={`settings-nav-${item.id}`}
                className="w-full"
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2",
                    activeSection === item.id && "bg-accent",
                  )}
                >
                  <Icon name={item.icon} size="sm" />
                  <Text size="sm">{item.label}</Text>
                </Button>
              </Link>
            ))}
          </BlockStack>

          <BlockStack className="flex-1 min-w-0">{renderContent()}</BlockStack>
        </InlineStack>
      </BlockStack>
    </div>
  );
};
