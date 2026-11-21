import { Box, Text } from "ink";

import type { TabInfo } from "../chatState.ts";

interface TabsProps {
  tabs: TabInfo[];
  activeIndex: number;
  frame: string;
}

function labelColor(tab: TabInfo, active: boolean): string | undefined {
  if (active) return "black";
  if (tab.tone === "error") return "red";
  if (tab.tone === "done") return "gray";
  return "cyan";
}

export function Tabs({ tabs, activeIndex, frame }: TabsProps) {
  if (tabs.length === 0) {
    return <Text dimColor>Connecting…</Text>;
  }
  return (
    <Box>
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        const marker = tab.busy ? `${frame} ` : "";
        return (
          <Box key={`${tab.title}-${index}`} marginRight={1}>
            <Text
              color={labelColor(tab, active)}
              backgroundColor={active ? "cyan" : undefined}
              bold={active}
            >
              {` ${marker}${tab.title} `}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
