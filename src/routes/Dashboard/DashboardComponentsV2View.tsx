import { type ChangeEvent, useState } from "react";

import { Input } from "@/components/ui/input";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

/**
 * Experimental Components V2 route shell. Search data sources and result
 * ranking land in the follow-up PRs in this stack.
 */
export const DashboardComponentsV2View = () => {
  const [query, setQuery] = useState("");

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    // Outer wrapper carries the inline height; BlockStack's typed props don't
    // include `style`, so the height stays on a plain div and BlockStack owns
    // the vertical flex semantic.
    <div
      className="-mt-4 -mb-6 -mx-8 overflow-hidden"
      style={{ height: `calc(100vh - ${TOP_NAV_HEIGHT}px)` }}
    >
      <BlockStack className="h-full">
        <div className="shrink-0 px-8 pt-4 pb-4 border-b border-border">
          <BlockStack gap="3" align="stretch">
            <BlockStack gap="1">
              <Heading level={2}>Components V2</Heading>
              <Paragraph size="sm" tone="subdued">
                Search across component sources from one experimental dashboard.
              </Paragraph>
            </BlockStack>
            <Input
              type="search"
              placeholder="e.g. train_test_split, pandas, clean up my data"
              value={query}
              onChange={handleQueryChange}
              aria-label="Search components"
            />
          </BlockStack>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-4">
          <Paragraph size="sm" tone="subdued">
            Component results will appear here.
          </Paragraph>
        </div>
      </BlockStack>
    </div>
  );
};
