import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";

interface RenderMetric {
    id: string;
    phase: "mount" | "update" | "nested-update";
    actualDuration: number;
    baseDuration: number;
    startTime: number;
    commitTime: number;
    timestamp: number;
}

// Store metrics globally for analysis
const metrics: RenderMetric[] = [];

// Log to console in dev
const LOG_TO_CONSOLE = import.meta.env.DEV;

const onRenderCallback: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
) => {
    const metric: RenderMetric = {
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        timestamp: Date.now(),
    };

    metrics.push(metric);

    if (LOG_TO_CONSOLE) {
        console.log(
            `[Profiler] ${id} ${phase}: ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`,
        );
    }
};

interface PerformanceProfilerProps {
    id: string;
    children: ReactNode;
}

export function PerformanceProfiler({
    id,
    children,
}: PerformanceProfilerProps) {
    // Only profile in development
    if (!import.meta.env.DEV) {
        return <>{children}</>;
    }

    return (
        <Profiler id={id} onRender={onRenderCallback}>
            {children}
        </Profiler>
    );
}

// Utility functions to analyze collected metrics
export function getMetrics() {
    return [...metrics];
}

export function clearMetrics() {
    metrics.length = 0;
}

export function getMetricsSummary(filterId?: string) {
    const filtered = filterId ? metrics.filter((m) => m.id === filterId) : metrics;

    if (filtered.length === 0) {
        return null;
    }

    const renderCounts = filtered.reduce(
        (acc, m) => {
            acc[m.phase] = (acc[m.phase] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );

    const durations = filtered.map((m) => m.actualDuration);

    return {
        totalRenders: filtered.length,
        mounts: renderCounts.mount || 0,
        updates: renderCounts.update || 0,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        totalDuration: durations.reduce((a, b) => a + b, 0),
    };
}

// Expose to window for console debugging
if (typeof window !== "undefined" && import.meta.env.DEV) {
    (window as any).__PERF_METRICS__ = {
        get: getMetrics,
        clear: clearMetrics,
        summary: getMetricsSummary,
    };
}

