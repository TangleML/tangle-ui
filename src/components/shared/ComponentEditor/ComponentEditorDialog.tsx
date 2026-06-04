import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";
import {
  type HydratedComponentReference,
  isContainerImplementation,
} from "@/utils/componentSpec";
import { saveComponent } from "@/utils/localforage";

import { FullscreenElement } from "../FullscreenElement";
import { withSuspenseWrapper } from "../SuspenseWrapper";
import { PythonComponentEditor } from "./components/PythonComponentEditor";
import { YamlComponentEditor } from "./components/YamlComponentEditor";
import type { SaveAction } from "./saveAction";
import type { SupportedTemplate, YamlGeneratorOptions } from "./types";
import { useTemplateCodeByName } from "./useTemplateCodeByName";

const ComponentEditorDialogSkeleton = () => {
  return (
    <FullscreenElement fullscreen={true}>
      <BlockStack className="h-full w-full p-2 bg-white" align="start" gap="2">
        <InlineStack
          className="w-full h-13"
          gap="4"
          align="space-between"
          wrap="nowrap"
        >
          <Skeleton size="lg" />
          <Skeleton size="lg" shape="button" />
        </InlineStack>
        <Separator />
        <InlineStack
          className="w-full h-full flex-1"
          gap="4"
          blockAlign="start"
          align="space-between"
          wrap="nowrap"
        >
          <BlockStack gap="2" align="start" className="flex-1">
            <Skeleton size="full" />
            <Skeleton size="half" />
            <Skeleton size="full" />
          </BlockStack>
          <BlockStack gap="2" align="start" className="flex-1">
            <Skeleton size="full" />
            <Skeleton size="half" />
            <Skeleton size="full" />
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </FullscreenElement>
  );
};

type PythonCodeDetection =
  | {
      isPython: true;
      pythonOriginalCode: string;
      options: YamlGeneratorOptions;
      componentName?: string;
    }
  | { isPython: false };

