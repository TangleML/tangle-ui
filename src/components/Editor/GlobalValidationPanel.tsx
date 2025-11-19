import { useMemo } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
    ValidationErrorDetail,
    ValidationResult,
} from "@/utils/validations";

interface GlobalValidationPanelProps {
    validation: ValidationResult;
    onFocus: (detail: ValidationErrorDetail) => void;
}

const formatPathLabel = (path: string[]): string => {
    if (path.length === 0) {
        return "Pipeline";
    }

    return path[path.length - 1];
};

const getGroupKey = (detail: ValidationErrorDetail): string => {
    return detail.path[0] ?? "pipeline";
};

export const GlobalValidationPanel = ({
    validation,
    onFocus,
}: GlobalValidationPanelProps) => {
    const groupedErrors = useMemo(() => {
        const groups = new Map<
            string,
            { key: string; title: string; items: ValidationErrorDetail[] }
        >();

        validation.nodeErrors.forEach((detail) => {
            const key = getGroupKey(detail);
            const title = detail.path[0] ?? "Pipeline";

            if (!groups.has(key)) {
                groups.set(key, { key, title, items: [] });
            }

            groups.get(key)?.items.push(detail);
        });

        return Array.from(groups.values());
    }, [validation.nodeErrors]);

    if (validation.isValid) {
        return (
            <InfoBox variant="success" title="No validation errors found">
                Pipeline is ready for submission
            </InfoBox>
        );
    }

    const totalErrors = validation.errors.length;

    return (
        <div className="space-y-2 mb-6">
            <InfoBox
                variant="error"
                title={`${totalErrors} validation error${totalErrors > 1 ? "s" : ""} found:`}
            >
                <ScrollArea className="h-64 pr-1">
                    <Accordion
                        type="multiple"
                        defaultValue={groupedErrors.map((group) => group.key)}
                        className="w-full"
                    >
                        {groupedErrors.map((group) => (
                            <AccordionItem key={group.key} value={group.key}>
                                <AccordionTrigger className="text-left py-1.5">
                                    <InlineStack
                                        align="space-between"
                                        blockAlign="center"
                                        className="w-full"
                                    >
                                        <span className="text-sm font-medium">{group.title}</span>
                                        <Badge variant="secondary">{group.items.length}</Badge>
                                    </InlineStack>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <BlockStack gap="1" className="py-1">
                                        {group.items.map((detail, index) => (
                                            <div
                                                key={`${detail.anchor}-${index}`}
                                                className="rounded border border-destructive/25 bg-destructive/5 px-3 py-2"
                                            >
                                                <InlineStack
                                                    align="space-between"
                                                    blockAlign="center"
                                                    className="w-full gap-2"
                                                >
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {formatPathLabel(detail.path)}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => onFocus(detail)}
                                                    >
                                                        Focus
                                                    </Button>
                                                </InlineStack>
                                                <p className="mt-1 text-xs text-muted-foreground leading-snug break-words">
                                                    {detail.reason}
                                                </p>
                                            </div>
                                        ))}
                                    </BlockStack>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
            </InfoBox>
        </div>
    );
};

