import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PipelineSection, RunSection } from "@/components/Home";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DASHBOARD_PATH } from "@/routes/router";

function getTabFromSearch(search: unknown): string | undefined {
  if (typeof search !== "object" || search === null || !("tab" in search)) {
    return undefined;
  }
  const { tab } = search;
  return typeof tab === "string" ? tab : undefined;
}

const Home = () => {
  const search: unknown = useSearch({ strict: false });
  const tabFromUrl = getTabFromSearch(search);

  const [activeTab, setActiveTab] = useState(tabFromUrl ?? "runs");
  const isFiltersBarEnabled = useFlagValue("pipeline-run-filters-bar");
  const isDashboardEnabled = useFlagValue("command-center-dashboard");
  const navigate = useNavigate();

  // Only redirect to dashboard if no explicit tab param (i.e. direct navigation)
  useEffect(() => {
    if (isDashboardEnabled && !tabFromUrl) {
      // Widen to `string` because TanStack Router's `to` expects registered
      // route literals, but DASHBOARD_PATH is a plain constant.
      navigate({ to: DASHBOARD_PATH as string, replace: true });
    }
  }, [isDashboardEnabled, navigate, tabFromUrl]);

  const handleTabSelect = (value: string) => {
    setActiveTab(value);
  };

  const handledPipelineRunsEmpty = useRef(false);
  const handlePipelineRunsEmpty = () => {
    if (!handledPipelineRunsEmpty.current) {
      setActiveTab("pipelines");
      handledPipelineRunsEmpty.current = true;
    }
  };

  return (
    <div className="container mx-auto w-3/4 p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pipelines</h1>
      </div>
      <Tabs
        defaultValue="runs"
        className="w-full"
        value={activeTab}
        onValueChange={handleTabSelect}
      >
        <TabsList>
          <TabsTrigger value="runs">All Runs</TabsTrigger>
          <TabsTrigger value="pipelines">My pipelines</TabsTrigger>
        </TabsList>
        <TabsContent value="pipelines">
          <PipelineSection />
        </TabsContent>
        <TabsContent value="runs" className="flex flex-col gap-4">
          {isFiltersBarEnabled && <PipelineRunFiltersBar />}
          <RunSection onEmptyList={handlePipelineRunsEmpty} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Home;
