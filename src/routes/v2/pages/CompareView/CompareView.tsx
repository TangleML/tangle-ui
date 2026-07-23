import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { RemoteAuthErrorView } from "@/components/shared/RemoteAuthErrorView";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";
import { tracking } from "@/utils/tracking";

import { CompareRunPicker } from "./components/CompareRunPicker";
import { GraphDiffPlaceholder } from "./components/GraphDiffPlaceholder";
import { StructuredDiffView } from "./components/StructuredDiffView";
import { YamlDiffView } from "./components/YamlDiffView";
import { useRunComparisonSide } from "./hooks/useRunComparisonSide";
import { buildPipelineComparison } from "./utils/comparePipelines";

interface CompareSearch {
  a?: string;
  b?: string;
}

const LABEL_A = "A";
const LABEL_B = "B";

export function CompareView() {
  const search = useSearch({ strict: false }) as CompareSearch;
  const navigate = useNavigate();
  const { track } = useAnalytics();

  const a = search.a ?? "";
  const b = search.b ?? "";

  const sideA = useRunComparisonSide(a);
  const sideB = useRunComparisonSide(b);

  const bothSelected = Boolean(a && b && a !== b);

  const [activeTab, setActiveTab] = useState("structured");
  const [yamlMounted, setYamlMounted] = useState(false);

  useEffect(() => {
    if (bothSelected) {
      track("compare_runs.comparison.impression", { run_a: a, run_b: b });
    }
  }, [bothSelected, a, b, track]);

  useEffect(() => {
    if (activeTab === "yaml") {
      setYamlMounted(true);
    }
  }, [activeTab]);

  const comparison = buildPipelineComparison(
    sideA.spec,
    sideB.spec,
    sideA.taskStatusMap,
    sideB.taskStatusMap,
  );

  const setSide = (side: "a" | "b", id: string) => {
    navigate({
      to: APP_ROUTES.COMPARE,
      search: (prev: CompareSearch) => ({ ...prev, [side]: id }),
    });
  };

  if (!a) {
    return (
      <PageShell>
        <CompareRunPicker
          title="Select the first run to compare"
          excludeRunId={b}
          onSelect={(id) => setSide("a", id)}
        />
      </PageShell>
    );
  }

  if (!b || a === b) {
    return (
      <PageShell>
        {a === b && (
          <InfoBox
            title="Pick two different runs"
            variant="warning"
            width="full"
          >
            You selected the same run twice. Choose a different second run.
          </InfoBox>
        )}
        <CompareRunPicker
          title="Select the second run to compare"
          excludeRunId={a}
          onSelect={(id) => setSide("b", id)}
        />
      </PageShell>
    );
  }

  const error = sideA.error ?? sideB.error;
  if (error) {
    if (error instanceof RemoteAuthError) {
      return <RemoteAuthErrorView />;
    }
    return (
      <PageShell>
        <InfoBox title="Error loading runs" variant="error" width="full">
          {error.message}
        </InfoBox>
      </PageShell>
    );
  }

  if (sideA.isLoading || sideB.isLoading || !sideA.spec || !sideB.spec) {
    return <LoadingScreen message="Loading runs to compare" />;
  }

  const nameA = sideA.spec.name ?? `Run #${a}`;
  const nameB = sideB.spec.name ?? `Run #${b}`;

  return (
    <PageShell>
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="4"
        className="w-full"
      >
        <InlineStack gap="3" blockAlign="center" wrap="wrap">
          <Heading level={2}>Compare runs</Heading>
          <RunLabel label={LABEL_A} name={nameA} runId={a} tone="a" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap runs"
            onClick={() =>
              navigate({
                to: APP_ROUTES.COMPARE,
                search: { a: b, b: a },
              })
            }
            {...tracking("compare_runs.comparison.swap")}
          >
            <Icon name="ArrowLeftRight" size="sm" />
          </Button>
          <RunLabel label={LABEL_B} name={nameB} runId={b} tone="b" />
        </InlineStack>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close comparison"
          onClick={() => navigate({ to: APP_ROUTES.DASHBOARD_RUNS })}
          {...tracking("compare_runs.comparison.close")}
        >
          <Icon name="X" size="sm" />
        </Button>
      </InlineStack>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 w-full"
      >
        <TabsList>
          <TabsTrigger
            value="structured"
            {...tracking("compare_runs.tab.structured")}
          >
            Structured
          </TabsTrigger>
          <TabsTrigger value="yaml" {...tracking("compare_runs.tab.yaml")}>
            YAML
          </TabsTrigger>
          <TabsTrigger value="graph" {...tracking("compare_runs.tab.graph")}>
            Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structured" className="min-h-0 overflow-auto">
          <StructuredDiffView
            comparison={comparison}
            labelA={LABEL_A}
            labelB={LABEL_B}
          />
        </TabsContent>

        <TabsContent
          value="yaml"
          forceMount
          className={cn("min-h-0", activeTab !== "yaml" && "hidden")}
        >
          {yamlMounted && (
            <YamlDiffView specA={sideA.spec} specB={sideB.spec} />
          )}
        </TabsContent>

        <TabsContent value="graph" className="min-h-0">
          <GraphDiffPlaceholder />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <BlockStack gap="4" className="h-full w-full p-4">
      {children}
    </BlockStack>
  );
}

interface RunLabelProps {
  label: string;
  name: string;
  runId: string;
  tone: "a" | "b";
}

function RunLabel({ label, name, runId, tone }: RunLabelProps) {
  const toneClass =
    tone === "a"
      ? "border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100"
      : "border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";

  return (
    <Link
      to={APP_ROUTES.RUN_DETAIL}
      params={{ id: runId }}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${name} in a new tab`}
      className={`group rounded border px-2 py-1 transition-colors ${toneClass}`}
      {...tracking("compare_runs.comparison.open_run", { side: label })}
    >
      <InlineStack gap="2" blockAlign="center" wrap="nowrap">
        <Text as="span" size="sm" weight="semibold">
          {label}
        </Text>
        <Text as="span" size="sm" className="truncate max-w-64">
          {name}
        </Text>
        <Text as="span" size="xs" tone="subdued">
          #{runId}
        </Text>
        <Icon
          name="ExternalLink"
          size="xs"
          className="opacity-40 group-hover:opacity-80"
        />
      </InlineStack>
    </Link>
  );
}
