import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

interface TagListProps {
  tags: string[];
}

const MAX_VISIBLE_TAGS = 3;

export const TagList = ({ tags }: TagListProps) => {
  const [showAllTags, setShowAllTags] = useState(false);

  const hasMoreTags = tags.length > MAX_VISIBLE_TAGS;
  const visibleTags = showAllTags ? tags : tags.slice(0, MAX_VISIBLE_TAGS);

  if (visibleTags.length === 0) {
    return (
      <Paragraph size="xs" tone="subdued">
        None
      </Paragraph>
    );
  }

  return (
    <InlineStack gap="2" wrap="wrap">
      {visibleTags.map((tag) => (
        <Badge key={tag} shape="rounded" variant="secondary" size="sm">
          {tag}
        </Badge>
      ))}

      {hasMoreTags && (
        <Badge
          shape="rounded"
          variant="outline"
          size="sm"
          className="cursor-pointer hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            setShowAllTags(!showAllTags);
          }}
        >
          {showAllTags ? "Show less" : `+${tags.length - MAX_VISIBLE_TAGS}`}
        </Badge>
      )}
    </InlineStack>
  );
};
