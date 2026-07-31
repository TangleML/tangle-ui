import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { RemoteAuthErrorView } from "@/components/shared/RemoteAuthErrorView";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { GraphDiffView } from "./components/GraphDiffView";
import { RunMetadataSection } from "./components/RunMetadataSection";
import { RunSwitcher } from "./components/RunSwitcher";
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
  const notify = useToastNotification();

  const a = search.a ?? "";
  const b = search.b ?? "";

  const sideA = useRunComparisonSide(a);
  const sideB = useRunComparisonSide(b);

  const distinctIds = Array.from(new Set([a, b].filter(Boolean)));
  const single = distinctIds.length === 1;
  const both = distinctIds.length === 2;
  const mode = both ? "both" : single ? "single" : "empty";

  const present = single ? (a ? sideA : sideB) : undefined;
  const effectiveA = present ?? sideA;
  const effectiveB = present ?? sideB;

  const [activeTab, setActiveTab] = useState("structured");
  const [yamlMounted, setYamlMounted] = useState(false);
  const [graphMounted, setGraphMounted] = useState(false);

  useEffect(() => {
    if (both) {
      track("compare_runs.comparison.impression", { run_a: a, run_b: b });
    }
  }, [both, a, b, track]);

  useEffect(() => {
    if (activeTab === "yaml") {
      setYamlMounted(true);
    }
    if (activeTab === "graph") {
      setGraphMounted(true);
    }
  }, [activeTab]);

  const comparison = buildPipelineComparison(
    effectiveA.spec,
    effectiveB.spec,
    effectiveA.taskStatusMap,
    effectiveB.taskStatusMap,
    effectiveA.taskExecutionIdMap,
    effectiveB.taskExecutionIdMap,
  );

  const nameA = a ? (sideA.spec?.name ?? `Run #${a}`) : undefined;
  const nameB = b ? (sideB.spec?.name ?? `Run #${b}`) : undefined;

  const setSide = (side: "a" | "b", id: string) => {
    navigate({
      to: APP_ROUTES.COMPARE,
      search: (prev: CompareSearch) => ({ ...prev, [side]: id }),
    });
  };

  const clearSide = (side: "a" | "b") => {
    navigate({
      to: APP_ROUTES.COMPARE,
      search: (prev: CompareSearch) => {
        const next = { ...prev };
        delete next[side];
        return next;
      },
    });
  };

  const authError = [sideA.error, sideB.error].find(
    (candidate) => candidate instanceof RemoteAuthError,
  );
  if (authError) {
    return <RemoteAuthErrorView />;
  }

  const contentError = sideA.error ?? sideB.error ?? null;
  const contentLoading =
    (Boolean(a) && sideA.isLoading) || (Boolean(b) && sideB.isLoading);

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
          <RunSwitcher
            label={LABEL_A}
            side="a"
            tone="a"
            runId={a || undefined}
            name={nameA}
            excludeRunId={b || undefined}
            onSelect={(id) => setSide("a", id)}
            onClear={() => clearSide("a")}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Swap runs"
            disabled={!both}
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
          <RunSwitcher
            label={LABEL_B}
            side="b"
            tone="b"
            runId={b || undefined}
            name={nameB}
            excludeRunId={a || undefined}
            onSelect={(id) => setSide("b", id)}
            onClear={() => clearSide("b")}
          />
        </InlineStack>
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy link to this comparison"
            onClick={() => {
              copyToClipboard(window.location.href);
              notify("Link copied to clipboard", "success");
            }}
            {...tracking("compare_runs.comparison.share")}
          >
            <Icon name="Share2" size="sm" />
          </Button>
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
      </InlineStack>

      <RunMetadataSection
        a={{
          createdBy: sideA.createdBy,
          createdAt: sideA.createdAt,
          annotations: sideA.runAnnotations,
          arguments: sideA.runArguments,
        }}
        b={{
          createdBy: sideB.createdBy,
          createdAt: sideB.createdAt,
          annotations: sideB.runAnnotations,
          arguments: sideB.runArguments,
        }}
        labelA={LABEL_A}
        labelB={LABEL_B}
        mode={mode}
      />

      {contentError ? (
        <InfoBox title="Error loading runs" variant="error" width="full">
          {contentError.message}
        </InfoBox>
      ) : contentLoading ? (
        <InlineStack
          align="center"
          blockAlign="center"
          gap="2"
          className="w-full flex-1"
        >
          <Spinner /> <Text>Loading runs…</Text>
        </InlineStack>
      ) : (
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
              nameA={nameA ?? LABEL_A}
              nameB={nameB ?? LABEL_B}
              mode={mode}
            />
          </TabsContent>

          <TabsContent
            value="yaml"
            forceMount
            className={cn("min-h-0", activeTab !== "yaml" && "hidden")}
          >
            {yamlMounted && (
              <YamlDiffView
                specA={effectiveA.spec}
                specB={effectiveB.spec}
                single={single}
              />
            )}
          </TabsContent>

          <TabsContent
            value="graph"
            forceMount
            className={cn("min-h-0", activeTab !== "graph" && "hidden")}
          >
            {graphMounted && (
              <GraphDiffView
                key={`${a}-${b}`}
                comparison={comparison}
                nameA={nameA ?? ""}
                nameB={nameB ?? ""}
                labelA={LABEL_A}
                labelB={LABEL_B}
                singleRun={single}
                mode={mode}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
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
