import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef } from "react";

import { PipelineSection, RunSection } from "@/components/Home";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type HomeSearchParams,
  type HomeTab,
  indexRoute,
} from "@/routes/router";

const Home = () => {
  const navigate = useNavigate({ from: indexRoute.fullPath });
  const search = useSearch({ strict: false }) as Partial<HomeSearchParams>;
  const activeTab = search.tab ?? "runs";

  const handleTabSelect = (value: string) => {
    const newTab = value as HomeTab;
    navigate({
      search: (prev) => ({
        ...prev,
        tab: newTab,
        // Clear pipeline filters when switching to runs tab
        ...(newTab === "runs" && {
          q: undefined,
          sort: undefined,
          dir: undefined,
          from: undefined,
          to: undefined,
          hasRuns: undefined,
        }),
      }),
    });
  };

  const handledPipelineRunsEmpty = useRef(false);
  const handlePipelineRunsEmpty = () => {
    if (!handledPipelineRunsEmpty.current) {
      navigate({
        search: (prev) => ({ ...prev, tab: "pipelines" }),
      });
      handledPipelineRunsEmpty.current = true;
    }
  };

  return (
    <div className="container mx-auto w-3/4 p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pipelines</h1>
      </div>
      <Tabs
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
        <TabsContent value="runs" className="flex flex-col gap-1">
          <RunSection onEmptyList={handlePipelineRunsEmpty} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Home;
