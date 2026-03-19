import { observer } from "mobx-react-lite";

import logo from "/Tangle_Icon_White.png";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import { RunMenu } from "./components/RunMenu";
import { RunViewViewMenu } from "./components/RunViewViewMenu";

export const RunViewMenuBar = observer(function RunViewMenuBar() {
  const { navigation } = useSharedStores();
  const spec = navigation.activeSpec;
  const pipelineName = spec?.name ?? "Pipeline Run";

  return (
    <div
      className="w-full bg-stone-900 px-3 py-1 md:px-4"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <InlineStack
        align="space-between"
        blockAlign="stretch"
        wrap="nowrap"
        className="h-full"
      >
        <InlineStack
          gap="3"
          wrap="nowrap"
          align="start"
          blockAlign="center"
          className="min-w-0"
        >
          <Link href="/" aria-label="Home" variant="block" className="shrink-0">
            <img
              src={logo}
              alt="logo"
              className="h-8 cursor-pointer shrink-0"
            />
          </Link>

          <BlockStack gap="0" className="min-w-0">
            <Text
              as="span"
              size="sm"
              weight="semibold"
              className="text-white truncate max-w-64 lg:max-w-md leading-tight ml-1"
            >
              {pipelineName}
            </Text>

            <InlineStack gap="0" wrap="nowrap" blockAlign="center">
              <RunMenu />
              <RunViewViewMenu />
            </InlineStack>
          </BlockStack>
        </InlineStack>

        <AppMenuActions />
      </InlineStack>
    </div>
  );
});
