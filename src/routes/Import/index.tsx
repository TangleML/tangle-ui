import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import { EDITOR_PATH } from "@/routes/router";
import { importPipelineFromYaml } from "@/services/pipelineService";

type ImportSearch = { url?: string };

/**
 * Import route that fetches a pipeline YAML from a URL and imports it into the editor.
 *
 * Used by tangle-deploy CLI's `tangle-view-pipeline` command, which starts a temporary
 * local HTTP server and opens: /#/import?url=http://localhost:PORT/pipeline.yaml
 *
 * Flow:
 * 1. Read `url` from search params
 * 2. Fetch YAML from the URL
 * 3. Import into IndexedDB via importPipelineFromYaml (overwrite if same name exists)
 * 4. Redirect to the editor
 */
enum Step {
  Fetching = "fetching",
  Importing = "importing",
  Done = "done",
}

const STEPS: { key: Step; label: string; emoji: string }[] = [
  { key: Step.Fetching, label: "Fetching pipeline", emoji: "📡" },
  { key: Step.Importing, label: "Importing into editor", emoji: "📦" },
  { key: Step.Done, label: "Opening editor", emoji: "🚀" },
];

const StepIndicator = ({
  currentStep,
  pipelineName,
}: {
  currentStep: Step;
  pipelineName: string | null;
}) => {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex flex-col gap-3 w-full">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isComplete = i < currentIndex;
        const isPending = i > currentIndex;

        return (
          <div
            key={step.key}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 ${
              isActive
                ? "bg-primary/10 border border-primary/20"
                : isComplete
                  ? "bg-muted/50"
                  : "opacity-40"
            }`}
          >
            <span className="text-lg w-7 text-center">
              {isComplete ? "✅" : isActive ? step.emoji : "⏳"}
            </span>
            <div className="flex-1 min-w-0">
              <Paragraph
                size="sm"
                weight={isActive ? "semibold" : "regular"}
                tone={isPending ? "subdued" : undefined}
              >
                {step.label}
                {step.key === Step.Done && pipelineName && (
                  <span className="font-mono ml-1">
                    &ldquo;{pipelineName}&rdquo;
                  </span>
                )}
              </Paragraph>
            </div>
            {isActive && <Spinner size={16} />}
          </div>
        );
      })}
    </div>
  );
};

export const ImportPage = () => {
  const search = useSearch({ strict: false }) as ImportSearch;
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(Step.Fetching);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const importedRef = useRef(false);

  useEffect(() => {
    // React Strict Mode re-mounts components, firing useEffect twice.
    // useRef persists across remounts to prevent a duplicate import.
    if (importedRef.current) return;

    const importFromUrl = async () => {
      const url = search.url;

      if (!url) {
        setError("Missing 'url' parameter. Nothing to import.");
        return;
      }

      try {
        setStep(Step.Fetching);
        const response = await fetch(url);

        if (!response.ok) {
          setError(
            `Failed to fetch pipeline: ${response.status} ${response.statusText}`,
          );
          return;
        }

        const yamlContent = await response.text();

        if (!yamlContent || yamlContent.trim().length === 0) {
          setError("The fetched pipeline content is empty.");
          return;
        }

        setStep(Step.Importing);
        const result = await importPipelineFromYaml(yamlContent, true);

        if (result.successful) {
          importedRef.current = true;
          setPipelineName(result.name);
          setStep(Step.Done);
          // TODO: remove this delay -- temporary for debugging
          await new Promise((r) => setTimeout(r, 3000));
          navigate({
            to: `${EDITOR_PATH}/${encodeURIComponent(result.name)}`,
          });
        } else {
          setError(
            result.errorMessage || "Failed to import pipeline from URL.",
          );
        }
      } catch (err) {
        setError(
          `Failed to import pipeline: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    importFromUrl();
  }, [search.url, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full">
          <BlockStack gap="6" align="center">
            <div className="text-center">
              <span className="text-4xl mb-3 block">❌</span>
              <Text size="xl" weight="bold">
                Import Failed
              </Text>
              <Paragraph tone="subdued" size="sm" className="mt-1">
                Something went wrong importing the pipeline.
              </Paragraph>
            </div>

            <InfoBox title="Error Details" variant="error">
              <Paragraph font="mono" size="xs">
                {error}
              </Paragraph>
            </InfoBox>

            <Button
              onClick={() => router.navigate({ to: "/" })}
              variant="secondary"
              className="w-full"
            >
              ← Back to Home
            </Button>
          </BlockStack>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full">
        <BlockStack gap="6" align="center">
          <div className="text-center">
            <span className="text-4xl mb-3 block">🔧</span>
            <Text size="xl" weight="bold">
              Importing Pipeline
            </Text>
            <Paragraph tone="subdued" size="sm" className="mt-1">
              Setting up your pipeline in the editor...
            </Paragraph>
          </div>

          <StepIndicator currentStep={step} pipelineName={pipelineName} />
        </BlockStack>
      </div>
    </div>
  );
};
