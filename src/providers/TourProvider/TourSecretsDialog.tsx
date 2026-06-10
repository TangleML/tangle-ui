import { useTour } from "@reactour/tour";
import { useEffect, useState } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import { AddSecretForm } from "@/components/shared/SecretsManagement/components/AddSecretForm";
import { SecretsListView } from "@/components/shared/SecretsManagement/components/SecretsListView";
import type { Secret } from "@/components/shared/SecretsManagement/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";

// The Settings gear (AppMenuActions) calls this in tour mode instead of routing
// to /settings, which would unmount the tour page and tear the tour down.
let openSettingsHandler: (() => void) | null = null;

export function openTourSettings() {
  openSettingsHandler?.();
}

function registerOpenSettingsHandler(handler: () => void): () => void {
  openSettingsHandler = handler;
  return () => {
    if (openSettingsHandler === handler) openSettingsHandler = null;
  };
}

const SETTINGS_TABS: Array<{ label: string; icon: IconName; active: boolean }> =
  [
    { label: "Backend", icon: "Database", active: false },
    { label: "Preferences", icon: "Settings", active: false },
    { label: "Beta Features", icon: "FlaskConical", active: false },
    { label: "Secrets", icon: "Lock", active: true },
  ];

type ManagerMode =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "replace"; secret: Secret };

function TourSecretsManager() {
  const [mode, setMode] = useState<ManagerMode>({ kind: "list" });

  if (mode.kind !== "list") {
    return (
      <BlockStack gap="3">
        <InlineStack gap="1" blockAlign="center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode({ kind: "list" })}
          >
            <Icon name="ArrowLeft" />
          </Button>
          <Text weight="semibold">
            {mode.kind === "add"
              ? "Add Secret"
              : `Replace value for ${mode.secret.name}`}
          </Text>
        </InlineStack>
        <AddSecretForm
          existingSecret={mode.kind === "replace" ? mode.secret : undefined}
          onSuccess={() => setMode({ kind: "list" })}
          onCancel={() => setMode({ kind: "list" })}
        />
      </BlockStack>
    );
  }

  return (
    <SecretsListView
      onAddSecret={() => setMode({ kind: "add" })}
      onEditSecret={(secret) => setMode({ kind: "replace", secret })}
    />
  );
}

// A tour-safe stand-in for the Settings → Secrets page. It mirrors the real
// settings shell (sidebar with Secrets active, other tabs disabled) and renders
// the real SecretsListView, but keeps add/replace in-dialog instead of using the
// router links the real page relies on, so the tour never navigates away.
export function TourSecretsDialog() {
  const tourMode = useTourMode();
  const { steps, currentStep, isOpen: tourIsOpen } = useTour();
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    if (!tourMode) return;
    return registerOpenSettingsHandler(() => {
      setOpenKey((key) => key + 1);
      setOpen(true);
    });
  }, [tourMode]);

  const step = steps?.[currentStep] as TourStep | undefined;
  const onSettingsStep = !!tourIsOpen && step?.tourPanel === "secrets-manager";
  const isExplainStep = onSettingsStep && !step?.interaction;

  useEffect(() => {
    if (isExplainStep) setOpen(true);
    else if (!onSettingsStep) setOpen(false);
  }, [isExplainStep, onSettingsStep]);

  if (!tourMode) return null;

  return (
    <Dialog modal={false} open={open}>
      <DialogContent
        showCloseButton={false}
        data-tour="tour-settings-dialog"
        className="sm:max-w-4xl w-[56rem] h-[80vh] p-0 gap-0 overflow-hidden"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your secrets.
        </DialogDescription>

        <BlockStack className="h-full">
          <div className="px-6 py-4 border-b border-border">
            <Heading level={1}>Settings</Heading>
          </div>

          <InlineStack
            className="flex-1 min-h-0"
            blockAlign="stretch"
            wrap="nowrap"
          >
            <BlockStack
              gap="1"
              className="w-48 shrink-0 border-r border-border p-4"
            >
              {SETTINGS_TABS.map((tab) => (
                <Button
                  key={tab.label}
                  variant="ghost"
                  disabled={!tab.active}
                  className={cn(
                    "w-full justify-start gap-2",
                    tab.active && "bg-accent",
                  )}
                >
                  <Icon name={tab.icon} size="sm" />
                  <Text size="sm">{tab.label}</Text>
                </Button>
              ))}
            </BlockStack>

            <div className="flex-1 min-w-0 overflow-y-auto p-6">
              <TourSecretsManager key={openKey} />
            </div>
          </InlineStack>
        </BlockStack>
      </DialogContent>
    </Dialog>
  );
}
