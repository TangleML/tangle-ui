import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { type FavoriteType, useFavorites } from "@/hooks/useFavorites";
import { APP_ROUTES } from "@/routes/router";

import { SavedItemRow } from "./SavedItemRow";
import { SectionHeader } from "./SectionHeader";
import { useListedItems } from "./useListedItems";

const PREVIEW_COUNT = 5;

interface FavoritesPreviewProps {
  title?: string;
  typeFilter?: FavoriteType;
  emptyMessage?: string;
  hideWhenEmpty?: boolean;
  trackingId?: string;
}

export const FavoritesPreview = ({
  title = "Favorites",
  typeFilter,
  emptyMessage = "No favorites yet. Star a pipeline, run, or project to keep it here.",
  hideWhenEmpty = false,
  trackingId = "homepage.favorites.item",
}: FavoritesPreviewProps) => {
  const { favorites, removeFavorite } = useFavorites();
  const listed = useListedItems(favorites);
  const filtered = typeFilter
    ? listed.filter(
        (f) =>
          f.type === typeFilter ||
          (typeFilter === "pipeline" && f.type === "remote-pipeline"),
      )
    : listed;
  const preview = filtered.slice(0, PREVIEW_COUNT);

  if (hideWhenEmpty && preview.length === 0) return null;

  return (
    <BlockStack gap="4" className="min-w-0">
      <SectionHeader title={title} viewAllTo={APP_ROUTES.DASHBOARD_FAVORITES} />
      <div className="w-full border border-border rounded-lg overflow-hidden divide-y divide-border">
        {preview.length === 0 ? (
          <div className="px-4 py-3">
            <Paragraph tone="subdued" size="sm">
              {emptyMessage}
            </Paragraph>
          </div>
        ) : (
          preview.map((item) => (
            <SavedItemRow
              key={`${item.type}-${item.id}`}
              item={item}
              onRemove={() => removeFavorite(item.type, item.id)}
              trackingId={trackingId}
            />
          ))
        )}
      </div>
    </BlockStack>
  );
};
