import { observer } from "mobx-react-lite";

import logo from "/Tangle_Icon_White.png";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { WindowsMenu } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/WindowsMenu";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

import { CollabConnectionStatus } from "./CollabConnectionStatus";

export const CollabEditorMenuBar = observer(function CollabEditorMenuBar({
  roomId,
}: {
  roomId: string;
}) {
  const { navigation } = useSharedStores();
  const displayName = navigation.rootSpec?.name ?? roomId;

  return (
    <div
      className="relative w-full bg-stone-900 px-3 py-1 md:px-4"
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
          <Link
            href="/"
            aria-label="Home"
            variant="block"
            className="shrink-0"
            {...tracking("v2.collab_editor.menubar.home")}
          >
            <img
              src={logo}
              alt="logo"
              className="h-8 cursor-pointer shrink-0"
            />
          </Link>

          <BlockStack className="min-w-0">
            <InlineStack
              wrap="nowrap"
              blockAlign="center"
              gap="1"
              className="px-1"
            >
              <Icon name="Globe" size="sm" className="text-white" />
              <Text
                as="span"
                size="sm"
                weight="semibold"
                className="text-white truncate max-w-64 lg:max-w-md leading-tight ml-1"
              >
                {displayName}
              </Text>
            </InlineStack>

            <InlineStack wrap="nowrap" blockAlign="center">
              <WindowsMenu />
            </InlineStack>
          </BlockStack>
        </InlineStack>

        <InlineStack
          gap="2"
          wrap="nowrap"
          blockAlign="center"
          className="shrink-0"
        >
          <CollabConnectionStatus />
          <div className="w-px h-5 bg-stone-700" />
          <AppMenuActions />
        </InlineStack>
      </InlineStack>
    </div>
  );
});