export const ComponentEditorDialog = withSuspenseWrapper(
  ({
    text,
    templateName = "empty",
    onClose,
    onComponentSaved,
    renderSaveActions,
  }: {
    text?: string;
    templateName?: SupportedTemplate;
    onClose: () => void;
    /**
     * When provided, the editor is being used to edit an existing target (e.g.
     * a selected task's component) rather than to import a brand new component
     * into the library. The callback receives the hydrated, edited component
     * and the chosen {@link SaveAction}, and is responsible for applying it
     * (and any user feedback). When omitted, the editor falls back to importing
     * the component into the library.
     */
    onComponentSaved?: (
      hydratedComponent: HydratedComponentReference,
      action: SaveAction,
    ) => void | Promise<void>;
    /**
     * When provided, Save swaps the fullscreen surface from the editor to a
     * full-area "choose what to do" view (rendered by this function), with a
     * Back affordance to return to the editor. The function receives the
     * hydrated edit and an `onChoose` callback; `"import"` runs the
     * library-import path, `"update"`/`"place"` are forwarded to
     * {@link onComponentSaved}. When omitted, Save imports to the library (or
     * calls {@link onComponentSaved} with `"update"`) directly.
     */
    renderSaveActions?: (args: {
      hydratedComponent: HydratedComponentReference;
      onChoose: (action: "update" | "import" | "place") => void;
    }) => ReactNode;
  }) => {
    const notify = useToastNotification();
    const { track } = useAnalytics();
    const { addToComponentLibrary } = useComponentLibrary();

    const { data: templateCode } = useTemplateCodeByName(templateName);
    const initialText = text ?? templateCode;
    const [componentText, setComponentText] = useState(initialText);
    const [errors, setErrors] = useState<string[]>([]);
    // When set, the fullscreen surface shows the "choose what to do" view for
    // this hydrated edit instead of the editor.
    const [pendingSave, setPendingSave] =
      useState<HydratedComponentReference | null>(null);

    const mode = text ? "edit" : "create";

    const hasTrackedOpen = useRef(false);
    useEffect(() => {
      if (hasTrackedOpen.current) return;
      hasTrackedOpen.current = true;
      track("component_editor.opened", {
        mode,
        selected_template: templateName,
      });
    }, [mode, templateName, track]);

    const { data: pythonCodeDetection } = useSuspenseQuery({
      queryKey: ["isPython", `${templateName}-${JSON.stringify(text)}`],
      queryFn: async (): Promise<PythonCodeDetection> => {
        if (text) {
          const hydratedComponent = await hydrateComponentReference({
            text,
          });

          if (
            !hydratedComponent ||
            !isContainerImplementation(hydratedComponent.spec.implementation)
          ) {
            return { isPython: false };
          }

          const pythonOriginalCode = hydratedComponent.spec.metadata
            ?.annotations?.python_original_code as string;

          if (!pythonOriginalCode) {
            return { isPython: false };
          }

          return {
            isPython: true,
            pythonOriginalCode,
            componentName: hydratedComponent.name,
            options: {
              baseImage:
                hydratedComponent.spec.implementation.container.image ??
                "python:3.12",
              packagesToInstall: parsePythonDependencies(
                hydratedComponent.spec.metadata?.annotations
                  ?.python_dependencies,
              ),
              annotations: Object.fromEntries(
                Object.entries(
                  (hydratedComponent.spec.metadata?.annotations ??
                    {}) as Record<string, string>,
                ).filter(
                  ([key]) =>
                    key !== "python_original_code" &&
                    key !== "python_dependencies",
                ),
              ),
            },
          };
        }

        if (templateName !== "python") {
          return { isPython: false };
        }

        const defaultPythonFunctionText = await import(
          `./templates/python_function.py?raw`
        ).then((module) => module.default);

        return {
          isPython: true,
          pythonOriginalCode: defaultPythonFunctionText,
          options: {},
        };
      },
    });

    const handleComponentTextChange = (value: string) => {
      setComponentText(value);
    };

    const importToLibrary = async (
      hydratedComponent: HydratedComponentReference,
    ) => {
      await addToComponentLibrary(hydratedComponent, "editor_save");
      notify(
        `Component ${hydratedComponent.name} imported successfully`,
        "success",
      );
    };

    const handleSave = async () => {
      const hydratedComponent = await hydrateComponentReference({
        text: componentText,
      });

      if (!hydratedComponent) {
        track("component_editor.save.failed", {
          mode,
          selected_template: templateName,
          reason: "hydration_failed",
        });
        return;
      }

      await saveComponent({
        id: `component-${hydratedComponent.digest}`,
        url: "",
        data: componentText,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // When a caller offers a choose-what-to-do step, swap the fullscreen
      // surface to it instead of finishing the save here.
      if (renderSaveActions) {
        setPendingSave(hydratedComponent);
        return;
      }

      // Otherwise: editing an existing target updates it in place; the
      // create/import flow imports to the library.
      onClose();

      if (onComponentSaved) {
        await onComponentSaved(hydratedComponent, "update");
      } else {
        await importToLibrary(hydratedComponent);
      }

      track("component_editor.save.completed", {
        mode,
        selected_template: templateName,
      });
    };

    const handleSaveChoice = async (action: "update" | "import" | "place") => {
      const hydratedComponent = pendingSave;
      if (!hydratedComponent) return;

      onClose();

      if (action === "import") {
        await importToLibrary(hydratedComponent);
      } else {
        await onComponentSaved?.(hydratedComponent, action);
      }

      track("component_editor.save.completed", {
        mode,
        selected_template: templateName,
        action,
      });
    };

    const handleBackToEditor = () => {
      setPendingSave(null);
      track("component_editor.save.cancelled", {
        mode,
        selected_template: templateName,
      });
    };

    const handleClose = () => {
      track("component_editor.dismissed", {
        mode,
        selected_template: templateName,
        had_changes: componentText !== initialText,
      });
      onClose();
    };

    const title = text ? "Edit Component" : "New Component";
    const hasTemplate = templateName && templateName !== "empty";

    return (
      <FullscreenElement fullscreen={true}>
        <div className="relative h-full w-full bg-white">
          {/* Editor view — kept mounted (preserves edits) and faded out while
              the save-actions view is shown. */}
          <BlockStack
            className={cn(
              "h-full w-full p-2 transition-opacity duration-200",
              pendingSave && "pointer-events-none opacity-0",
            )}
            aria-hidden={pendingSave !== null}
          >
            <InlineStack
              className="w-full py-3 border-b-3 border-gray-100"
              align="space-between"
            >
              <InlineStack gap="2">
                <Heading level={1}>{title}</Heading>
                {hasTemplate && (
                  <Paragraph size="sm" tone="subdued">
                    ({templateName} template)
                  </Paragraph>
                )}
              </InlineStack>

              <InlineStack gap="2">
                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={errors.length > 0}
                >
                  <Icon name="Save" /> Save
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <Icon name="X" />
                </Button>
              </InlineStack>
            </InlineStack>

            {pythonCodeDetection?.isPython ? (
              <PythonComponentEditor
                text={pythonCodeDetection.pythonOriginalCode}
                options={pythonCodeDetection.options}
                onComponentTextChange={handleComponentTextChange}
                onErrorsChange={setErrors}
                preserveComponentName={pythonCodeDetection.componentName}
              />
            ) : (
              <YamlComponentEditor
                text={componentText}
                onComponentTextChange={handleComponentTextChange}
                onErrorsChange={setErrors}
              />
            )}
          </BlockStack>

          {/* Save-actions view — full-area, fades in over the editor. */}
          {pendingSave && renderSaveActions && (
            <BlockStack className="absolute inset-0 bg-white p-2 animate-in fade-in duration-200">
              <InlineStack
                className="w-full py-3 border-b-3 border-gray-100"
                gap="2"
                blockAlign="center"
              >
                <Button variant="ghost" size="sm" onClick={handleBackToEditor}>
                  <Icon name="ArrowLeft" /> Back
                </Button>
                <Heading level={1}>Apply your edit</Heading>
              </InlineStack>

              {renderSaveActions({
                hydratedComponent: pendingSave,
                onChoose: handleSaveChoice,
              })}
            </BlockStack>
          )}
        </div>
      </FullscreenElement>
    );
  },
  ComponentEditorDialogSkeleton,
);

function parsePythonDependencies(dependencies: unknown | undefined): string[] {
  try {
    return (
      JSON.parse(typeof dependencies === "string" ? dependencies : "[]") ?? []
    );
  } catch {
    return [];
  }
}
