import { FavoritesSection } from "@/components/Home/FavoritesSection/FavoritesSection";
import { RecentlyViewedSection } from "@/components/Home/RecentlyViewedSection/RecentlyViewedSection";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export const Dashboard = () => {
  return (
    <BlockStack gap="4" className="container mx-auto w-3/4 p-4">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h1" size="xl" weight="bold">
          Dashboard
        </Text>
        <Text
          as="span"
          size="xs"
          weight="semibold"
          className="px-2 py-1 rounded-full bg-amber-100 text-amber-800"
        >
          Beta
        </Text>
      </InlineStack>
      <RecentlyViewedSection />
      <FavoritesSection />
    </BlockStack>
  );
};
