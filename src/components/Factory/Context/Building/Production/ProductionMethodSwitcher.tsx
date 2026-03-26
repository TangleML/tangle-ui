import { useState } from "react";

import { RESOURCES } from "@/components/Factory/data/resources";
import type { ProductionMethod } from "@/components/Factory/types/production";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

interface ProductionMethodSwitcherProps {
  currentMethod: ProductionMethod;
  availableMethods: ProductionMethod[];
  onMethodChange: (method: ProductionMethod) => void;
}

export const ProductionMethodSwitcher = ({
  currentMethod,
  availableMethods,
  onMethodChange,
}: ProductionMethodSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const canSwitchMethods = availableMethods.length > 1;

  if (!canSwitchMethods) {
    return null;
  }

  const handleMethodSelect = (method: ProductionMethod) => {
    onMethodChange(method);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div>
          <TooltipButton
            tooltip="Switch production method"
            size="xs"
            variant="outline"
          >
            <Icon name="ArrowLeftRight" size="sm" />
            Change
          </TooltipButton>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <BlockStack gap="2">
          <Text size="sm" weight="semibold">
            Available Methods
          </Text>
          <BlockStack gap="1">
            {availableMethods.map((method, idx) => {
              const isActive = method.name === currentMethod.name;
              return (
                <button
                  key={idx}
                  onClick={() => handleMethodSelect(method)}
                  disabled={isActive}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    isActive
                      ? "bg-primary/10 border-primary cursor-default"
                      : "hover:bg-accent border-transparent cursor-pointer"
                  }`}
                >
                  <BlockStack gap="1">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text size="sm" weight="semibold">
                        {method.name}
                      </Text>
                      {isActive && (
                        <Icon name="Check" size="sm" className="text-primary" />
                      )}
                    </InlineStack>

                    <InlineStack gap="2" align="center">
                      {/* Inputs */}
                      {method.inputs && method.inputs.length > 0 && (
                        <Text size="xs" tone="subdued">
                          {method.inputs
                            .map(
                              (i) =>
                                `${i.amount}x ${RESOURCES[i.resource]?.icon || i.resource}`,
                            )
                            .join(", ")}
                        </Text>
                      )}
                      {method.inputs &&
                        method.inputs.length > 0 &&
                        method.outputs &&
                        method.outputs.length > 0 && (
                          <Text size="xs" tone="subdued">
                            →
                          </Text>
                        )}
                      {/* Outputs */}
                      {method.outputs && method.outputs.length > 0 && (
                        <Text size="xs" tone="subdued">
                          {method.outputs
                            .map(
                              (o) =>
                                `${o.amount}x ${RESOURCES[o.resource]?.icon || o.resource}`,
                            )
                            .join(", ")}
                        </Text>
                      )}
                    </InlineStack>

                    <Text size="xs" tone="subdued">
                      {method.days} {pluralize(method.days, "day")}
                    </Text>
                  </BlockStack>
                </button>
              );
            })}
          </BlockStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};
