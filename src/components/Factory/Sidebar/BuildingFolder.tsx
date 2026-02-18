import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import type { BuildingCategory, BuildingType } from "../types/buildings";
import BuildingItem from "./BuildingItem";

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  special: "Special",
  production: "Production",
  refining: "Refining",
  utility: "Utility",
  storage: "Storage",
};

const CATEGORY_ICONS: Record<BuildingCategory, IconName> = {
  special: "Star",
  production: "Hammer",
  refining: "Factory",
  utility: "Wrench",
  storage: "Package",
};

type BuildingFolderProps = {
  category: BuildingCategory;
  buildings: BuildingType[];
};

const BuildingFolder = ({ category, buildings }: BuildingFolderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full px-2 py-1.5 rounded-sm",
          "hover:bg-gray-100 transition-colors group",
        )}
      >
        <InlineStack gap="2" align="center">
          <Icon
            name={CATEGORY_ICONS[category]}
            size="sm"
            className="text-gray-600"
          />
          <span className="text-sm font-semibold text-gray-700">
            {CATEGORY_LABELS[category]}
          </span>
          <span className="text-xs text-gray-500">({buildings.length})</span>
        </InlineStack>
        <Icon
          name="ChevronDown"
          size="sm"
          className={cn(
            "text-gray-500 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <BlockStack gap="1" className="mt-1 ml-2">
          {buildings.map((buildingType) => (
            <BuildingItem key={buildingType} buildingType={buildingType} />
          ))}
        </BlockStack>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default BuildingFolder;
