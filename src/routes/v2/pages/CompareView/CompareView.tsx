import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

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
import { compareMode } from "./utils/compareMode";
import { buildPipelineComparison } from "./utils/comparePipelines";
import {
  type CompareSearch,
  validateCompareSearch,
} from "./utils/compareSearch";

const LABEL_A = "A";
const LABEL_B = "B";

export function CompareView() {
  const search = validateCompareSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const notify = useToastNotification();

  const a = search.a ?? "";
  const b = search.b ?? "";

  const sideA = useRunComparisonSide(a);
  const sideB = useRunComparisonSide(b);

  const mode = compareMode(a, b);

  const [activeTab, setActiveTab] = useState("structured");

  useEffect(() => {
    if (mode.kind === "both") {
      track("compare_runs.comparison.impression", { run_a: a, run_b: b });
    }
  }, [mode.kind, a, b, track]);

  // With one run selected we compare it against itself, so every task reads as
  // unchanged and the views render that run's graph instead of an empty diff.
  const selected = mode.kind === "single" && mode.side === "b" ? sideB : sideA;
  const comparison =
    mode.kind === "single"
      ? buildPipelineComparison(selected, selected)
      : buildPipelineComparison(sideA, sideB);

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
            disabled={mode.kind !== "both"}
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
          status: sideA.status,
          durationMs: sideA.durationMs,
          annotations: sideA.runAnnotations,
          arguments: sideA.runArguments,
        }}
        b={{
          createdBy: sideB.createdBy,
          createdAt: sideB.createdAt,
          status: sideB.status,
          durationMs: sideB.durationMs,
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

          <LazyTabContent value="yaml" activeTab={activeTab}>
            <YamlDiffView
              specA={mode.kind === "single" ? selected.spec : sideA.spec}
              specB={mode.kind === "single" ? undefined : sideB.spec}
            />
          </LazyTabContent>

          <LazyTabContent value="graph" activeTab={activeTab}>
            <GraphDiffView
              comparison={comparison}
              nameA={nameA ?? ""}
              nameB={nameB ?? ""}
              labelA={LABEL_A}
              labelB={LABEL_B}
              mode={mode}
            />
          </LazyTabContent>
        </Tabs>
      )}
    </PageShell>
  );
}

interface LazyTabContentProps {
  value: string;
  activeTab: string;
  children: ReactNode;
}

/**
 * Tab panel that mounts on first activation and stays mounted afterwards. The
 * YAML and graph tabs each carry expensive state — a Monaco instance and a
 * laid-out canvas — that should neither load before the tab is opened nor be
 * rebuilt every time the user switches away and back.
 */
function LazyTabContent({ value, activeTab, children }: LazyTabContentProps) {
  const active = activeTab === value;
  const [mounted, setMounted] = useState(active);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  return (
    <TabsContent
      value={value}
      forceMount
      className={cn("min-h-0", !active && "hidden")}
    >
      {mounted && children}
    </TabsContent>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <BlockStack gap="4" className="h-full w-full p-4">
      {children}
    </BlockStack>
  );
}
