import { useRef, useState } from "react";

import { PipelineSection, RunSection } from "@/components/Home";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ROUTES } from "@/routes/router";

const Home = () => {
  const [activeTab, setActiveTab] = useState("runs");
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
      <InlineStack align="space-between" blockAlign="center">
        <h1 className="text-2xl font-bold">Pipelines</h1>
        <Link href={APP_ROUTES.COMPARE} variant="block">
          <Button variant="outline">
            <Icon name="GitCompareArrows" />
            Compare Runs
          </Button>
        </Link>
      </InlineStack>
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
        <TabsContent value="runs" className="flex flex-col gap-1">
          <RunSection onEmptyList={handlePipelineRunsEmpty} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Home;
