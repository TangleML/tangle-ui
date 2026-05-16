import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import { TANGLE_WEBSITE_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

export function LearnSearchBar() {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const query = value.trim();
    if (!query) return;
    const url = `${TANGLE_WEBSITE_URL}search/?q=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <InputGroup
      className="h-11 w-80"
      prefixElement={
        <Icon
          name="Search"
          size="lg"
          className="ml-3 text-muted-foreground"
          aria-hidden="true"
        />
      }
      suffixElement={
        <div className="flex items-center gap-1 pr-3 text-muted-foreground shrink-0">
          <Text size="xs" tone="subdued">
            tangleml.com
          </Text>
          <Icon name="ExternalLink" size="xs" aria-hidden="true" />
        </div>
      }
    >
      <Input
        variant="noBorder"
        placeholder="Search the docs…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onEnter={handleSubmit}
        aria-label="Search the Tangle docs (opens in a new tab)"
        className="h-11 text-sm"
        {...tracking("learning_hub.search.submit")}
      />
    </InputGroup>
  );
}
