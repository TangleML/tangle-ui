import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { type Theme, useTheme } from "@/providers/ThemeProvider";
import { tracking } from "@/utils/tracking";

const THEME_OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
  { value: "system", label: "System", icon: "Monitor" },
];

export function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <BlockStack gap="2">
      <BlockStack>
        <Paragraph>Appearance</Paragraph>
        <Paragraph size="sm" tone="subdued">
          Choose how Tangle looks. System follows your device settings.
        </Paragraph>
      </BlockStack>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex w-fit gap-1 rounded-md border border-border p-0.5"
      >
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(option.value)}
              className={cn(!isActive && "text-muted-foreground")}
              data-testid={`theme-option-${option.value}`}
              {...tracking("settings.appearance.theme_select", {
                theme: option.value,
              })}
            >
              <Icon name={option.icon} size="sm" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </BlockStack>
  );
}
