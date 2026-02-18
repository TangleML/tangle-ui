import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import {
  BUILDING_CATEGORIES,
  type BuildingCategory,
  type BuildingType,
} from "../types/buildings";
import BuildingItem from "./BuildingItem";

type BuildingFolderProps = {
  category: BuildingCategory;
  buildings: BuildingType[];
};

const BuildingFolder = ({ category, buildings }: BuildingFolderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const buildingCategory = BUILDING_CATEGORIES.find(
    (cat) => cat.type === category,
  );

  if (!buildingCategory) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-9/10">
      <CollapsibleTrigger
        className={cn(
          "flex items-center justify-between w-full px-2 py-1.5 rounded-sm",
          "hover:bg-gray-100 transition-colors group",
        )}
      >
        <InlineStack gap="2" align="center">
          <Icon
            name={buildingCategory.icon}
            size="sm"
            className="text-gray-600"
          />
          <span className="text-sm font-semibold text-gray-700">
            {buildingCategory.label}
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

      <CollapsibleContent className="w-full">
        <BlockStack gap="1" className="mt-1 ml-2 w-full">
          {buildings.map((buildingType) => (
            <BuildingItem key={buildingType} buildingType={buildingType} />
          ))}
        </BlockStack>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default BuildingFolder;
