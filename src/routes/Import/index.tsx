import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import { EDITOR_PATH } from "@/routes/router";
import { importPipelineFromYaml } from "@/services/pipelineService";

/**
 * Import route that fetches a pipeline YAML from a URL and imports it into the editor.
 *
 * Used by CLI tools that start a temporary local HTTP server and open:
 * /app/editor/import-pipeline?url=http://127.0.0.1:PORT/pipeline-import/pipeline.yaml
 *
 * Flow:
 * 1. Read `url` from search params, validate with isAllowedImportUrl()
 * 2. Show confirmation screen with URL
 * 3. On user click: fetch YAML from the URL
 * 4. Import into IndexedDB via importPipelineFromYaml (overwrite if same name exists)
 * 5. Redirect to the editor
 */

/**
 * OS-assigned ephemeral ports (port=0) are always well above this threshold:
 * macOS: 49152-65535, Linux: 32768-60999. This check is a safety net to block
 * well-known service ports (e.g., Redis 6379, Elasticsearch 9200) in case
 * someone crafts a malicious import URL.
 */
const MIN_ALLOWED_PORT = 10000;

export function isAllowedImportUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") return false;
    if (parsed.hostname !== "127.0.0.1") return false;
    const port = parseInt(parsed.port, 10);
    if (!parsed.port || isNaN(port) || port < MIN_ALLOWED_PORT) return false;
    if (parsed.pathname !== "/pipeline-import/pipeline.yaml") return false;
    return true;
  } catch {
    return false;
  }
}

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
    <BlockStack gap="3">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isComplete = i < currentIndex;
        const isPending = i > currentIndex;

        return (
          <InlineStack
            key={step.key}
            gap="3"
            blockAlign="center"
            className={`rounded-lg px-4 py-3 transition-all duration-300 ${
              isActive
                ? "bg-primary/10 border border-primary/20"
                : isComplete
                  ? "bg-muted/50"
                  : "opacity-40"
            }`}
          >
            <Text size="lg" className="w-7 text-center">
              {isComplete ? "✅" : isActive ? step.emoji : "⏳"}
            </Text>
            <div className="flex-1 min-w-0">
              <Paragraph
                size="sm"
                weight={isActive ? "semibold" : "regular"}
                tone={isPending ? "subdued" : undefined}
              >
                {step.label}
                {step.key === Step.Done && pipelineName && (
                  <Text as="span" font="mono" className="ml-1">
                    &ldquo;{pipelineName}&rdquo;
                  </Text>
                )}
              </Paragraph>
            </div>
            {isActive && <Spinner size={16} />}
          </InlineStack>
        );
      })}
    </BlockStack>
  );
};

interface ErrorScreenProps {
  title: string;
  emoji: string;
  subtitle: string;
  errorMessage: string;
  onBack: () => void;
}

const ErrorScreen = ({
  title,
  emoji,
  subtitle,
  errorMessage,
  onBack,
}: ErrorScreenProps) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="max-w-sm w-full">
      <BlockStack gap="6" align="center">
        <div className="text-center">
          <Text size="xl" className="mb-3 block">
            {emoji}
          </Text>
          <Text size="xl" weight="bold">
            {title}
          </Text>
          <Paragraph tone="subdued" size="sm" className="mt-1">
            {subtitle}
          </Paragraph>
        </div>

        <InfoBox title="Error Details" variant="error">
          <Paragraph font="mono" size="xs">
            {errorMessage}
          </Paragraph>
        </InfoBox>

        <Button onClick={onBack} variant="secondary" className="w-full">
          ← Back to Home
        </Button>
      </BlockStack>
    </div>
  </div>
);

type ImportSearch = { url?: string };

export const ImportPage = () => {
  const search: ImportSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const importedRef = useRef(false);

  const goHome = () => router.navigate({ to: "/" });
  const url = search.url;
  const isValidUrl = url && isAllowedImportUrl(url);
  const validationError = isValidUrl
    ? null
    : `URL must be http://127.0.0.1:PORT/pipeline-import/pipeline.yaml with port >= ${MIN_ALLOWED_PORT}.`;

  const handleImport = async () => {
    if (!url || importedRef.current) return;

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
        navigate({
          to: `${EDITOR_PATH}/${encodeURIComponent(result.name)}`,
        });
      } else {
        setError(result.errorMessage || "Failed to import pipeline from URL.");
      }
    } catch (err) {
      setError(
        `Failed to import pipeline: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const errorMessage = error ?? validationError;

  if (errorMessage) {
    return (
      <ErrorScreen
        title="Import Failed"
        emoji="❌"
        subtitle="Something went wrong importing the pipeline."
        errorMessage={errorMessage}
        onBack={goHome}
      />
    );
  }

  if (step !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full">
          <BlockStack gap="6" align="center">
            <div className="text-center">
              <Text size="xl" className="mb-3 block">
                🔧
              </Text>
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <BlockStack gap="6" align="center">
          <div className="text-center">
            <Text size="xl" className="mb-3 block">
              📥
            </Text>
            <Text size="xl" weight="bold">
              Import Pipeline
            </Text>
            <Paragraph tone="subdued" size="sm" className="mt-1">
              A pipeline is ready to be imported from a local source.
            </Paragraph>
          </div>

          <InfoBox title="Source" variant="info">
            <Paragraph font="mono" size="xs" className="break-all">
              {url}
            </Paragraph>
          </InfoBox>

          <Paragraph tone="subdued" size="xs" className="text-center">
            If a pipeline with the same name already exists, it will be
            overwritten.
          </Paragraph>

          <InlineStack gap="3" align="center">
            <Button onClick={goHome} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleImport} data-testid="import-confirm-button">
              Import Pipeline
            </Button>
          </InlineStack>
        </BlockStack>
      </div>
    </div>
  );
};
