import { Home } from "lucide-react";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";

interface SubgraphBreadcrumbsViewProps {
  path: string[];
  onNavigate: (index: number) => void;
}

export const SubgraphBreadcrumbsView = ({
  path,
  onNavigate,
}: SubgraphBreadcrumbsViewProps) => {
  if (path.length <= 1) {
    return null;
  }

  return (
    <InlineStack
      align="space-between"
      gap="0"
      className="px-4 py-2 bg-gray-50 border-b w-full z-1"
    >
      <Breadcrumb>
        <BreadcrumbList>
          {path.map((pathSegment, index) => {
            const isLast = index === path.length - 1;
            const isRoot = index === 0;

            return (
              <Fragment key={`${pathSegment}-${index}`}>
                <BreadcrumbItem>
                  {!isLast ? (
                    <BreadcrumbLink asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate(index)}
                        className="h-6 px-2"
                      >
                        {isRoot ? (
                          <InlineStack align="start" gap="1">
                            <Home className="w-3 h-3" />
                            Root
                          </InlineStack>
                        ) : (
                          pathSegment
                        )}
                      </Button>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>
                      {isRoot ? (
                        <InlineStack align="start" gap="1">
                          <Home className="w-3 h-3" />
                          Root
                        </InlineStack>
                      ) : (
                        pathSegment
                      )}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="text-xs text-gray-500">
        {path.length - 1} level{path.length - 1 !== 1 ? "s" : ""} deep
      </div>
    </InlineStack>
  );
};
