import type { ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type {
    RunDateFilter,
    RunFilters,
    RunSortField,
    RunStatusFilter,
} from "./useRunFilters";

interface RunFiltersBarProps {
    filters: RunFilters;
    hasActiveFilters: boolean;
    activeFilterCount: number;
    onUpdateFilter: <K extends keyof RunFilters>(key: K, value: RunFilters[K]) => void;
    onClearFilters: () => void;
    totalCount: number;
    filteredCount: number;
}

const SORT_OPTIONS: { value: RunSortField; label: string }[] = [
    { value: "date", label: "Date" },
    { value: "name", label: "Name" },
    { value: "status", label: "Status" },
];

const DATE_FILTER_OPTIONS: { value: RunDateFilter; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "Last 30 days" },
];

const STATUS_FILTER_OPTIONS: { value: RunStatusFilter; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "SUCCEEDED", label: "Succeeded" },
    { value: "FAILED", label: "Failed" },
    { value: "RUNNING", label: "Running" },
    { value: "PENDING", label: "Pending" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "SYSTEM_ERROR", label: "System error" },
];

const TRAPDOOR_TOOLTIP = "Preview: Filters current page only. Full API support coming soon.";

interface TrapdoorWrapperProps {
    children: React.ReactNode;
    className?: string;
}

function TrapdoorWrapper({ children, className }: TrapdoorWrapperProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className={cn(
                        "relative border border-dashed border-amber-500/50 rounded-md p-0.5 bg-amber-500/5",
                        className,
                    )}
                >
                    <div className="absolute -top-1.5 -right-1.5 z-10">
                        <Badge
                            variant="outline"
                            size="xs"
                            className="bg-amber-100 border-amber-300 text-amber-700"
                        >
                            <Icon name="FlaskConical" className="w-2.5 h-2.5" />
                        </Badge>
                    </div>
                    {children}
                </div>
            </TooltipTrigger>
            <TooltipContent sideOffset={8} className="max-w-xs">
                {TRAPDOOR_TOOLTIP}
            </TooltipContent>
        </Tooltip>
    );
}

export function RunFiltersBar({
    filters,
    hasActiveFilters,
    activeFilterCount,
    onUpdateFilter,
    onClearFilters,
    totalCount,
    filteredCount,
}: RunFiltersBarProps) {
    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        onUpdateFilter("searchQuery", e.target.value);
    };

    const handleSortChange = (value: string) => {
        onUpdateFilter("sortField", value as RunSortField);
    };

    const handleSortDirectionToggle = () => {
        onUpdateFilter(
            "sortDirection",
            filters.sortDirection === "asc" ? "desc" : "asc",
        );
    };

    const handleDateFilterChange = (value: string) => {
        onUpdateFilter("dateFilter", value as RunDateFilter);
    };

    const handleStatusFilterChange = (value: string) => {
        onUpdateFilter("statusFilter", value as RunStatusFilter);
    };

    const sortDirectionIcon: "ArrowUp" | "ArrowDown" =
        filters.sortDirection === "asc" ? "ArrowUp" : "ArrowDown";

    const isFiltered = filteredCount < totalCount;

    return (
        <InlineStack gap="3" blockAlign="center" wrap="wrap" className="mb-4">
            <TrapdoorWrapper>
                <InlineStack gap="1" wrap="nowrap">
                    <Input
                        type="text"
                        placeholder="Search name or ID..."
                        value={filters.searchQuery}
                        onChange={handleSearchChange}
                        className="w-44"
                        data-testid="run-search-input"
                    />
                    {filters.searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onUpdateFilter("searchQuery", "")}
                        >
                            <Icon name="CircleX" />
                        </Button>
                    )}
                </InlineStack>
            </TrapdoorWrapper>

            <TrapdoorWrapper>
                <InlineStack gap="1" wrap="nowrap" blockAlign="center">
                    <Select value={filters.sortField} onValueChange={handleSortChange}>
                        <SelectTrigger className="w-24" data-testid="run-sort-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSortDirectionToggle}
                        title={filters.sortDirection === "asc" ? "Ascending" : "Descending"}
                    >
                        <Icon name={sortDirectionIcon} />
                    </Button>
                </InlineStack>
            </TrapdoorWrapper>

            <TrapdoorWrapper>
                <Select value={filters.dateFilter} onValueChange={handleDateFilterChange}>
                    <SelectTrigger className="w-28" data-testid="run-date-filter-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TrapdoorWrapper>

            <TrapdoorWrapper>
                <Select value={filters.statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-32" data-testid="run-status-filter-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TrapdoorWrapper>

            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={onClearFilters} data-testid="run-clear-filters">
                    <Icon name="X" />
                    <Text as="span" size="xs" className="bg-muted px-1.5 py-0.5 rounded-full">
                        {activeFilterCount}
                    </Text>
                </Button>
            )}

            {isFiltered && (
                <Text as="span" size="xs" tone="subdued">
                    Showing {filteredCount} of {totalCount} on this page
                </Text>
            )}
        </InlineStack>
    );
}
