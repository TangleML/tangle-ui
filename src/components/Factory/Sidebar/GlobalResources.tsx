import { useEffect, useRef, useState } from "react";

import { InlineStack } from "@/components/ui/layout";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { isGlobalResource, RESOURCES } from "../data/resources";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import type { ResourceType } from "../types/resources";

interface ChangeIndicator {
  amount: number;
  key: number; // Used to force re-render/animation
}

const GlobalResources = () => {
  const { resources } = useGlobalResources();
  const [changes, setChanges] = useState<Map<string, ChangeIndicator>>(
    new Map(),
  );
  const previousResources = useRef(resources);
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Detect changes
    Object.entries(resources).forEach(([key, currentAmount]) => {
      const resourceType = key as ResourceType;

      if (!isGlobalResource(resourceType)) return;

      const previousAmount = previousResources.current[resourceType] || 0;
      const change = currentAmount - previousAmount;

      if (change !== 0) {
        // Clear existing timer for this resource
        const existingTimer = timers.current.get(resourceType);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Replace existing change with new one
        setChanges((prev) => {
          const updated = new Map(prev);
          updated.set(resourceType, {
            amount: change,
            key: Date.now(), // New key forces animation restart
          });
          return updated;
        });

        // Set timer to remove after animation
        const timer = setTimeout(() => {
          setChanges((prev) => {
            const updated = new Map(prev);
            updated.delete(resourceType);
            return updated;
          });
          timers.current.delete(resourceType);
        }, 2000);

        timers.current.set(resourceType, timer);
      }
    });

    previousResources.current = resources;

    // Cleanup all timers on unmount
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, [resources]);

  return (
    <SidebarGroup className="space-y-3">
      {Object.entries(RESOURCES).map(([key, resource]) => {
        const resourceType = key as ResourceType;
        if (!isGlobalResource(resourceType)) return null;

        const amount = resources[resourceType] || 0;
        const change = changes.get(resourceType);

        return (
          <SidebarGroupLabel key={resourceType}>
            <InlineStack blockAlign="center" gap="2">
              <InlineStack gap="2" blockAlign="center">
                <Text size="lg">{resource.icon}</Text>
                <Text size="lg" tone="subdued">
                  {amount}
                </Text>
              </InlineStack>

              {change && (
                <div
                  key={change.key}
                  className={cn(
                    "text-sm font-semibold",
                    "animate-out fade-out",
                    change.amount > 0 ? "text-green-600" : "text-red-600",
                  )}
                  style={{
                    animationDuration: "2000ms",
                    animationFillMode: "forwards",
                  }}
                >
                  {change.amount > 0 ? "+" : ""}
                  {change.amount}
                </div>
              )}
            </InlineStack>
          </SidebarGroupLabel>
        );
      })}
    </SidebarGroup>
  );
};

export default GlobalResources;
