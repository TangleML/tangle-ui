import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import {
  type Tip,
  TIP_CATEGORY_ICONS,
  TIP_CATEGORY_ORDER,
  type TipCategory,
  tips,
} from "./tips";

function TipCard({ tip }: { tip: Tip }) {
  return (
    <Card
      className="h-full py-4 gap-2"
      {...tracking("learning_hub.tips.view", { tip_id: tip.id })}
    >
      <CardHeader className="px-4 gap-2">
        <CardTitle className="text-sm leading-snug">{tip.title}</CardTitle>
        <CardDescription className="text-sm">{tip.body}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function CategorySection({
  category,
  tips: categoryTips,
}: {
  category: TipCategory;
  tips: Tip[];
}) {
  return (
    <BlockStack gap="3">
      <InlineStack gap="2" blockAlign="center">
        <Icon
          name={TIP_CATEGORY_ICONS[category]}
          size="md"
          className="text-primary"
          aria-hidden="true"
        />
        <Heading level={3}>{category}</Heading>
      </InlineStack>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryTips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </BlockStack>
  );
}

function groupTipsByCategory(
  tips: Tip[],
): { category: TipCategory; tips: Tip[] }[] {
  const buckets = new Map<TipCategory, Tip[]>();
  for (const tip of tips) {
    const list = buckets.get(tip.category) ?? [];
    list.push(tip);
    buckets.set(tip.category, list);
  }
  return TIP_CATEGORY_ORDER.filter((category) => buckets.has(category)).map(
    (category) => ({ category, tips: buckets.get(category)! }),
  );
}

export function TipsLibrary() {
  const grouped = groupTipsByCategory(tips);
  return (
    <BlockStack gap="8">
      {grouped.map(({ category, tips: categoryTips }) => (
        <CategorySection
          key={category}
          category={category}
          tips={categoryTips}
        />
      ))}
    </BlockStack>
  );
}
