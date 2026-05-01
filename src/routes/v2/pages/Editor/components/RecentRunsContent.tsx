import { observer } from "mobx-react-lite";

import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { BlockStack } from "@/components/ui/layout";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const RecentRunsContent = observer(function RecentRunsContent() {
  const { navigation } = useSharedStores();
  const rootSpec = navigation.rootSpec;

  return (
    <BlockStack className="p-2 [&_.text-sm]:text-xs!">
      <PipelineRunsList
        pipelineName={rootSpec?.name}
        showTitle={false}
        defaultShowingRuns={10}
        showMoreButton={false}
        overviewConfig={{
          showName: false,
          showDescription: true,
          showTaskStatusBar: false,
        }}
      />
    </BlockStack>
  );
});
