import { observer } from "mobx-react-lite";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import {
  CanvasHomeLink,
  CanvasMenuBar,
} from "@/routes/v2/shared/components/CanvasMenuBar";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { RunMenu } from "./components/RunMenu";
import { RunViewViewMenu } from "./components/RunViewViewMenu";
import { RunViewWindowsMenu } from "./components/RunViewWindowsMenu";

export const RunViewMenuBar = observer(function RunViewMenuBar() {
  const { navigation } = useSharedStores();

  const pipelineName = navigation.rootSpec?.name ?? "Pipeline Run";

  return (
    <CanvasMenuBar>
      <InlineStack
        gap="3"
        wrap="nowrap"
        align="start"
        blockAlign="center"
        className="min-w-0"
      >
        <CanvasHomeLink trackingId="v2.run_view.menu_bar.home" />

        <BlockStack className="min-w-0">
          <Text
            as="span"
            size="sm"
            weight="semibold"
            className="text-white truncate max-w-64 lg:max-w-md leading-tight ml-1 select-text cursor-text"
          >
            {pipelineName}
          </Text>

          <InlineStack wrap="nowrap" blockAlign="center">
            <RunMenu />
            <RunViewViewMenu />
            <RunViewWindowsMenu />
          </InlineStack>
        </BlockStack>
      </InlineStack>

      <AppMenuActions />
    </CanvasMenuBar>
  );
});
