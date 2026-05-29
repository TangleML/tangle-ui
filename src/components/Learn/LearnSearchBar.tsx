import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";
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
      className="h-11"
      prefixElement={
        <Icon
          name="Search"
          size="md"
          className="ml-3 text-muted-foreground"
          aria-hidden="true"
        />
      }
    >
      <Input
        variant="noBorder"
        placeholder="Search docs, tips and examples…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onEnter={handleSubmit}
        aria-label="Search the Learning Hub"
        className="h-11 text-sm w-80"
        {...tracking("learning_hub.search.submit")}
      />
    </InputGroup>
  );
}
