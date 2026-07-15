import { observer } from "mobx-react-lite";

import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { EmptyState } from "@/components/ui/empty-state";
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
        emptyState={
          <EmptyState
            size="sm"
            description="No runs yet. Submit this pipeline to see runs here."
          />
        }
        overviewConfig={{
          showName: false,
          showDescription: true,
          showTaskStatusBar: false,
        }}
      />
    </BlockStack>
  );
});
